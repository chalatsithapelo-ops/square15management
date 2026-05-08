import { createFileRoute } from "@tanstack/react-router";
import { OhsWorkerView } from "~/components/OhsWorkerView";

export const Route = createFileRoute("/contractor/ohs/")({
  component: () => <OhsWorkerView backTo="/contractor/dashboard" />,
});
