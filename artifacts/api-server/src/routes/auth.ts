import { Router, type IRouter } from "express";
import { GetAuthSessionResponse } from "@workspace/api-zod";
import { getAuthState, hasBearerToken, sendUnauthorized } from "../lib/auth";

const router: IRouter = Router();

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