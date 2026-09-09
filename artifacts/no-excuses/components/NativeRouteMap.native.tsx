import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { RoutePoint } from '@/context/AppContext';

export default function NativeRouteMap({ route, region, strokeColor, startColor, endColor }: { route: RoutePoint[]; region?: Region; strokeColor: string; startColor: string; endColor: string }) {
  const map = useRef<MapView>(null);
  const fitRoute = useCallback(() => {
    if (route.length > 1) {
      map.current?.fitToCoordinates(route, {
        edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
        animated: false,
      });
    }
  }, [route]);

  useEffect(() => {
    fitRoute();
  }, [fitRoute]);

  if (!region || route.length === 0) return null;

  return (
    <View style={local.frame}>
      <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={region} onMapReady={fitRoute}>
        {route.length > 1 && <Polyline coordinates={route} strokeColor={strokeColor} strokeWidth={5} />}
        <Marker coordinate={route[0]} pinColor={startColor} />
        {route.length > 1 && <Marker coordinate={route[route.length - 1]} pinColor={endColor} />}
      </MapView>
    </View>
  );
}

const local = StyleSheet.create({
  frame: { width: '100%', height: 190, borderRadius: 24, overflow: 'hidden', marginBottom: 14 },
});