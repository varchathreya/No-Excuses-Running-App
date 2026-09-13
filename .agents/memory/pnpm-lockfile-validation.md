---
name: Pnpm lockfile validation
description: Workspace-specific recovery for pnpm reporting a missing peer-qualified lockfile entry without a dependency diff.
---

The repository lockfile can be byte-identical to the committed version while pnpm’s install state still reports a missing peer-qualified dependency during a full frozen install. Refresh the existing lockfile with the repository’s pnpm version using `pnpm install --lockfile-only --offline --no-frozen-lockfile`, then run a full `pnpm install --frozen-lockfile`. Do not replace the lockfile with a pnpm 9/12 regeneration unless a broad dependency rewrite is intended.

**Why:** Alternate pnpm versions rewrote thousands of entries and removed platform-package overrides even though the actual issue was resolved without changing the committed dependency graph.

**How to apply:** When publish reports `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`, preserve the current lockfile, run the offline refresh with the project’s pnpm, and validate with a normal frozen install before changing package manifests or dependency versions.