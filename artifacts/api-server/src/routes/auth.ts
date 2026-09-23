import { Router, type IRouter } from "express";
import { GetAuthSessionResponse } from "@workspace/api-zod";
import { getAuthState, hasBearerToken, sendUnauthorized } from "../lib/auth";

const router: IRouter = Router();

/**
 * Mobile clients need the public Clerk key for the same environment as this
 * API. The publishable key is intentionally public client configuration; do
 * not add the Clerk secret key or any session data to this response.
 */
router.get("/auth/mobile-config", (_req, res) => {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim();

  if (!publishableKey || !/^pk_(test|live)_/.test(publishableKey)) {
    res.status(503).json({
      code: "MOBILE_AUTH_CONFIG_UNAVAILABLE",
      message: "The mobile Clerk configuration is not available.",
    });
    return;
  }

  res.json({
    clerkPublishableKey: publishableKey,
  });
});

/**
 * Preflight endpoint used by the mobile app before starting sensitive flows
 * (e.g. linking a Google Calendar account).
 *
 * Never echoes the token, token claims, the raw Authorization header, or any
 * secret value. Successful responses only carry `{ authenticated: true }`.
 * Logging is limited to safe metadata: request id, whether a bearer header
 * was present, and whether Clerk produced a user id.
 */
router.get("/auth/session", (req, res) => {
  const state = getAuthState(req);

  req.log.info(
    {
      requestId: req.id,
      hasBearerHeader: hasBearerToken(req.headers),
      clerkAccepted: state.status === "authenticated",
    },
    "auth session check",
  );

  if (state.status !== "authenticated") {
    sendUnauthorized(res, state);
    return;
  }

  res.json(GetAuthSessionResponse.parse({ authenticated: true }));
});

export default router;