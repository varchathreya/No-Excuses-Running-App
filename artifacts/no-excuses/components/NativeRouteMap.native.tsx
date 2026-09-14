import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, Region, UrlTile } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { RoutePoint } from '@/context/AppContext';

export default function NativeRouteMap({ route, region, strokeColor, startColor, endColor }: { route: RoutePoint[]; region?: Region; strokeColor: string; startColor: string; endColor: string }) {
  if (Platform.OS === 'android') {
    return <AndroidRouteMap route={route} strokeColor={strokeColor} startColor={startColor} endColor={endColor} />;
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

function AndroidRouteMap({ route, strokeColor, startColor, endColor }: { route: RoutePoint[]; strokeColor: string; startColor: string; endColor: string }) {
  const webMap = useRef<WebView>(null);
  const routeRef = useRef(route);
  const mapReady = useRef(false);
  const initialHtml = useMemo(
    () => createOpenStreetMapHtml(route, strokeColor, startColor, endColor),
    [strokeColor, startColor, endColor],
  );
  const mapSource = useMemo(() => ({ html: initialHtml }), [initialHtml]);
  const updateRoute = useCallback((nextRoute: RoutePoint[]) => {
    const coordinates = nextRoute.map(({ latitude, longitude }) => [latitude, longitude]);
    webMap.current?.injectJavaScript(`if (typeof window.updateRoute === 'function') { window.updateRoute(${JSON.stringify(coordinates)}); } true;`);
  }, []);

  useEffect(() => {
    routeRef.current = route;
    if (mapReady.current) updateRoute(route);
  }, [route, updateRoute]);

  return (
    <View style={local.frame}>
      <WebView
        ref={webMap}
        originWhitelist={['*']}
        javaScriptEnabled
        source={mapSource}
        onLoadEnd={() => {
          mapReady.current = true;
          updateRoute(routeRef.current);
        }}
        style={local.webMap}
        scrollEnabled={false}
        automaticallyAdjustContentInsets={false}
      />
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
    html, body { height: 100%; width: 100%; margin: 0; background: #e9efea; overflow: hidden; }
    #map { position: absolute; inset: 0; background: #e9efea; }
    #route-fallback { position: absolute; inset: 0; z-index: 1000; pointer-events: none; background: #e9efea; }
    #route-fallback polyline { fill: none; stroke: ${strokeColor}; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
    #route-fallback circle { stroke: ${startColor}; stroke-width: 1.5; fill: ${startColor}; }
    #route-fallback circle.end { stroke: ${endColor}; fill: ${endColor}; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <svg id="route-fallback" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Offline route preview">
    <polyline id="fallback-line" points=""></polyline>
    <circle id="fallback-start" cx="0" cy="0" r="3"></circle>
    <circle id="fallback-end" class="end" cx="0" cy="0" r="3"></circle>
  </svg>
  <script>
    const fallback = document.getElementById('route-fallback');
    const fallbackLine = document.getElementById('fallback-line');
    const fallbackStart = document.getElementById('fallback-start');
    const fallbackEnd = document.getElementById('fallback-end');
    let currentRoute = ${routeJson};
    let map = null;
    let line = null;
    let markers = [];

    function renderFallback(route) {
      if (!Array.isArray(route) || route.length === 0) {
        fallbackLine.setAttribute('points', '');
        fallbackStart.setAttribute('r', '0');
        fallbackEnd.setAttribute('r', '0');
        return;
      }
      const lats = route.map((point) => point[0]);
      const lngs = route.map((point) => point[1]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const latSpan = Math.max(maxLat - minLat, 0.00005);
      const lngSpan = Math.max(maxLng - minLng, 0.00005);
      const points = route.map((point) => {
        const x = 8 + ((point[1] - minLng) / lngSpan) * 84;
        const y = 92 - ((point[0] - minLat) / latSpan) * 84;
        return x.toFixed(2) + ',' + y.toFixed(2);
      }).join(' ');
      fallbackLine.setAttribute('points', points);
      const first = points.split(' ')[0].split(',');
      const last = points.split(' ').slice(-1)[0].split(',');
      fallbackStart.setAttribute('cx', first[0]);
      fallbackStart.setAttribute('cy', first[1]);
      fallbackStart.setAttribute('r', '3');
      fallbackEnd.setAttribute('cx', last[0]);
      fallbackEnd.setAttribute('cy', last[1]);
      fallbackEnd.setAttribute('r', route.length > 1 ? '3' : '0');
    }

    function initLeaflet() {
      if (typeof L === 'undefined') return;
      map = L.map('map', { zoomControl: false, attributionControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      fallback.style.display = 'none';
      updateRoute(currentRoute);
    }

    function updateRoute(route) {
      currentRoute = route;
      renderFallback(route);
      if (!map) return;
      if (line) {
        map.removeLayer(line);
        line = null;
      }
      markers.forEach((marker) => map.removeLayer(marker));
      markers = [];
      if (!Array.isArray(route) || route.length === 0) return;
      line = L.polyline(route, { color: '${strokeColor}', weight: 5, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      markers.push(L.circleMarker(route[0], { radius: 7, color: '${startColor}', fillColor: '${startColor}', fillOpacity: 1, weight: 2 }).addTo(map));
      if (route.length > 1) {
        markers.push(L.circleMarker(route[route.length - 1], { radius: 7, color: '${endColor}', fillColor: '${endColor}', fillOpacity: 1, weight: 2 }).addTo(map));
        map.fitBounds(line.getBounds(), { padding: [24, 24] });
      } else {
        map.setView(route[0], 16);
      }
    }
    window.updateRoute = updateRoute;
    renderFallback(currentRoute);
    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletScript.onload = initLeaflet;
    leafletScript.onerror = () => { fallback.style.display = 'block'; };
    document.head.appendChild(leafletScript);
  </script>
</body>
</html>`;
}

const local = StyleSheet.create({
  frame: { width: '100%', height: 190, marginBottom: 14 },
  map: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 24 },
  webMap: { flex: 1, borderRadius: 24, backgroundColor: '#E9EFEA' },
});