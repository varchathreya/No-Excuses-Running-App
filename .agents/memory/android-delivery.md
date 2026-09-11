---
name: Android delivery
description: Platform constraint for testing and publishing Expo mobile apps from this workspace
---

Use Expo Go with the QR code from the running mobile preview for immediate Android testing. The project's Expo SDK family must match the Expo Go native runtime; do not describe one project build as compatible across multiple Expo Go SDK generations. The workspace's Expo Launch flow is for iOS App Store submission; it does not publish Android apps to Google Play.

**Why:** The user is working from Windows 10 and needs an Android test path first. Expo Go rejected the older project before launch when its native runtime and the project's SDK family differed, so the handoff must also distinguish SDK compatibility from device testing and store publishing.

**How to apply:** Keep the project aligned with the current Expo Go SDK used for device testing. Give Windows users QR/Expo Go instructions first, then explain when a custom development build is required and that Google Play release needs an Android-capable build/submission path outside Expo Launch.

For Windows development-APK delivery, an explicit Expo device selection can successfully choose the physical Motorola while the build still fails before installation. Treat `Incompatible magic value 0` and `Could not load compiled classes ... from cache` as generated Gradle-cache failures first; use the physical adb target explicitly and let the coding agent own cleanup, diagnostics, build, install, and launch.

**Why:** The device picker output is independent of Gradle's assemble step. Repeated cache errors can obscure that no new APK was installed, so device targeting and build/install verification must be reported separately.

**How to apply:** Require a build-success artifact path and an `adb -s <physical-serial> install` result before calling the APK installed. Do not fall back to an emulator or ask the user to run the final Expo command manually.