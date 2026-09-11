import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useStartCalendarOAuth } from '@workspace/api-client-react';
import { getCalendarOAuthRedirectUrl } from '@/lib/oauth';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

export default function ConnectCalendar() {
  const colors = useColors();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const startCalendarOAuth = useStartCalendarOAuth();
  const started = useRef(false);
  const [error, setError] = useState('');

  const begin = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setError('');
    try {
      const authorization = await startCalendarOAuth.mutateAsync();
      const result = await WebBrowser.openAuthSessionAsync(
        authorization.authorizationUrl,
        getCalendarOAuthRedirectUrl(),
      );
      if (result.type === 'success' && !result.url.includes('status=error')) {
        router.replace('/(tabs)/schedule');
        return;
      }
      if (result.type !== 'cancel' && result.type !== 'dismiss') {
        throw new Error('Google Calendar permission was not completed.');
      }
    } catch (cause) {
      void WebBrowser.dismissBrowser();
      setError(cause instanceof Error ? cause.message : 'Google Calendar could not be connected.');
      started.current = false;
    }
  }, [router, startCalendarOAuth]);

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
      {startCalendarOAuth.isPending && !error ? (
        <View style={local.loading}><ActivityIndicator color={colors.primary} /><Text style={[local.loadingText, { color: colors.mutedForeground }]}>Opening Google Calendar…</Text></View>
      ) : (
        <>
          {!!error && <Text style={[local.error, { color: colors.destructive }]}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={startCalendarOAuth.isPending} onPress={() => { started.current = false; void begin(); }} style={[local.button, { backgroundColor: colors.foreground, opacity: startCalendarOAuth.isPending ? 0.7 : 1 }]}>
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