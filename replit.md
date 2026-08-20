# No Excuses

An Android-first beginner running and rehabilitation app that turns intent into action with structured weekly scheduling, guided rehab timers, GPS sessions, and progress metrics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/no-excuses run typecheck` — typecheck the mobile app
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/no-excuses/` — Expo mobile app
- `artifacts/no-excuses/context/AppContext.tsx` — local-first schedule and completion state
- `artifacts/no-excuses/app/(tabs)/` — Today, Schedule, Run, Rehab, and Progress screens
- `artifacts/no-excuses/constants/colors.ts` — No Excuses visual tokens

## Architecture decisions

- The first build is local-first using AsyncStorage so it can be tested immediately without an account or backend.
- Real foreground location permission is requested when an outdoor session starts; the run map is intentionally lightweight and Expo Go compatible.
- Native exact alarms, calendar sync, and push notifications are reserved for a native integration pass rather than simulated in-app.

## Product

- Seven-day beginner plan with individual scheduling and multi-schedule controls.
- Today dashboard with the next workout, compliance, and readiness guidance.
- GPS-ready outdoor session screen with live timer, distance/pace telemetry surface, and finish feedback.
- Rehab routine with ordered exercises, isometric countdowns, set tracking, and haptics.
- Progress dashboard with readiness score, mileage, consistency grid, and unlock guidance.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
