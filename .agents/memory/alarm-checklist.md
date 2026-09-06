---
name: Alarm checklist
description: Product rule for representing alarms created through the Android Clock app
---

Treat native Clock alarms as user-confirmed checklist items, not device-verified state. Open Android Clock with the workout details prefilled, mark the corresponding workout checked when the user returns, and let the user manually uncheck it.

**Why:** Android does not expose another app’s saved alarms or confirm whether the Clock user pressed Save, changed the time, or later deleted the alarm. The user explicitly chose a manual checklist model for this limitation.

**How to apply:** Use wording such as “marked as set” and never claim that No Excuses has verified the native alarm. Keep checklist state persisted per workout.