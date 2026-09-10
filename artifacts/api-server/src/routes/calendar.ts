import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import {
  CompleteCalendarOAuthQueryParams,
  GetCalendarOAuthStatusResponse,
  GetCalendarPreviewQueryParams,
  GetCalendarPreviewResponse,
  StartCalendarOAuthResponse,
} from "@workspace/api-zod";
import {
  completeCalendarAuthorization,
  createCalendarAuthorization,
  disconnectCalendar,
  getCalendarAccessToken,
  hasCalendarConnection,
  verifyCalendarOAuthState,
} from "../lib/googleCalendarOAuth";

const calendarRouter: IRouter = Router();
const CALENDAR_APP_REDIRECT = "no-excuses://calendar-connected";

function rfc3339(days: number) {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function callbackUrl(req: Request) {
  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol ?? req.protocol;
  const host = forwardedHost ?? req.get("host");
  if (!host) throw new Error("Unable to determine the OAuth callback host.");
  return `${protocol}://${host}/api/calendar/oauth/callback`;
}

function googleFetch(path: string, token: string) {
  return fetch(`https://www.googleapis.com${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

function oauthResultPage(success: boolean) {
  const title = success ? "Google Calendar connected" : "Connection failed";
  const message = success
    ? "No Excuses can now read your booked workout times. You can return to the app."
    : "Google Calendar could not be connected. Return to No Excuses and try again.";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#101410;color:#f5f7f2;font:16px system-ui;display:grid;min-height:100vh;place-items:center}main{max-width:420px;padding:32px;text-align:center}h1{font-size:26px}p{color:#bdc7bb;line-height:1.5}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;
}

function calendarAppRedirect(status: "connected" | "error") {
  return `${CALENDAR_APP_REDIRECT}?status=${status}`;
}

calendarRouter.post("/calendar/oauth/start", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ message: "Sign in required." });
    return;
  }
  try {
    const redirectUri = callbackUrl(req);
    res.json(
      StartCalendarOAuthResponse.parse({
        authorizationUrl: createCalendarAuthorization(userId, redirectUri),
        callbackUrl: redirectUri,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Google Calendar authorization start failed");
    res.status(500).json({ message: "Calendar authorization is unavailable." });
  }
});

calendarRouter.get(
  "/calendar/oauth/callback",
  async (req, res): Promise<void> => {
    res.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'");
    const parsed = CompleteCalendarOAuthQueryParams.safeParse(req.query);
    if (!parsed.success || !parsed.data.state) {
      res.status(400).type("html").send(oauthResultPage(false));
      return;
    }
    try {
      const state = verifyCalendarOAuthState(parsed.data.state);
      if (parsed.data.error || !parsed.data.code) {
        res.redirect(302, calendarAppRedirect("error"));
        return;
      }
      await completeCalendarAuthorization(
        state.sub,
        state.redirectUri,
        parsed.data.code,
      );
      res.redirect(302, calendarAppRedirect("connected"));
    } catch (error) {
      req.log.warn({ err: error }, "Google Calendar authorization callback failed");
      res.redirect(302, calendarAppRedirect("error"));
    }
  },
);

calendarRouter.get(
  "/calendar/oauth/status",
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ message: "Sign in required." });
      return;
    }
    res.json(
      GetCalendarOAuthStatusResponse.parse({
        connected: await hasCalendarConnection(userId),
      }),
    );
  },
);

calendarRouter.delete(
  "/calendar/oauth/connection",
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ message: "Sign in required." });
      return;
    }
    await disconnectCalendar(userId);
    res.status(204).send();
  },
);

calendarRouter.get("/calendar/preview", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ message: "Sign in required." });
    return;
  }
  const parsed = GetCalendarPreviewQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid calendar window." });
    return;
  }
  const rawDays = parsed.data.days ?? 7;
  const days = Math.min(42, Math.max(1, rawDays));
  const window = rfc3339(days);
  try {
    const token = await getCalendarAccessToken(userId);
    if (!token) {
      res.json(
        GetCalendarPreviewResponse.parse({
          connected: false,
          calendarName: "",
          events: [],
        }),
      );
      return;
    }
    const calendarsResponse = await googleFetch(
      "/calendar/v3/users/me/calendarList?maxResults=50",
      token,
    );
    if (calendarsResponse.status === 401 || calendarsResponse.status === 403) {
      res.json(
        GetCalendarPreviewResponse.parse({
          connected: false,
          calendarName: "",
          events: [],
        }),
      );
      return;
    }
    if (!calendarsResponse.ok) {
      res.status(502).json({ connected: false, calendarName: "", events: [] });
      return;
    }
    const calendars = (await calendarsResponse.json()) as {
      items?: Array<{ id: string; summary?: string; primary?: boolean }>;
    };
    const primary =
      calendars.items?.find((item) => item.primary) ?? calendars.items?.[0];
    if (!primary) {
      res.json(
        GetCalendarPreviewResponse.parse({
          connected: true,
          calendarName: "Google Calendar",
          events: [],
        }),
      );
      return;
    }
    const params = new URLSearchParams({
      timeMin: window.start,
      timeMax: window.end,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      showDeleted: "false",
      fields: "items(id,status,summary,start,end,htmlLink)",
    });
    const eventsResponse = await googleFetch(
      `/calendar/v3/calendars/${encodeURIComponent(primary.id)}/events?${params.toString()}`,
      token,
    );
    if (!eventsResponse.ok) {
      res.status(502).json({ connected: false, calendarName: "", events: [] });
      return;
    }
    const events = (await eventsResponse.json()) as {
      items?: Array<{
        id: string;
        status?: string;
        summary?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        htmlLink?: string;
      }>;
    };
    res.json(
      GetCalendarPreviewResponse.parse({
        connected: true,
        calendarName: primary.summary ?? "Google Calendar",
        events: (events.items ?? [])
          .filter((event) => event.status !== "cancelled")
          .map((event) => ({
            id: event.id,
            summary: event.summary ?? "Untitled event",
            start: event.start?.dateTime ?? event.start?.date ?? "",
            end: event.end?.dateTime ?? event.end?.date ?? "",
            htmlLink: event.htmlLink,
          })),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Google Calendar preview failed");
    res.status(502).json({ connected: false, calendarName: "", events: [] });
  }
});

export default calendarRouter;