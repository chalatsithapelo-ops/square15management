import { createFileRoute } from "@tanstack/react-router";
import { OhsWorkerView } from "~/components/OhsWorkerView";

export const Route = createFileRoute("/property-manager/ohs/")({
  component: () => <OhsWorkerView backTo="/property-manager/dashboard" />,
});
