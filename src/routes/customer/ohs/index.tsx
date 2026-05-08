import { createFileRoute } from "@tanstack/react-router";
import { OhsWorkerView } from "~/components/OhsWorkerView";

export const Route = createFileRoute("/customer/ohs/")({
  component: () => <OhsWorkerView backTo="/customer/dashboard" />,
});
