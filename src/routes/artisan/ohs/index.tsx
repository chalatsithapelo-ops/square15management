import { createFileRoute } from "@tanstack/react-router";
import { OhsWorkerView } from "~/components/OhsWorkerView";

export const Route = createFileRoute("/artisan/ohs/")({
  component: () => <OhsWorkerView backTo="/artisan/dashboard" />,
});
