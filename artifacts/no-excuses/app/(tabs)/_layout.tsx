import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.mutedForeground,
      tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border, height: 62 + Math.max(insets.bottom, 8), paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8 },
      tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => <Feather name="sun" size={21} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: ({ color }) => <Feather name="calendar" size={21} color={color} /> }} />
      <Tabs.Screen name="run" options={{ title: 'Run', tabBarIcon: ({ color }) => <Feather name="navigation" size={21} color={color} /> }} />
      <Tabs.Screen name="rehab" options={{ title: 'Rehab', tabBarIcon: ({ color }) => <Feather name="activity" size={21} color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color }) => <Feather name="trending-up" size={21} color={color} /> }} />
    </Tabs>
  );
}