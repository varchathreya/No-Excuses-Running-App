---
name: Clerk Android environments
description: How Replit-managed Clerk Development and Production environments affect standalone Android APK testing.
---

Replit-managed Clerk has separate Development and Production environments. A locally built standalone APK normally receives the workspace `pk_test` key, while a published API uses Production credentials. Sending a Development session token to the Production API is an expected environment mismatch, not evidence of a second app that can be repaired by rebuilding with the same workspace key.

**Why:** The published Clerk proxy reported a production environment, while the workspace key and Expo logs reported development keys. The production API correctly returned `AUTH_REQUIRED` without a token, and the local APK bundle contained the workspace key.

**How to apply:** For a directly testable standalone APK, pair the workspace key with the development API host. For a production-target APK, use the supported release pipeline that supplies the Production publishable key; an OpenCode/local rebuild alone cannot manufacture that key.