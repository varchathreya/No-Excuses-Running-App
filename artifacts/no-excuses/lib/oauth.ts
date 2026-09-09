import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

const OAUTH_TIMEOUT_MS = 60_000;

export function getOAuthRedirectUrl() {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return AuthSession.makeRedirectUri();
  }

  return AuthSession.makeRedirectUri({
    scheme: 'no-excuses',
    path: 'oauth',
  });
}

export async function withOAuthTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      void WebBrowser.dismissBrowser();
      reject(new Error('Google did not return to No Excuses. Close the Google window and try again.'));
    }, OAUTH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}