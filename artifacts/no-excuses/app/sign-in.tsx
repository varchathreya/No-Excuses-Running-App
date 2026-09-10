import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useAuth, useSSO } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { useColors } from '@/hooks/useColors';
import { getOAuthRedirectUrl } from '@/lib/oauth';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignIn() {
  useWarmUpBrowser();
  const colors = useColors();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signInWithGoogle = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { createdSessionId, setActive, signIn, signUp } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: getOAuthRedirectUrl(),
      });
      if (!createdSessionId || !setActive) {
        const status = signIn?.status ?? signUp?.status;
        throw new Error(
          status
            ? `Google sign-in needs another step (${status}). Please try again.`
            : 'Google sign-in did not finish. Please try again.',
        );
      }
      await setActive({
        session: createdSessionId,
        navigate: async ({ session }) => {
          if (session?.currentTask) {
            throw new Error('Your account requires an additional verification step.');
          }
          router.replace('/(tabs)');
        },
      });
    } catch (cause) {
      void WebBrowser.dismissBrowser();
      setError(cause instanceof Error ? cause.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  }, [router, startSSOFlow]);

  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return (
    <View style={[local.screen, { backgroundColor: colors.background }]}>
      <View style={[local.mark, { backgroundColor: colors.primary }]}>
        <Feather name="activity" size={34} color={colors.primaryForeground} />
      </View>
      <Text style={[local.eyebrow, { color: colors.primary }]}>NO EXCUSES</Text>
      <Text style={[local.title, { color: colors.foreground }]}>Your plan. Your calendar.</Text>
      <Text style={[local.body, { color: colors.mutedForeground }]}>
        Sign in so No Excuses can connect the Google Calendar you choose without sharing another user&apos;s events.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={signInWithGoogle}
        style={[local.button, { backgroundColor: colors.foreground, opacity: busy ? 0.7 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Feather name="calendar" size={19} color={colors.background} />
            <Text style={[local.buttonText, { color: colors.background }]}>Continue with Google</Text>
          </>
        )}
      </Pressable>
      {!!error && <Text style={[local.error, { color: colors.destructive }]}>{error}</Text>}
      <Text style={[local.note, { color: colors.mutedForeground }]}>
        Calendar access is requested separately on the Schedule screen.
      </Text>
    </View>
  );
}

const local = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  mark: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 2.4, marginBottom: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 40, lineHeight: 44, maxWidth: 330 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, marginTop: 16, marginBottom: 30, maxWidth: 360 },
  button: { minHeight: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, marginTop: 14 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 20 },
});