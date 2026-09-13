import { setAuthTokenGetter } from '@workspace/api-client-react';
import type { AuthHeaders } from '@/lib/auth-flow';
import { buildAuthorization } from '@/lib/auth-flow';

type TokenGetter = () => Promise<string | null> | string | null;

/**
 * Resolve a fresh, request-scoped Authorization header for one API operation.
 *
 * The mobile app can navigate immediately after Clerk activates a session.
 * Calling `getToken()` here yields a token for THIS request rather than
 * depending on a mutable global auth-token getter for the critical Calendar
 * flow.
 */
export async function getAuthorization(
  getToken: TokenGetter,
): Promise<AuthHeaders | null> {
  const token = await getToken();
  if (!token) return null;
  return buildAuthorization(token);
}