import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Header, Button, SectionTitle, styles } from '@/components/Screen';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function PastRuns() {
  const colors = useColors();
  const router = useRouter();
  const { activities } = useApp();
  return <Screen><Header eyebrow="HISTORY" title="Past runs" action={<Button label="Back" secondary onPress={() => router.back()} />} /><SectionTitle>{activities.length} saved {activities.length === 1 ? 'run' : 'runs'}</SectionTitle>
    {activities.length === 0 ? <View style={[local.empty, { backgroundColor: colors.card }]}><Text style={[styles.muted, { color: colors.mutedForeground }]}>Completed outdoor sessions will appear here.</Text></View> :
      activities.map((activity) => <View key={activity.id} style={[local.row, { backgroundColor: colors.card }]}><View style={{ flex: 1 }}><Text style={[local.date, { color: colors.foreground }]}>{new Date(activity.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{new Date(activity.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {(activity.distanceMeters / 1000).toFixed(2)} km</Text></View><Button label="View" secondary onPress={() => router.push(`/runs/${activity.id}`)} /></View>)}
  </Screen>;
}
const local = StyleSheet.create({ empty: { borderRadius: 18, padding: 18 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, marginBottom: 8 }, date: { fontFamily: 'Inter_700Bold', fontSize: 15 } });