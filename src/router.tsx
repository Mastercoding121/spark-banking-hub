import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Disable all queries during SSR — server-executed queryFns produce data
        // the client cache doesn't have, causing hydration mismatch. Let all data
        // load client-side so server and client both start from the same empty state.
        enabled: typeof window !== "undefined",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
