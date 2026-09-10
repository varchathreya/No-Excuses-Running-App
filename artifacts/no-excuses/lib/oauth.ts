import * as AuthSession from 'expo-auth-session';

export function getOAuthRedirectUrl() {
  return AuthSession.makeRedirectUri({
    scheme: 'no-excuses',
    path: 'oauth',
  });
}

export function getCalendarOAuthRedirectUrl() {
  return AuthSession.makeRedirectUri({
    scheme: 'no-excuses',
    path: 'calendar-connected',
  });
}