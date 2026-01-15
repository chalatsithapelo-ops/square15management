import { createFileRoute, redirect } from "@tanstack/react-router";
import { AIAgentChat } from "../../components/AIAgentChat";
import { useAuthStore } from "~/stores/auth";

export const Route = createFileRoute("/property-manager/ai-agent")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || user.role !== "PROPERTY_MANAGER") {
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: AIAgentPage,
});

function AIAgentPage() {
  return <AIAgentChat />;
}
