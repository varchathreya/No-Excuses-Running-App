---
name: Clerk Android environments
description: How Replit-managed Clerk Development and Production environments affect standalone Android APK testing.
---

Replit-managed Clerk has separate Development and Production environments. A locally built standalone APK normally receives the workspace `pk_test` key, while a published API uses Production credentials. Sending a Development session token to the Production API is an expected environment mismatch, not evidence of a second app that can be repaired by rebuilding with the same workspace key.

**Why:** The published Clerk proxy reported a production environment, while the workspace key and Expo logs reported development keys. The production API correctly returned `AUTH_REQUIRED` without a token, and the local APK bundle contained the workspace key.

**How to apply:** For a directly testable standalone APK, pair the workspace key with the development API host. For a production-target APK, use the supported release pipeline that supplies the Production publishable key; an OpenCode/local rebuild alone cannot manufacture that key.

The mobile app can now resolve the matching publishable key at startup from the API's public mobile-auth configuration endpoint, so a production-target APK does not need to embed either Development or Production Clerk keys. The API deployment must include that endpoint before the APK can authenticate.

**Why:** This avoids baking a Development key into an APK pointed at Production and keeps the public client configuration owned by the same environment that validates the session.

**How to apply:** Publish the API route first, then install the production-target APK. The app should receive `pk_live_` from Production and `pk_test_` from Development previews.