import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '@/context/AppContext';
import { useApp } from '@/context/AppContext';
import {
  QueryClient,
  QueryClientProvider,
  setAuthTokenGetter,
  setBaseUrl,
} from '@workspace/api-client-react';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useColors } from '@/hooks/useColors';
import { fetchMobileAuthConfig } from '@/lib/mobile-auth-config';

function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_DOMAIN;
  if (!configured) {
    throw new Error('EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN is required.');
  }
  const withProtocol = /^https?:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;
  const parsed = new URL(withProtocol);
  const path = parsed.pathname.replace(/\/+$/, '');
  if (path === '/api') parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

setBaseUrl(getApiBaseUrl());

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="connect-calendar" options={{ headerShown: false }} />
      <Stack.Screen name="calendar-connected" options={{ headerShown: false }} />
      <Stack.Screen name="runs" options={{ headerShown: false }} />
      <Stack.Screen name="runs/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

function ApiAuthentication() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    setAuthTokenGetter(isSignedIn ? getToken : () => null);
    return () => setAuthTokenGetter(null);
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { hydrated, offlineMode, isOnline } = useApp();
  const { isLoaded } = useAuth();
  const startedAt = useRef(Date.now());
  const completionStarted = useRef(false);
  const [fallbackReady, setFallbackReady] = useState(false);
  const [released, setReleased] = useState(false);
  const [progress, setProgress] = useState(0);
  const [averageMs, setAverageMs] = useState(900);
  const mode = offlineMode || !isOnline ? 'offline' : 'online';
  // Online startup must wait for Clerk rather than briefly mounting the tabs
  // and redirecting later. Explicit offline mode can still open saved plans.
  const ready = hydrated && (isLoaded || (fallbackReady && offlineMode));

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem('no-excuses-bootstrap-loading-times').then((saved) => {
      if (cancelled || !saved) return;
      try {
        const parsed = JSON.parse(saved) as { online?: number[]; offline?: number[] };
        const values = parsed[mode] ?? [];
        if (values.length > 0) {
          setAverageMs(Math.max(350, Math.min(5000, values.reduce((sum, value) => sum + value, 0) / values.length)));
        }
      } catch {
        // A corrupt timing history should never block local app startup.
      }
    });
    return () => { cancelled = true; };
  }, [mode]);

  useEffect(() => {
    const timer = setTimeout(() => setFallbackReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready && !completionStarted.current) {
      completionStarted.current = true;
      const elapsed = Date.now() - startedAt.current;
      setProgress(1);
      void AsyncStorage.getItem('no-excuses-bootstrap-loading-times').then((saved) => {
        let history: { online: number[]; offline: number[] } = { online: [], offline: [] };
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as Partial<typeof history>;
            history = {
              online: Array.isArray(parsed.online) ? parsed.online.filter(Number.isFinite).slice(-11) : [],
              offline: Array.isArray(parsed.offline) ? parsed.offline.filter(Number.isFinite).slice(-11) : [],
            };
          } catch {
            // Start a clean timing history if the stored value is invalid.
          }
        }
        history[mode] = [...history[mode], elapsed].slice(-12);
        return AsyncStorage.setItem('no-excuses-bootstrap-loading-times', JSON.stringify(history));
      });
    }
    return undefined;
  }, [mode, ready]);

  useEffect(() => {
    if (!ready || released) return;
    const timer = setTimeout(() => setReleased(true), 180);
    return () => clearTimeout(timer);
  }, [ready, released]);

  useEffect(() => {
    if (ready) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const ratio = Math.min(0.94, elapsed / averageMs);
      setProgress(ratio * (2 - ratio));
    }, 50);
    return () => clearInterval(timer);
  }, [averageMs, ready]);

  if (!released) {
    return (
      <View style={[authLoading.screen, { backgroundColor: colors.background }]}>
        <View style={[authLoading.mark, { backgroundColor: colors.primary }]}>
          <Text style={[authLoading.markText, { color: colors.primaryForeground }]}>NE</Text>
        </View>
        <Text style={[authLoading.eyebrow, { color: colors.primary }]}>NO EXCUSES</Text>
        <Text style={[authLoading.title, { color: colors.foreground }]}>Getting your plan ready.</Text>
        <Text style={[authLoading.message, { color: colors.mutedForeground }]}>{mode === 'offline' ? 'Opening saved offline data…' : 'Checking your saved session…'}</Text>
        <ActivityIndicator color={colors.primary} style={authLoading.spinner} />
        <View style={[authLoading.track, { backgroundColor: colors.secondary }]}>
          <View style={[authLoading.fill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const configuredPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || null;
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [clerkConfigError, setClerkConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    let cancelled = false;

    fetchMobileAuthConfig(getApiBaseUrl())
      .then((config) => {
        if (configuredPublishableKey && config.clerkPublishableKey !== configuredPublishableKey) {
          throw new Error(
            'The local Clerk publishable key does not match the Clerk environment returned by this API.',
          );
        }
        if (!cancelled) setPublishableKey(config.clerkPublishableKey);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // A local key can keep an explicitly offline/network-unavailable
        // development launch usable, but HTTP errors and environment
        // mismatches must remain visible instead of becoming auth 404s later.
        if (configuredPublishableKey && error instanceof TypeError) {
          setPublishableKey(configuredPublishableKey);
          return;
        }
        setClerkConfigError(
          error instanceof Error
            ? error.message
            : 'The No Excuses authentication configuration could not be loaded.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [configuredPublishableKey]);

  if (!fontsLoaded && !fontError) return null;

  const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;
  if (!publishableKey) {
    return (
      <View style={[authLoading.screen, { backgroundColor: '#111315' }]}>
        <Text style={[authLoading.title, { color: '#F7F3EA' }]}>
          {clerkConfigError ? 'Authentication is unavailable.' : 'Connecting to No Excuses…'}
        </Text>
        <Text style={[authLoading.message, { color: '#A9A39A' }]}>
          {clerkConfigError || 'Loading the Clerk environment for this API.'}
        </Text>
        {!clerkConfigError && <ActivityIndicator color="#FF6657" style={authLoading.spinner} />}
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
      <SafeAreaProvider>
        <AppProvider>
          <AuthBootstrap>
            <ApiAuthentication />
            <ErrorBoundary>
              <QueryClientProvider client={queryClient}>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </QueryClientProvider>
            </ErrorBoundary>
          </AuthBootstrap>
        </AppProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}

const authLoading = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  mark: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  markText: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2.2, marginBottom: 9 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 36 },
  message: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginTop: 12 },
  spinner: { alignSelf: 'flex-start', marginTop: 24 },
  track: { height: 6, borderRadius: 4, overflow: 'hidden', marginTop: 18, width: 230, maxWidth: '100%', alignSelf: 'flex-start' },
  fill: { height: '100%', width: '35%', borderRadius: 4 },
});
