---
name: Expo Go authentication
description: Constraints and required session handling for Clerk Google authentication in Expo Go on Android.
---

Do not rely on Clerk Google SSO returning through Expo Go on Samsung Android devices. Use an installed development/production build with the `no-excuses` app scheme, gate app routing with `ClerkLoaded`, and activate the returned session before protected routes evaluate authentication.

**Why:** The canonical Expo Go `exp://` flow was confirmed to reopen the project in another Expo activity and lose the pending Clerk transaction, returning the user to sign-in. Expo Go controls its Android launch mode and the app cannot make that handoff reliable.

**How to apply:** For Google SSO, run Metro in development-client mode and use `AuthSession.makeRedirectUri` with the app-owned scheme. Expo Go can remain useful for non-auth UI checks only; offer email/password when an installable Android build is unavailable.