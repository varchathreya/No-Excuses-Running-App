---
name: Android native build limits
description: Environment-specific constraints and workarounds for native Android release builds in this workspace.
---

The Nix-provided Android SDK can expose the NDK under a read-only `ndk-bundle` layout that Gradle cannot install into directly. A temporary writable SDK copy with accepted Android license markers is needed for native Gradle builds. On this container, full multi-ABI/new-architecture builds can exhaust the Gradle daemon; an experimental ARM64 build is more reliable with one Gradle worker, single-job CMake, and release lint excluded.

**Why:** Native release builds repeatedly failed from SDK license/layout issues, daemon memory pressure, and Android Lint Metaspace exhaustion before succeeding with the constrained build.

**How to apply:** Use this only for experimental artifact generation; production releases still need normal lint validation, full ABI requirements, and proper release signing.