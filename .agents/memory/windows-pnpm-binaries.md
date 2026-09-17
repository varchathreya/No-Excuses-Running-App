---
name: Windows pnpm binaries
description: The local Windows Android workflow can resolve different pnpm binaries in the shell and preflight.
---

The Windows `C:\NE9` workflow has encountered a pnpm version mismatch: the interactive shell used pnpm 9.x while a preflight invocation resolved pnpm 12.x. Repeated frozen installs can therefore churn `node_modules` even when the lockfile is unchanged, and a later full reinstall may expose ignored-build warnings.

**Why:** The integration branch passed install, typecheck, and Android preflight, but the two pnpm binaries were not consistently selected.

**How to apply:** Treat this as environment/tooling follow-up rather than an application-sync failure. Keep frozen-install validation, avoid regenerating the lockfile to address it, and inspect the resolved pnpm binary before future Android verification runs.