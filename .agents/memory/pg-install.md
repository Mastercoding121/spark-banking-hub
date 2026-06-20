---
name: pg Package Installation
description: pg must be manually installed; it is not bundled
---

## Rule
Always install `pg` and `@types/pg` explicitly: `bun add pg @types/pg`.

**Why:** TanStack Start does not bundle pg. It throws `Cannot find module 'pg'` at runtime when server functions try to use the pool.

**How to apply:** Any project that uses PostgreSQL via the `pg` npm package.
