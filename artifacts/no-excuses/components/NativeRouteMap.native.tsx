import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, Region, UrlTile } from 'react-native-maps';
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
      <MapView
        ref={map}
        style={local.map}
        initialRegion={region}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        googleRenderer="LEGACY"
        loadingEnabled
        onMapReady={fitRoute}
      >
        {Platform.OS === 'android' && (
          <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
        )}
        {route.length > 1 && <Polyline coordinates={route} strokeColor={strokeColor} strokeWidth={5} />}
        <Marker coordinate={route[0]} pinColor={startColor} />
        {route.length > 1 && <Marker coordinate={route[route.length - 1]} pinColor={endColor} />}
      </MapView>
      {Platform.OS === 'android' && <Text style={local.attribution}>© OpenStreetMap contributors</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  frame: { width: '100%', height: 190, marginBottom: 14 },
  map: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 24 },
  attribution: { position: 'absolute', right: 7, bottom: 5, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.82)', color: '#273032', fontSize: 9 },
});