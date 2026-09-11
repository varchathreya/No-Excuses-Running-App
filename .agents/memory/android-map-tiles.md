---
name: Android map tiles
description: Why Android route maps use OpenStreetMap in a WebView instead of native Google maps.
---

Use an attributed OpenStreetMap Leaflet view inside an Android WebView for route maps; do not instantiate react-native-maps on Android unless a restricted Google Maps SDK key is configured in the native build.

**Why:** Expo Go SDK 57 has a confirmed Android regression where the map surface and Google attribution render but Google tiles remain blank across multiple device models. More importantly, react-native-maps still initializes the Google native map service on Android even with mapType="none" and UrlTile, so a missing Maps key can crash the app before the OSM overlay renders.

**How to apply:** Keep required OpenStreetMap attribution visible. Use the WebView Leaflet route map for keyless Android development builds. A custom Android build with a properly restricted Google Maps SDK key remains an optional native-map path; do not downgrade the SDK-aligned maps package solely to work around Expo Go.