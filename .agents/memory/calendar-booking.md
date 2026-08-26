---
name: Calendar booking
description: Product decision for how individual workout sessions are added to Google Calendar.
---

Individual workout booking should open Google Calendar's event-template flow rather than create an event immediately through the server. The user must be able to choose or edit the final date and time, matching the mobile “Add to calendar” behavior used by event platforms. Templates include a stable week/day marker so live calendar events can drive the app’s Booked state.

**Why:** The schedule contains recommended weekdays, but the user controls the actual appointment time and may need to adjust it around their calendar.

**How to apply:** Keep the per-session Book action as a mobile-safe Google Calendar template link. Match Booked against the calendar preview’s marker and refresh on app resume plus a short polling interval, so deleted events return to Book automatically.