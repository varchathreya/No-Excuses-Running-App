import { setAuthTokenGetter } from '@workspace/api-client-react';

type TokenGetter = () => Promise<string | null> | string | null;

/**
 * Make one protected API operation wait for a usable Clerk session token.
 *
 * The mobile app can navigate immediately after Clerk activates a session.
 * Pinning the freshly resolved token for this request avoids a race with the
 * root layout's global token getter during that handoff.
 */
export async function withFreshAuthToken<T>(
  getToken: TokenGetter,
  operation: () => Promise<T>,
) {
  const token = await getToken();
  if (!token) {
    throw new Error('Your No Excuses session is not ready. Please sign in again.');
  }

  setAuthTokenGetter(() => token);
  try {
    return await operation();
  } finally {
    setAuthTokenGetter(getToken);
  }
}