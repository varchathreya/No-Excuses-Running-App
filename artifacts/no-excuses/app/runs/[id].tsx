import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Header, Button, Pill, SectionTitle, styles } from '@/components/Screen';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import NativeRouteMap from '@/components/NativeRouteMap';

export default function RunDetails() {
  const colors = useColors();
  const router = useRouter();
  const { id, map } = useLocalSearchParams<{ id: string; map?: string }>();
  const activity = useApp().activities.find((item) => item.id === id);
  if (!activity) { return <Screen><Header eyebrow="HISTORY" title="Run not found" /><Button label="Back to past runs" onPress={() => router.replace('/runs')} /></Screen>; }
  const pace = activity.distanceMeters && activity.elapsedSeconds ? `${Math.floor(activity.elapsedSeconds / (activity.distanceMeters / 1000) / 60)}:${String(Math.floor(activity.elapsedSeconds / (activity.distanceMeters / 1000) % 60)).padStart(2, '0')}` : '0:00';
  return <Screen><Header eyebrow="RUN DETAILS" title="Completed run" action={<Pill color={colors.accent}>SAVED</Pill>} /><Text style={[styles.muted, { color: colors.mutedForeground }]}>{new Date(activity.startedAt).toLocaleString()}</Text><View style={[local.metrics, { backgroundColor: colors.card }]}><Metric label="DISTANCE" value={`${(activity.distanceMeters / 1000).toFixed(2)} km`} /><Metric label="TIME" value={`${Math.floor(activity.elapsedSeconds / 60)}:${String(activity.elapsedSeconds % 60).padStart(2, '0')}`} /><Metric label="PACE / KM" value={pace} /><Metric label="GPS POINTS" value={String(activity.route.length)} /></View><SectionTitle>{map === '1' ? 'Route map' : 'Route saved'}</SectionTitle>{map === '1' ? <NativeRouteMap route={activity.route} region={activity.route[0] ? { latitude: activity.route[0].latitude, longitude: activity.route[0].longitude, latitudeDelta: .01, longitudeDelta: .01 } : undefined} strokeColor={colors.primary} startColor={colors.accent} endColor={colors.primary} /> : <Button label="View route map" icon="map" onPress={() => router.setParams({ map: '1' })} />}<Button label="Back to past runs" secondary onPress={() => router.replace('/runs')} /></Screen>;
}
function Metric({ label, value }: { label: string; value: string }) { const colors = useColors(); return <View><Text style={[local.label, { color: colors.mutedForeground }]}>{label}</Text><Text style={[local.value, { color: colors.foreground }]}>{value}</Text></View>; }
const local = StyleSheet.create({ metrics: { borderRadius: 20, padding: 18, marginTop: 18, gap: 18 }, label: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 }, value: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 4 } });