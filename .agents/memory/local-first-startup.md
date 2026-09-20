---
name: Local-first startup
description: The No Excuses mobile app must remain usable from persisted local data when auth or network readiness is delayed.
---

Persisted workout, regimen, schedule, activity, and rehab data should hydrate before requiring Clerk or network readiness. Network-dependent features can remain unavailable until connectivity and auth resolve, but they must not block local screens.

**Why:** Mobile launches can be offline or have slow auth/network handoffs; gating the entire navigation tree on those services makes a usable local plan appear frozen.

**How to apply:** Keep local hydration and reachability state independent from auth bootstrap, use conservative offline initialization on native, and make remote queries/actions explicitly conditional on network/auth availability.