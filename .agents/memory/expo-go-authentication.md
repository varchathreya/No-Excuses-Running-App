---
name: Expo Go authentication
description: Constraints and required session handling for Clerk Google authentication in Expo Go on Android.
---

Clerk Google SSO in Expo Go must use the SDK's canonical redirect URI, gate app routing with `ClerkLoaded`, and activate the returned session through Clerk's navigation callback before protected routes evaluate authentication.

**Why:** Android can route an Expo Go `exp://` OAuth return into another Expo activity. If the app evaluates protected routing before Clerk restores and activates the session, it returns to sign-in and appears to loop. Expo Go controls whether Android shows a second activity; app code cannot enforce its launch mode.

**How to apply:** Keep the canonical Clerk Expo SSO flow for QR testing and do not add custom timeout/deep-link wrappers around session completion. Use a custom Android build with the app's own scheme when eliminating Expo Go's extra activity behavior becomes a requirement.