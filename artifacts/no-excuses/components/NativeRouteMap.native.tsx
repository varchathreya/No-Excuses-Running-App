import React from 'react';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { RoutePoint } from '@/context/AppContext';

export default function NativeRouteMap({ route, region, strokeColor, startColor, endColor }: { route: RoutePoint[]; region: Region; strokeColor: string; startColor: string; endColor: string }) {
  return <MapView style={{ height: 170, borderRadius: 24, overflow: 'hidden', marginBottom: 14 }} initialRegion={region} region={region}><Polyline coordinates={route} strokeColor={strokeColor} strokeWidth={5} /><Marker coordinate={route[0]} pinColor={startColor} /><Marker coordinate={route[route.length - 1]} pinColor={endColor} /></MapView>;
}