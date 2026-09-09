import { Router, type IRouter } from "express";
import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/express";

const calendarRouter: IRouter = Router();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

function rfc3339(days: number) {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function googleAccessToken(req: Parameters<typeof getAuth>[0]) {
  const { userId } = getAuth(req);
  if (!userId) return null;
  const tokens = await clerk.users.getUserOauthAccessToken(userId, "google");
  return tokens.data[0]?.token ?? null;
}

function googleFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(`https://www.googleapis.com${path}`, { ...init, headers });
}

calendarRouter.get("/calendar/preview", async (req, res) => {
  if (!getAuth(req).userId) return res.status(401).json({ message: "Sign in required." });
  const rawDays = Number(req.query.days ?? 7);
  const days = Math.min(42, Math.max(1, Number.isFinite(rawDays) ? rawDays : 7));
  const window = rfc3339(days);
  try {
    const token = await googleAccessToken(req);
    if (!token) return res.json({ connected: false, calendarName: "", events: [] });
    const calendarsResponse = await googleFetch(
      "/calendar/v3/users/me/calendarList?maxResults=50",
      token,
    );
    if (calendarsResponse.status === 401 || calendarsResponse.status === 403) {
      return res.json({ connected: false, calendarName: "", events: [] });
    }
    if (!calendarsResponse.ok) return res.status(502).json({ connected: false, calendarName: "", events: [] });
    const calendars = (await calendarsResponse.json()) as { items?: Array<{ id: string; summary?: string; primary?: boolean }> };
    const primary = calendars.items?.find((item) => item.primary) ?? calendars.items?.[0];
    if (!primary) return res.json({ connected: true, calendarName: "Google Calendar", events: [] });
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
    if (!eventsResponse.ok) return res.status(502).json({ connected: false, calendarName: "", events: [] });
    const events = (await eventsResponse.json()) as { items?: Array<{ id: string; status?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; htmlLink?: string }> };
    return res.json({
      connected: true,
      calendarName: primary.summary ?? "Google Calendar",
      events: (events.items ?? []).filter((event) => event.status !== "cancelled").map((event) => ({
        id: event.id,
        summary: event.summary ?? "Untitled event",
        start: event.start?.dateTime ?? event.start?.date ?? "",
        end: event.end?.dateTime ?? event.end?.date ?? "",
        htmlLink: event.htmlLink,
      })),
    });
  } catch (error) {
    req.log.error({ err: error }, "Google Calendar preview failed");
    return res.status(502).json({ connected: false, calendarName: "", events: [] });
  }
});

calendarRouter.post("/calendar/workouts", async (req, res) => {
  if (!getAuth(req).userId) return res.status(401).json({ message: "Sign in required." });
  const workouts = Array.isArray(req.body?.workouts) ? req.body.workouts : [];
  if (!workouts.length) return res.status(400).json({ message: "At least one workout is required." });
  try {
    const token = await googleAccessToken(req);
    if (!token) return res.status(403).json({ message: "Google Calendar is not connected." });
    let created = 0;
    for (const workout of workouts.slice(0, 31)) {
      if (typeof workout?.title !== "string" || typeof workout?.start !== "string" || typeof workout?.end !== "string") continue;
      const response = await googleFetch(
        "/calendar/v3/calendars/primary/events?sendUpdates=none",
        token,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          summary: `No Excuses: ${workout.title}`,
          description: "Beginner joint-first walk-to-run plan.",
          start: { dateTime: workout.start },
          end: { dateTime: workout.end },
        }) },
      );
      if (response.ok) created += 1;
    }
    return res.json({ created });
  } catch (error) {
    req.log.error({ err: error }, "Google Calendar workout creation failed");
    return res.status(502).json({ message: "Google Calendar is unavailable." });
  }
});

export default calendarRouter;