---
name: Android delivery
description: Platform constraint for testing and publishing Expo mobile apps from this workspace
---

Use Expo Go with the QR code from the running mobile preview for immediate Android testing. The project's Expo SDK family must match the Expo Go native runtime; do not describe one project build as compatible across multiple Expo Go SDK generations. The workspace's Expo Launch flow is for iOS App Store submission; it does not publish Android apps to Google Play.

**Why:** The user is working from Windows 10 and needs an Android test path first. Expo Go rejected the older project before launch when its native runtime and the project's SDK family differed, so the handoff must also distinguish SDK compatibility from device testing and store publishing.

**How to apply:** Keep the project aligned with the current Expo Go SDK used for device testing. Give Windows users QR/Expo Go instructions first, then explain when a custom development build is required and that Google Play release needs an Android-capable build/submission path outside Expo Launch.