# No Excuses — Device Test Report (Pass/Fail)

- **Device**: Moto G5 Plus, serial `ZY224LNJKD`, Android 8.1
- **App**: `com.noexcuses.app` — Expo (SDK), expo-dev-client, debug build (armeabi-v7a)
- **Date on device**: 2026-09-15 (Tuesday, Week 1)
- **Backend**: Replit API — **DOWN during testing** (HTTP 404 placeholder on all endpoints)
- **Evidence**: uiautomator dumps `ui_*.xml`, screenshots, Pixel analysis at `C:\Users\VARCH_~1\AppData\Local\Temp\opencode\ne9-shots\`

## Test Summary

| Area | Result | Evidence |
|---|---|---|
| Build + install + launch | PASS | Google Play-style candybar icon, `com.noexcuses.app` on device |
| Metro / dev client start | PASS | adb reverse tcp:8082, Connect button rejoins session |
| Schedule (weeks 1–8, 7 sessions, all protocols) | PASS | ui_96–ui_100: Protocol A/B/C branding, Progression Loading, High Step Frequency, isometrics, HSR Strength Routine 3 (W5) + Routine 4 (W8), rest days, "Week N plan · 7 sessions" |
| Wrong-day blocking dialog | PASS | "Please wait until Week N, DayName" + "This planned session can only be completed on its scheduled day…" |
| Rehab isometric routine | PASS | ui_101–ui_103: timed hold (0→start), countdown, Pause freeze at 00:04, SET 1→2→3→4 auto-advance, segmented dashed set indicator, DONE badges, "Complete workout" → Schedule marks TUE DONE |
| Rehab persistence (force-stop) | PASS | ui_104: DONE state retained after relaunch |
| Run tracking (GPS session) | PASS | ui_105–ui_107: GPS READY badge, Start → live session → auto-pause at 00:26 → Finish → summary "0.00 km / 01:00 / AVG PACE —/km / GPS POINTS 1"; history 9→10 |
| Offline mode toggle | PASS | Red chip → "You're offline" banner; green chip while online (pixel-verified) |
| Offline run preservation | PASS | Run started, ran, finished, saved entirely while offline; run detail shows OFFLINE chip + "SAVED" pill + "Unscheduled outdoor run" + timestamp `9/15/2026 11:11:15 AM`; history incremented to "10 saved runs" even after returning ONLINE |
| Calendar Book → GCal | PASS | "Book" on WED row → Google Calendar opened with event "No Excuses · W1D3 · Protocol A · Brisk Walk", Wed Sep 23 2026, 6:00–6:30 AM |
| Alarm → Android Clock | PASS | "Set 6:00 AM alarm" → `android.intent.action.SET_ALARM` → Android Clock "Wednesday / No Excuses · Protocol A · Brisk Walk / 6:00 AM / ON" |
| Alarm confirm dialog | PASS | "Did you save the alarm?" → "Mark as set" → WED row shows "Alarm set" |
| Auth guard (logout/relogin) | PASS | Deleted Clerk prefs (clerk_preferences.xml + SecureStore.xml via run-as), force-stop, relaunch → redirected to `/sign-in`; "Continue with Google" button shown |
| Google OAuth (chooser + consent) | PASS | Chrome opens accounts.google.com → account "Varchas Athreya / varchathreya@gmail.com" → consent "You're signing back in to Clerk" → Continue tapped |
| OAuth callback → app | **FAIL** | Redirect `no-excuses://oauth` opened the app, but Expo Router showed "Oops! This screen doesn't exist." → no `/oauth` route registered; Clerk session NOT restored |
| Calendar Link Account | **BLOCKED** | Replit API returns HTTP 404 placeholder ("Run this app to see the results here") for all `/api/*`; app correctly showed "Calendar connection failed" alert |

## OAuth Callback Failure — Detail

- `signUp.create({ strategy: "oauth_google" })` produces a redirect URL that returns to `no-excuses://oauth?...`
- `AndroidManifest` intent-filter handles `no-excuses://` (act=VIEW, BROWSABLE) → MainActivity
- No Expo Router route for `/oauth` → router falls to "Oops! This screen doesn't exist."
- Clerk does not implant a listener to consume `/oauth` before the router.
- Result: user cannot complete Google sign-in from the device.

**Suggested fix**: register a handler/route for `no-excuses://oauth` and hand the URL to Clerk (`signIn.handleOAuthRedirect` / equivalent), or configure OAuth redirect to append `#/` home (e.g. `no-excuses://home?...`) so the router navigates to tabs after the SDK completes the exchange.

## Blocked / Not Eligible During Test Session
- Calendar sync / API flows: Replit web service offline — cannot wake from workstation.
- HSR / rest-day / gait-day rehab UI: date-gated to future scheduled days by design; verified only in code.