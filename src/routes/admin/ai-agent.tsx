import { createFileRoute } from "@tanstack/react-router";
import { AIAgentChat } from "~/components/AIAgentChat";

export const Route = createFileRoute("/admin/ai-agent")({
  component: AIAgentPage,
});

function AIAgentPage() {
  return <AIAgentChat />;
}
