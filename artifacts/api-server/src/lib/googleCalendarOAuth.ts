import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { db, googleCalendarConnectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";
const AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_TTL_MS = 10 * 60 * 1000;

type OAuthState = {
  sub: string;
  exp: number;
  nonce: string;
  redirectUri: string;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function encryptionKey() {
  return createHash("sha256")
    .update(`no-excuses-google-calendar:${requiredEnvironment("SESSION_SECRET")}`)
    .digest();
}

function signState(payload: string) {
  return createHmac("sha256", requiredEnvironment("SESSION_SECRET"))
    .update(payload)
    .digest("base64url");
}

function encryptRefreshToken(refreshToken: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(refreshToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptRefreshToken(encrypted: string) {
  const [version, iv, tag, ciphertext] = encrypted.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted Calendar token.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createCalendarAuthorization(
  userId: string,
  redirectUri: string,
) {
  const state: OAuthState = {
    sub: userId,
    exp: Date.now() + STATE_TTL_MS,
    nonce: randomBytes(18).toString("base64url"),
    redirectUri,
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signedState = `${payload}.${signState(payload)}`;
  const parameters = new URLSearchParams({
    client_id: requiredEnvironment("GOOGLE_OAUTH_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
    state: signedState,
  });
  return `${AUTHORIZATION_URL}?${parameters.toString()}`;
}

export function verifyCalendarOAuthState(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Invalid OAuth state.");
  const expected = Buffer.from(signState(payload));
  const received = Buffer.from(signature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new Error("Invalid OAuth state.");
  }
  const state = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as OAuthState;
  if (
    typeof state.sub !== "string" ||
    typeof state.redirectUri !== "string" ||
    typeof state.exp !== "number" ||
    state.exp < Date.now()
  ) {
    throw new Error("Expired or invalid OAuth state.");
  }
  return state;
}

async function requestTokens(parameters: URLSearchParams) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: parameters,
  });
  const result = (await response.json()) as TokenResponse;
  if (!response.ok) {
    const error = new Error(
      result.error_description ?? result.error ?? "Google token request failed.",
    );
    Object.assign(error, { oauthError: result.error });
    throw error;
  }
  return result;
}

export async function completeCalendarAuthorization(
  userId: string,
  redirectUri: string,
  code: string,
) {
  const tokens = await requestTokens(
    new URLSearchParams({
      client_id: requiredEnvironment("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requiredEnvironment("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code,
    }),
  );
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not provide lasting Calendar access. Remove No Excuses from your Google Account connections and try again.",
    );
  }
  await db
    .insert(googleCalendarConnectionsTable)
    .values({
      clerkUserId: userId,
      encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token),
      grantedScope: tokens.scope ?? CALENDAR_SCOPE,
    })
    .onConflictDoUpdate({
      target: googleCalendarConnectionsTable.clerkUserId,
      set: {
        encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token),
        grantedScope: tokens.scope ?? CALENDAR_SCOPE,
        updatedAt: new Date(),
      },
    });
}

export async function hasCalendarConnection(userId: string) {
  const [connection] = await db
    .select({ userId: googleCalendarConnectionsTable.clerkUserId })
    .from(googleCalendarConnectionsTable)
    .where(eq(googleCalendarConnectionsTable.clerkUserId, userId))
    .limit(1);
  return !!connection;
}

export async function getCalendarAccessToken(userId: string) {
  const [connection] = await db
    .select()
    .from(googleCalendarConnectionsTable)
    .where(eq(googleCalendarConnectionsTable.clerkUserId, userId))
    .limit(1);
  if (!connection) return null;

  try {
    const tokens = await requestTokens(
      new URLSearchParams({
        client_id: requiredEnvironment("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret: requiredEnvironment("GOOGLE_OAUTH_CLIENT_SECRET"),
        grant_type: "refresh_token",
        refresh_token: decryptRefreshToken(connection.encryptedRefreshToken),
      }),
    );
    if (!tokens.access_token) throw new Error("Google returned no access token.");
    return tokens.access_token;
  } catch (error) {
    if (
      error instanceof Error &&
      "oauthError" in error &&
      error.oauthError === "invalid_grant"
    ) {
      await db
        .delete(googleCalendarConnectionsTable)
        .where(eq(googleCalendarConnectionsTable.clerkUserId, userId));
      return null;
    }
    throw error;
  }
}

export async function disconnectCalendar(userId: string) {
  const [connection] = await db
    .select()
    .from(googleCalendarConnectionsTable)
    .where(eq(googleCalendarConnectionsTable.clerkUserId, userId))
    .limit(1);
  if (connection) {
    const token = decryptRefreshToken(connection.encryptedRefreshToken);
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      },
    ).catch(() => undefined);
  }
  await db
    .delete(googleCalendarConnectionsTable)
    .where(eq(googleCalendarConnectionsTable.clerkUserId, userId));
}