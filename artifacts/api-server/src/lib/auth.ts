import type { IncomingHttpHeaders } from "http";
import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";

export const AUTH_ERROR_CODES = [
  "AUTH_REQUIRED",
  "AUTH_TOKEN_REJECTED",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export type AuthState =
  | { status: "authenticated"; userId: string }
  | { status: "unauthenticated"; code: AuthErrorCode };

type ClerkAuthResult = { userId?: string | null };

/**
 * Classify whether a Clerk-protected request is authenticated.
 *
 * - No bearer token supplied => AUTH_REQUIRED
 * - Bearer token supplied but Clerk did not accept it => AUTH_TOKEN_REJECTED
 * - Clerk accepted the token => authenticated
 *
 * Pure function kept free of request objects so it can be unit tested without
 * booting an Express server or a real Clerk instance.
 */
export function resolveAuthState(
  clerkAuth: ClerkAuthResult,
  headers: IncomingHttpHeaders,
): AuthState {
  const userId = clerkAuth.userId;
  if (typeof userId === "string" && userId.length > 0) {
    return { status: "authenticated", userId };
  }
  if (hasBearerToken(headers)) {
    return { status: "unauthenticated", code: "AUTH_TOKEN_REJECTED" };
  }
  return { status: "unauthenticated", code: "AUTH_REQUIRED" };
}

export function hasBearerToken(headers: IncomingHttpHeaders): boolean {
  const header = headers.authorization;
  if (!header || typeof header !== "string") return false;
  return /^Bearer\s+/i.test(header);
}

export function getAuthState(req: Request): AuthState {
  return resolveAuthState(getAuth(req), req.headers);
}

export function authErrorMessage(code: AuthErrorCode): string {
  switch (code) {
    case "AUTH_TOKEN_REJECTED":
      return "Your session token was not accepted. Sign in again, or rebuild the app with the Clerk environment that matches the API.";
    case "AUTH_REQUIRED":
      return "Sign in required.";
  }
}

export function authErrorBody(code: AuthErrorCode) {
  return { code, message: authErrorMessage(code) };
}

/**
 * Express response helper used by every protected route so the mobile client
 * can distinguish "not signed in" from "token rejected (environment
 * mismatch)" through the structured `code` field.
 */
export function sendUnauthorized(res: Response, state: AuthState): void {
  if (state.status === "authenticated") {
    res.status(500).json({
      code: "AUTH_REJECTED_INTERNALLY",
      message: "Internal authentication state error.",
    });
    return;
  }
  res.status(401).json(authErrorBody(state.code));
}