import { QueryClientProvider } from "@tanstack/react-query";
import {
  loggerLink,
  splitLink,
  httpBatchStreamLink,
  httpBatchLink,
  httpSubscriptionLink,
  createTRPCClient,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import SuperJSON from "superjson";

import { AppRouter } from "~/server/trpc/root";
import { getQueryClient } from "./query-client";

// Now, with the newer @trpc/tanstack-react-query package, we no longer need createTRPCReact.
// We use createTRPCContext instead.
const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

// Export a `trpc` object for compatibility with existing code
const trpc = {
  useQuery: useTRPC,
  useMutation: useTRPC,
  useSubscription: useTRPC,
};

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return `http://localhost:3000`;
}

// Create a standalone client instance for use outside React components
const client = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (op) =>
        process.env.NODE_ENV === "development" ||
        (op.direction === "down" && op.result instanceof Error),
    }),
    splitLink({
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({
        transformer: SuperJSON,
        url: getBaseUrl() + "/trpc",
      }),
      false: splitLink({
        condition: (op) => op.type === "mutation",
        true: httpBatchLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/trpc",
          maxURLLength: Infinity,
        }),
        false: httpBatchStreamLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/trpc",
        }),
      }),
    }),
  ],
});

export { useTRPC, useTRPCClient, client, trpc };

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        splitLink({
          condition: (op) => op.type === "subscription",
          true: httpSubscriptionLink({
            transformer: SuperJSON,
            url: getBaseUrl() + "/trpc",
          }),
          false: splitLink({
            condition: (op) => op.type === "mutation",
            true: httpBatchLink({
              transformer: SuperJSON,
              url: getBaseUrl() + "/trpc",
              maxURLLength: Infinity,
            }),
            false: httpBatchStreamLink({
              transformer: SuperJSON,
              url: getBaseUrl() + "/trpc",
            }),
          }),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
