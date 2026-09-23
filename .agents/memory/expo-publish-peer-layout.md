---
name: Expo publish peer layout
description: Dependency layout required for Expo typed-route generation in artifact publishing
---

Expo artifact publishing can hoist `@expo/router-server` to the workspace root while leaving `expo-router` inside the mobile artifact. The router server then cannot resolve its `expo-router/_ctx-shared` peer during Metro startup.

**Why:** The publish build failed before bundling even though the packages were installed and the mobile TypeScript check passed. A direct artifact-level router-server dependency restored Node's peer lookup path.

**How to apply:** Keep `@expo/router-server` as a direct dependency of the Expo mobile artifact, aligned with the pinned Expo CLI/router versions, and update the existing lockfile importer without regenerating unrelated dependency versions.