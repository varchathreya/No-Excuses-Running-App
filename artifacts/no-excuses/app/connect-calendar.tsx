import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { getAuthSession, startCalendarOAuth } from '@workspace/api-client-react';
import { getCalendarOAuthRedirectUrl } from '@/lib/oauth';
import { useColors } from '@/hooks/useColors';
import { getAuthorization } from '@/lib/api-auth';
import { linkCalendar } from '@/lib/auth-flow';

WebBrowser.maybeCompleteAuthSession();

export default function ConnectCalendar() {
  const colors = useColors();
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const started = useRef(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  const begin = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setLinking(true);
    setError('');
    try {
      const outcome = await linkCalendar({
        isLoaded,
        isSignedIn: !!isSignedIn,
        getAuthorization: () => getAuthorization(getToken),
        preflight: (authorization) =>
          getAuthSession({ headers: authorization }).then(() => undefined),
        startOAuth: (authorization) =>
          startCalendarOAuth({ headers: authorization }),
        openBrowser: (authorizationUrl, redirectUrl) =>
          WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUrl),
        redirectUrl: getCalendarOAuthRedirectUrl,
      });
      switch (outcome.status) {
        case 'env-mismatch':
          setError('This build of No Excuses and the server are using different Clerk environments. Rebuild the APK with the Clerk key that matches the published API, then sign in and try again.');
          started.current = false;
          setLinking(false);
          return;
        case 'signed-out':
        case 'no-session':
        case 'sign-in-required':
          router.replace('/sign-in');
          return;
        case 'unexpected':
          setError(outcome.message);
          started.current = false;
          setLinking(false);
          return;
        case 'callback-error':
          setError('Google Calendar permission was not completed.');
          started.current = false;
          setLinking(false);
          return;
        case 'cancelled':
          started.current = false;
          setLinking(false);
          return;
        case 'connected':
          router.replace('/(tabs)/schedule');
          return;
        case 'not-ready':
          started.current = false;
          setLinking(false);
          return;
      }
    } catch (cause) {
      void WebBrowser.dismissBrowser();
      setError(cause instanceof Error ? cause.message : 'Google Calendar could not be connected.');
      started.current = false;
      setLinking(false);
    }
  }, [getToken, isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isLoaded && isSignedIn) void begin();
  }, [begin, isLoaded, isSignedIn]);

  const skip = () => router.replace('/(tabs)');

  if (!isLoaded) return null;
  return (
    <View style={[local.screen, { backgroundColor: colors.background }]}>
      <View style={[local.mark, { backgroundColor: colors.primary }]}>
        <Feather name="calendar" size={34} color={colors.primaryForeground} />
      </View>
      <Text style={[local.eyebrow, { color: colors.primary }]}>GOOGLE CALENDAR</Text>
      <Text style={[local.title, { color: colors.foreground }]}>Connect your schedule.</Text>
      <Text style={[local.body, { color: colors.mutedForeground }]}>
        Choose the Google Calendar account No Excuses should read for booked workout times. It only requests read-only access.
      </Text>
      {linking && !error ? (
        <View style={local.loading}><ActivityIndicator color={colors.primary} /><Text style={[local.loadingText, { color: colors.mutedForeground }]}>Opening Google Calendar…</Text></View>
      ) : (
        <>
          {!!error && <Text style={[local.error, { color: colors.destructive }]}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={linking} onPress={() => { started.current = false; void begin(); }} style={[local.button, { backgroundColor: colors.foreground, opacity: linking ? 0.7 : 1 }]}>
            <Feather name="refresh-cw" size={18} color={colors.background} />
            <Text style={[local.buttonText, { color: colors.background }]}>Try connecting again</Text>
          </Pressable>
        </>
      )}
      <Pressable accessibilityRole="button" onPress={skip} style={local.skip}>
        <Text style={[local.skipText, { color: colors.mutedForeground }]}>Continue without Calendar</Text>
      </Pressable>
      {Platform.OS === 'android' && <Text style={[local.note, { color: colors.mutedForeground }]}>Google will return you to No Excuses when permission is complete.</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  mark: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 2.4, marginBottom: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 40, lineHeight: 44, maxWidth: 330 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, marginTop: 16, marginBottom: 30, maxWidth: 360 },
  loading: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  button: { minHeight: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  skip: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  skipText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18 },
});