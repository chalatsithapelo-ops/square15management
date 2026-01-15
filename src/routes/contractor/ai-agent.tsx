import { createFileRoute, redirect } from "@tanstack/react-router";
import { AIAgentChat } from "~/components/AIAgentChat";
import { useAuthStore } from "~/stores/auth";
import { isContractorRole } from "~/utils/roles";

export const Route = createFileRoute("/contractor/ai-agent")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || !isContractorRole(user.role)) {
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
