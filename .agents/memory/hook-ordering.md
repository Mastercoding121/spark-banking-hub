---
name: React Hook Ordering (useServerFn before useQuery)
description: useServerFn must be declared before useQuery closures that reference it
---

## Rule
Declare all `useServerFn(...)` calls before any `useQuery({ queryFn: () => myFn({}) })` that references them.

**Why:** Closures capture variable bindings. While lazy evaluation means this works at runtime, putting useServerFn after useQuery is a code smell. Strict React rules require hooks to be called unconditionally in a consistent order; keeping useServerFn at the top of the component makes this clear.

**How to apply:** In any dashboard/page component that wraps server functions with useQuery.
