---
name: Run linkage
description: Product rule separating spontaneous outdoor activities from planned workout completion
---

An outdoor activity may be recorded at any time. It only affects the workout plan when the user explicitly chooses the scheduled session for that day; otherwise it is saved as an unscheduled activity in history.

**Why:** The user wants spontaneous runs preserved without accidentally completing, rescheduling, or otherwise changing a planned workout.

**How to apply:** Persist an optional workout link on each activity. On completion, update a workout only when that link exists and is eligible for the current day. Keep unscheduled activities visible and clearly labeled in run history.