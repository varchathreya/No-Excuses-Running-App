---
name: Android map tiles
description: Why Android route maps use a non-Google tile fallback in Expo Go.
---

Use an attributed OpenStreetMap tile overlay on Android when the Google base layer cannot load, while retaining the native map view for route polylines, markers, and gestures.

**Why:** Expo Go SDK 57 has a confirmed Android regression where the map surface and Google attribution render but Google tiles remain blank across multiple device models. The Galaxy A71 5G is not the root cause, and app-level Google Maps key configuration cannot change the already-installed Expo Go binary.

**How to apply:** Keep required OpenStreetMap attribution visible. Treat a custom Android development build with a properly restricted Google Maps SDK key as the preferred production path; do not downgrade the SDK-aligned maps package solely to work around Expo Go.