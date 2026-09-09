---
name: Calendar booking
description: Product decision for how individual workout sessions are added to Google Calendar.
---

Individual workout booking should open Google Calendar's event-template flow rather than create an event immediately through the server. The user must be able to choose or edit the final date and time, matching the mobile “Add to calendar” behavior used by event platforms. Templates include a stable week/day marker so live calendar events from the connected backend account can drive the app’s Booked state.

**Why:** The schedule contains recommended weekdays, but the user controls the actual appointment time and may need to adjust it around their calendar. A template opened by an arbitrary phone account does not grant the backend access to that account's events.

**How to apply:** Keep the per-session Book action as a mobile-safe Google Calendar template link. An account-chooser button may switch the account used by Google Calendar links, but it does not replace the backend preview authorization. Only show Booked/time when the event is visible in the explicitly connected backend calendar, and label that account scope truthfully. Full account replacement requires per-user Google OAuth. Refresh on app resume plus a short polling interval.