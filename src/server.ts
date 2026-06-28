import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  console.log("[server] Loading server entry...");
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => {
        console.log("[server] Successfully loaded server entry");
        return (m.default ?? m) as ServerEntry;
      },
    ).catch((err) => {
      console.error("[server] Failed to load server entry:", err);
      throw err;
    });
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  console.log("[server] Processing response, status:", response.status);
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  console.log("[server] 500 JSON response body:", body);
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const lastError = consumeLastCapturedError();
  console.error("[server] Captured catastrophic SSR error:", lastError ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    console.log("[server] Incoming request:", request.method, request.url);
    const url = new URL(request.url);

    // Direct health check route to bypass all other handlers
    if (url.pathname === "/health") {
      console.log("[server] Direct health check!");
      return new Response("OK", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const result = await normalizeCatastrophicSsrResponse(response);
      console.log("[server] Outgoing response status:", result.status);
      return result;
    } catch (error) {
      console.error("[server] Unhandled fetch error:", error);
      console.error("[server] Error stack:", error instanceof Error ? error.stack : "No stack");
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
