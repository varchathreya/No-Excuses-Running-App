import { test } from "node:test";
import assert from "node:assert/strict";
import { hasBearerToken, resolveAuthState } from "../../artifacts/api-server/src/lib/auth.ts";
import {
  AuthErrorCode,
  AuthOperationError,
  buildAuthorization,
  getAuthErrorCode,
  isAuthRejected,
  isAuthRequired,
  linkCalendar,
  runAuthorized,
} from "../../artifacts/no-excuses/lib/auth-flow.ts";
import type { CalendarLinkDependencies } from "../../artifacts/no-excuses/lib/auth-flow.ts";

type AuthShape = { userId?: string | null };

function headers(authorization?: string): Record<string, string | undefined> {
  return { authorization };
}

function unauthorized(code: AuthErrorCode, message = "nope") {
  return { status: 401, data: { code, message } };
}

function baseDeps(): CalendarLinkDependencies {
  return {
    isLoaded: true,
    isSignedIn: true,
    getAuthorization: async () => buildAuthorization("cpa_tok"),
    preflight: async () => undefined,
    startOAuth: async () => ({ authorizationUrl: "https://accounts.google.com/o/oauth2/auth", callbackUrl: "no-excuses://calendar-connected" }),
    openBrowser: async () => ({ type: "success", url: "no-excuses://calendar-connected" }),
    redirectUrl: () => "no-excuses://calendar-connected",
  };
}

function merge(deps: Partial<CalendarLinkDependencies>): CalendarLinkDependencies {
  return { ...baseDeps(), ...deps };
}

test("hasBearerToken recognizes only Authorization: Bearer values", () => {
  assert.equal(hasBearerToken(headers("Bearer abc.def")), true);
  assert.equal(hasBearerToken(headers("bearer xyz")), true);
  assert.equal(hasBearerToken(headers("Basic abc")), false);
  assert.equal(hasBearerToken(headers()), false);
  assert.equal(hasBearerToken({ authorization: ["a", "b"] as unknown as string }), false);
});

test("resolveAuthState: no bearer token => AUTH_REQUIRED", () => {
  const state = resolveAuthState({} as AuthShape, headers());
  assert.deepEqual(state, { status: "unauthenticated", code: "AUTH_REQUIRED" });
});

test("resolveAuthState: bearer token rejected by Clerk => AUTH_TOKEN_REJECTED", () => {
  const state = resolveAuthState({ userId: null } as AuthShape, headers("Bearer cpa_bad"));
  assert.deepEqual(state, { status: "unauthenticated", code: "AUTH_TOKEN_REJECTED" });
});

test("resolveAuthState: accepted Clerk session wins even without a header", () => {
  const state = resolveAuthState({ userId: "user_1" } as AuthShape, headers());
  assert.deepEqual(state, { status: "authenticated", userId: "user_1" });
});

test("buildAuthorization produces a Bearer header", () => {
  assert.deepEqual(buildAuthorization("token_1"), { Authorization: "Bearer token_1" });
});

test("getAuthErrorCode classifies 401 bodies", () => {
  assert.equal(getAuthErrorCode(unauthorized("AUTH_REQUIRED")), "AUTH_REQUIRED");
  assert.equal(getAuthErrorCode(unauthorized("AUTH_TOKEN_REJECTED")), "AUTH_TOKEN_REJECTED");
  assert.equal(getAuthErrorCode({ status: 500 }), null);
  assert.equal(getAuthErrorCode(new Error("net")), null);
  assert.equal(isAuthRequired(unauthorized("AUTH_REQUIRED")), true);
  assert.equal(isAuthRequired(unauthorized("AUTH_TOKEN_REJECTED")), false);
  assert.equal(isAuthRejected(unauthorized("AUTH_TOKEN_REJECTED")), true);
  assert.equal(isAuthRejected(unauthorized("AUTH_REQUIRED")), false);
});

test("linkCalendar: not-ready while Clerk is still loading", async () => {
  assert.deepEqual(await linkCalendar(merge({ isLoaded: false })), { status: "not-ready" });
});

test("linkCalendar: signed-out when there is no session", async () => {
  assert.deepEqual(await linkCalendar(merge({ isSignedIn: false })), { status: "signed-out" });
});

test("linkCalendar: no-session when no token can be minted", async () => {
  assert.deepEqual(
    await linkCalendar(merge({ getAuthorization: async () => null })),
    { status: "no-session" },
  );
});

test("linkCalendar: sign-in-required when preflight returns AUTH_REQUIRED", async () => {
  assert.deepEqual(
    await linkCalendar(merge({ preflight: async () => { throw unauthorized("AUTH_REQUIRED"); } })),
    { status: "sign-in-required" },
  );
});

test("linkCalendar: env-mismatch when preflight returns AUTH_TOKEN_REJECTED", async () => {
  assert.deepEqual(
    await linkCalendar(merge({ preflight: async () => { throw unauthorized("AUTH_TOKEN_REJECTED"); } })),
    { status: "env-mismatch" },
  );
});

test("linkCalendar: sign-in-required when OAuth start returns AUTH_REQUIRED", async () => {
  assert.deepEqual(
    await linkCalendar(merge({ startOAuth: async () => { throw unauthorized("AUTH_REQUIRED"); } })),
    { status: "sign-in-required" },
  );
});

test("linkCalendar: env-mismatch when OAuth start returns AUTH_TOKEN_REJECTED", async () => {
  assert.deepEqual(
    await linkCalendar(merge({ startOAuth: async () => { throw unauthorized("AUTH_TOKEN_REJECTED"); } })),
    { status: "env-mismatch" },
  );
});

test("linkCalendar: unexpected when preflight throws a network error", async () => {
  const outcome = await linkCalendar(merge({ preflight: async () => { throw new Error("ECONNRESET"); } }));
  assert.deepEqual(outcome, { status: "unexpected", message: "ECONNRESET" });
});

test("linkCalendar: cancelled when the browser flow is dismissed", async () => {
  assert.deepEqual(
    await linkCalendar(merge({ openBrowser: async () => ({ type: "dismiss" }) })),
    { status: "cancelled" },
  );
});

test("linkCalendar: callback-error when Google returns status=error", async () => {
  assert.deepEqual(
    await linkCalendar(merge({ openBrowser: async () => ({ type: "success", url: "no-excuses://calendar-connected?status=error" }) })),
    { status: "callback-error" },
  );
});

test("linkCalendar: connected drives the full flow with request-scoped headers", async () => {
  const calls: string[] = [];
  const outcome = await linkCalendar(
    merge({
      getAuthorization: async () => {
        calls.push("authorize");
        return buildAuthorization("cpa_flow");
      },
      preflight: async (auth) => {
        calls.push(`preflight:${auth.Authorization}`);
      },
      startOAuth: async (auth) => {
        calls.push(`start:${auth.Authorization}`);
        return { authorizationUrl: "https://accounts.google.com/o/oauth2/auth?x=1", callbackUrl: "no-excuses://calendar-connected" };
      },
      openBrowser: async (authorizationUrl, redirectUrl) => {
        calls.push(`browser:${authorizationUrl}|${redirectUrl}`);
        return { type: "success", url: "no-excuses://calendar-connected" };
      },
      onConnected: async () => {
        calls.push("connected");
      },
    }),
  );
  assert.deepEqual(outcome, { status: "connected" });
  assert.deepEqual(calls, [
    "authorize",
    "preflight:Bearer cpa_flow",
    "start:Bearer cpa_flow",
    "browser:https://accounts.google.com/o/oauth2/auth?x=1|no-excuses://calendar-connected",
    "connected",
  ]);
});

test("runAuthorized: throws AUTH_REQUIRED when no token is available", async () => {
  await assert.rejects(
    runAuthorized(async () => null, async () => undefined),
    (error: unknown) =>
      error instanceof AuthOperationError &&
      error.code === "AUTH_REQUIRED" &&
      error instanceof Error,
  );
});

test("runAuthorized: passes the request-scoped token to the operation", async () => {
  const received = await runAuthorized(
    async () => buildAuthorization("cpa_op"),
    async (auth) => auth.Authorization,
  );
  assert.equal(received, "Bearer cpa_op");
});
