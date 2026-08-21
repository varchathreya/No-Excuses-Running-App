import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RoutePoint } from '@/context/AppContext';

export default function NativeRouteMap({ route }: { route: RoutePoint[]; region?: unknown; strokeColor?: string; startColor?: string; endColor?: string }) {
  return <View style={styles.empty}><Text style={styles.text}>{route.length ? 'Route map appears on Android APK' : 'Your finished route will appear here'}</Text></View>;
}
const styles = StyleSheet.create({ empty: { height: 170, borderRadius: 24, backgroundColor: '#222829', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, text: { color: '#A8B0AE', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: .8 } });