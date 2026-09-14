---
name: Stable Android releases
description: How to preserve a tested standalone APK and its matching No Excuses source state
---

For a tested standalone Android release, preserve two separate artifacts: an annotated Git tag for the source/build configuration and the exact APK file with a SHA-256 checksum. Do not rely on Git alone to recreate the identical APK later.

**Why:** The APK embeds the JavaScript bundle, environment values, dependency outputs, and native Gradle artifacts. A later rebuild from the same source can differ, while an APK stored only on the Windows build machine can be lost or overwritten.

**How to apply:** Before changing release-tested code, tag the exact source commit and copy the tested APK to a versioned archive outside transient build directories. Record the APK path, SHA-256, package name, version code, and the API/Clerk environment pairing without storing secrets.