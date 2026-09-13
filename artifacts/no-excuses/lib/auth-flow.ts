/**
 * Pure, dependency-injected Calendar linking flow.
 *
 * Kept free of React Native and @workspace/api-client-react imports so the
 * exact orchestration used by the Schedule and Connect Calendar screens can be
 * unit-tested without a device, a Clerk instance, or Metro.
 */

export type AuthHeaders = { Authorization: string };

export type AuthErrorCode = "AUTH_REQUIRED" | "AUTH_TOKEN_REJECTED";

export type CalendarOAuthStart = {
  authorizationUrl: string;
  callbackUrl: string;
};

export type LinkCalendarOutcome =
  | { status: "not-ready" }
  | { status: "signed-out" }
  | { status: "no-session" }
  | { status: "sign-in-required" }
  | { status: "env-mismatch" }
  | { status: "unexpected"; message: string }
  | { status: "cancelled" }
  | { status: "callback-error" }
  | { status: "connected" };

export interface CalendarLinkDependencies {
  isLoaded: boolean;
  isSignedIn: boolean;
  /** Obtain a fresh, request-scoped bearer token for this operation. */
  getAuthorization(): Promise<AuthHeaders | null>;
  /** GET /api/auth/session with the request-scoped token. Throws on 401. */
  preflight(auth: AuthHeaders): Promise<void>;
  /** POST /api/calendar/oauth/start with the request-scoped token. */
  startOAuth(auth: AuthHeaders): Promise<CalendarOAuthStart>;
  /** Open the Google authorization URL and wait for the callback. */
  openBrowser(
    authorizationUrl: string,
    redirectUrl: string,
  ): Promise<{ type: string; url?: string | null }>;
  redirectUrl(): string;
  /** Optional post-connect refresh (e.g. re-fetch calendar status). */
  onConnected?(): Promise<void>;
}

export function buildAuthorization(token: string): AuthHeaders {
  return { Authorization: `Bearer ${token}` };
}

/** Returns the structured auth code carried by a 401 response, if any. */
export function getAuthErrorCode(error: unknown): AuthErrorCode | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { status?: unknown; data?: unknown };
  if (candidate.status !== 401) return null;
  const data = candidate.data;
  if (typeof data !== "object" || data === null) return null;
  const code = (data as { code?: unknown }).code;
  if (code === "AUTH_REQUIRED" || code === "AUTH_TOKEN_REJECTED") return code;
  return null;
}

export function isAuthRejected(error: unknown): boolean {
  return getAuthErrorCode(error) === "AUTH_TOKEN_REJECTED";
}

export function isAuthRequired(error: unknown): boolean {
  return getAuthErrorCode(error) === "AUTH_REQUIRED";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Google Calendar could not be connected.";
}

/**
 * Link / switch a Google Calendar account using the published API.
 *
 * - Waits for Clerk to be loaded and the user signed in.
 * - Uses a request-scoped Authorization header for preflight and OAuth start.
 * - Never opens the Google browser until BOTH the preflight and the OAuth
 *   start succeeded.
 * - Distinguishes "sign in again" (AUTH_REQUIRED) from "the APK and API are
 *   using different Clerk environments" (AUTH_TOKEN_REJECTED).
 */
export async function linkCalendar(
  deps: CalendarLinkDependencies,
): Promise<LinkCalendarOutcome> {
  if (!deps.isLoaded) return { status: "not-ready" };
  if (!deps.isSignedIn) return { status: "signed-out" };

  let authorization: AuthHeaders | null;
  try {
    authorization = await deps.getAuthorization();
  } catch (error) {
    return { status: "unexpected", message: errorMessage(error) };
  }
  if (!authorization) return { status: "no-session" };

  try {
    await deps.preflight(authorization);
  } catch (error) {
    if (isAuthRequired(error)) return { status: "sign-in-required" };
    if (isAuthRejected(error)) return { status: "env-mismatch" };
    return { status: "unexpected", message: errorMessage(error) };
  }

  let start: CalendarOAuthStart;
  try {
    start = await deps.startOAuth(authorization);
  } catch (error) {
    if (isAuthRequired(error)) return { status: "sign-in-required" };
    if (isAuthRejected(error)) return { status: "env-mismatch" };
    return { status: "unexpected", message: errorMessage(error) };
  }

  let result: { type: string; url?: string | null };
  try {
    result = await deps.openBrowser(start.authorizationUrl, deps.redirectUrl());
  } catch (error) {
    return { status: "unexpected", message: errorMessage(error) };
  }
  if (result.type !== "success" || !result.url) {
    return { status: "cancelled" };
  }
  if (result.url.includes("status=error")) {
    return { status: "callback-error" };
  }

  try {
    if (deps.onConnected) await deps.onConnected();
  } catch (error) {
    return { status: "unexpected", message: errorMessage(error) };
  }
  return { status: "connected" };
}

/**
 * Run one authenticated API operation with a request-scoped token instead of
 * relying on a mutable global auth-token getter.
 */
export async function runAuthorized<T>(
  getAuthorization: () => Promise<AuthHeaders | null>,
  operation: (authorization: AuthHeaders) => Promise<T>,
): Promise<T> {
  const authorization = await getAuthorization();
  if (!authorization) {
    throw new AuthOperationError(
      "AUTH_REQUIRED",
      "Your No Excuses session is not ready. Please sign in again.",
    );
  }
  return operation(authorization);
}

export class AuthOperationError extends Error {
  readonly name = "AuthOperationError";
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.code = code;
  }
}