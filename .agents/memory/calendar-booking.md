---
name: Calendar booking
description: Product decision for how individual workout sessions are added to Google Calendar.
---

Individual workout booking should open Google Calendar's event-template flow rather than create an event immediately through the server. The user must be able to choose or edit the final date and time, matching the mobile “Add to calendar” behavior used by event platforms. Templates include a stable week/day marker so live calendar events from the connected backend account can drive the app’s Booked state.

**Why:** The schedule contains recommended weekdays, but the user controls the actual appointment time and may need to adjust it around their calendar. A template opened by an arbitrary phone account does not grant the backend access to that account's events. The project-level Replit Calendar connector must not be used as a substitute because it exposes one shared account to every app user.

**How to apply:** Keep Clerk for app identity only. Authorize Calendar with the app-owned Google OAuth client and an HTTPS server callback, store encrypted refresh tokens per Clerk user, and request only `calendar.readonly`. Installed Android builds should return from the server callback through the app-owned scheme; Expo Go can only use a browser plus app-resume refresh. Only show Booked/time when the event is visible in that user's connected calendar. On the immediate post-Clerk navigation, wait for a fresh Clerk token before starting protected Calendar OAuth; account switching can reauthorize directly because the per-user connection upsert replaces the stored refresh token.