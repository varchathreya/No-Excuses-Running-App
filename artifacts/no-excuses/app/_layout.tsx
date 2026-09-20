import React, { useEffect } from 'react';
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
import {
  QueryClient,
  QueryClientProvider,
  setAuthTokenGetter,
  setBaseUrl,
} from '@workspace/api-client-react';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useColors } from '@/hooks/useColors';

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
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={[authLoading.screen, { backgroundColor: colors.background }]}>
        <View style={[authLoading.mark, { backgroundColor: colors.primary }]}>
          <Text style={[authLoading.markText, { color: colors.primaryForeground }]}>NE</Text>
        </View>
        <Text style={[authLoading.eyebrow, { color: colors.primary }]}>NO EXCUSES</Text>
        <Text style={[authLoading.title, { color: colors.foreground }]}>Getting your plan ready.</Text>
        <Text style={[authLoading.message, { color: colors.mutedForeground }]}>Checking your saved session…</Text>
        <ActivityIndicator color={colors.primary} style={authLoading.spinner} />
        <View style={[authLoading.track, { backgroundColor: colors.secondary }]}>
          <View style={[authLoading.fill, { backgroundColor: colors.primary }]} />
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;
  if (!publishableKey) {
    throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required.');
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
      <AuthBootstrap>
        <ApiAuthentication />
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AppProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </AppProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </AuthBootstrap>
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
  track: { height: 6, borderRadius: 4, overflow: 'hidden', marginTop: 18, width: '100%' },
  fill: { height: '100%', width: '35%', borderRadius: 4 },
});
