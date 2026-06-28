// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  console.error("[error-capture] Recorded error:", error);
  if (error instanceof Error) {
    console.error("[error-capture] Error stack:", error.stack);
  }
  lastCapturedError = { error, at: Date.now() };
}

// Browser listeners
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

// Node.js listeners (for Vercel/Nitro server)
if (typeof process !== "undefined") {
  process.on("uncaughtException", (error) => {
    console.error("[error-capture] Uncaught Exception:", error);
    record(error);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[error-capture] Unhandled Rejection:", reason);
    record(reason);
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
