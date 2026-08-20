import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export default function TabLayout() {
  const colors = useColors();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.mutedForeground,
      tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border, height: 82, paddingBottom: 20, paddingTop: 8 },
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