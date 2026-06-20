---
name: Cookie API for TanStack Start
description: Correct import for getCookie/setCookie/deleteCookie in server functions
---

## Rule
Import cookie helpers from `@tanstack/start-server-core`, NOT from `vinxi/http`.

```ts
import { getCookie, setCookie, deleteCookie } from "@tanstack/start-server-core";
```

**Why:** `vinxi` is not installed as a standalone package in this project's dependency tree. The cookie API is re-exported from `@tanstack/start-server-core` which is the correct package.

**How to apply:** Any server function file that needs to read/write HTTP cookies.
