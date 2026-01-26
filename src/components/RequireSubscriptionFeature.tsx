import { PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { AccessDenied } from "~/components/AccessDenied";

export type SubscriptionFeatureKey =
  | "hasQuotations"
  | "hasInvoices"
  | "hasStatements"
  | "hasOperations"
  | "hasPayments"
  | "hasCRM"
  | "hasProjectManagement"
  | "hasAssets"
  | "hasHR"
  | "hasMessages"
  | "hasAIAgent"
  | "hasAIInsights";

export function RequireSubscriptionFeature(
  props: PropsWithChildren<{
    feature?: SubscriptionFeatureKey;
    returnPath: "/contractor/dashboard" | "/property-manager/dashboard" | "/admin/dashboard";
    missingSubscriptionMessage?: string;
    missingFeatureMessage?: string;
  }>
) {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const subscriptionQuery = useQuery({
    ...trpc.getUserSubscription.queryOptions({
      token: token!,
    }),
    enabled: !!token,
  });

  if (!token) {
    return <AccessDenied returnPath={props.returnPath} message="Please sign in again." />;
  }

  if (subscriptionQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const subscription = subscriptionQuery.data;
  if (!subscription) {
    return (
      <AccessDenied
        returnPath={props.returnPath}
        message={
          props.missingSubscriptionMessage ??
          "This feature requires an active, paid subscription. Please upgrade your package or contact an administrator."
        }
      />
    );
  }

  if (props.feature) {
    const hasFeature = (subscription as any)?.package?.[props.feature] === true;
    if (!hasFeature) {
      return (
        <AccessDenied
          returnPath={props.returnPath}
          message={
            props.missingFeatureMessage ??
            "Your current subscription package does not include this feature. Please upgrade your package to continue."
          }
        />
      );
    }
  }

  return <>{props.children}</>;
}
