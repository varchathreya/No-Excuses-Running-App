---
name: React Query bundling
description: React Query context behavior in the Expo pnpm workspace
---

When generated hooks live in a workspace API package, Metro must resolve `@tanstack/react-query` to the same physical module used by the Expo root provider. A provider can exist in the root layout and still appear missing at runtime if pnpm workspace traversal produces duplicate module identities. If a Metro alias alone does not fix the device bundle, re-export `QueryClient` and `QueryClientProvider` from the shared API package and import them from that package in the Expo root layout.

**Why:** Native development bundles can resolve the app dependency and the workspace package dependency through different symlink paths, creating separate React Query contexts. The resulting error is `No QueryClient set` even though the layout visibly wraps the routes.

**How to apply:** Keep the provider at the Expo root, re-export its React Query primitives from the shared API package, and use Metro's `resolver.extraNodeModules` to pin `@tanstack/react-query` to the app's dependency path. Validate with a fresh Android bundle and a device smoke test after resolver changes.