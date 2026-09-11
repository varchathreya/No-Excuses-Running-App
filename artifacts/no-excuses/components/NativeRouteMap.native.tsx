import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, Region, UrlTile } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { RoutePoint } from '@/context/AppContext';

export default function NativeRouteMap({ route, region, strokeColor, startColor, endColor }: { route: RoutePoint[]; region?: Region; strokeColor: string; startColor: string; endColor: string }) {
  if (Platform.OS === 'android') {
    return (
      <View style={local.frame}>
        <WebView
          originWhitelist={['*']}
          javaScriptEnabled
          source={{ html: createOpenStreetMapHtml(route, strokeColor, startColor, endColor) }}
          style={local.webMap}
          scrollEnabled={false}
          automaticallyAdjustContentInsets={false}
        />
      </View>
    );
  }

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
        mapType="standard"
        loadingEnabled
        onMapReady={fitRoute}
      >
        {route.length > 1 && <Polyline coordinates={route} strokeColor={strokeColor} strokeWidth={5} />}
        <Marker coordinate={route[0]} pinColor={startColor} />
        {route.length > 1 && <Marker coordinate={route[route.length - 1]} pinColor={endColor} />}
      </MapView>
    </View>
  );
}

function createOpenStreetMapHtml(route: RoutePoint[], strokeColor: string, startColor: string, endColor: string) {
  const coordinates = route.map(({ latitude, longitude }) => [latitude, longitude]);
  const routeJson = JSON.stringify(coordinates);
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; background: #e9efea; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    const route = ${routeJson};
    const map = L.map('map', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    const line = L.polyline(route, { color: '${strokeColor}', weight: 5, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    if (route.length) {
      L.circleMarker(route[0], { radius: 7, color: '${startColor}', fillColor: '${startColor}', fillOpacity: 1, weight: 2 }).addTo(map);
      if (route.length > 1) {
        L.circleMarker(route[route.length - 1], { radius: 7, color: '${endColor}', fillColor: '${endColor}', fillOpacity: 1, weight: 2 }).addTo(map);
      }
      map.fitBounds(line.getBounds(), { padding: [24, 24] });
    }
  </script>
</body>
</html>`;
}

const local = StyleSheet.create({
  frame: { width: '100%', height: 190, marginBottom: 14 },
  map: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 24 },
  webMap: { flex: 1, borderRadius: 24, backgroundColor: '#E9EFEA' },
});