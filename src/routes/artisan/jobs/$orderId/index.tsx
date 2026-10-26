import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { ArrowLeft, Building2, MapPin, Briefcase, Loader2 } from "lucide-react";
import { CrewPanel } from "~/components/CrewPanel";
import { ExpensesPanel } from "~/components/ExpensesPanel";

export const Route = createFileRoute("/artisan/jobs/$orderId/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const { user } = useAuthStore.getState();
    if (!user || (user.role !== "ARTISAN" && user.role !== "CONTRACTOR")) {
      throw redirect({ to: "/" });
    }
  },
  component: ArtisanJobDetail,
});

function ArtisanJobDetail() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { orderId: orderIdStr } = Route.useParams();
  const orderId = parseInt(orderIdStr, 10);

  if (!token || !user) return null;

  const orders = useQuery(trpc.getOrders.queryOptions({ token }));
  const order = orders.data?.find((o: any) => o.id === orderId);

  if (orders.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" />Loading…</div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link to="/artisan/dashboard" className="text-gray-600 hover:text-gray-900"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="text-lg font-semibold">Job not found</h1>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-8 text-center text-gray-600">
          You don't have access to this job, or it doesn't exist.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/artisan/dashboard" className="text-gray-600 hover:text-gray-900"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{order.orderNumber}</h1>
            <p className="text-xs text-gray-500 truncate">{order.serviceType}</p>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-gray-100">{order.status}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-lg shadow border p-4 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4" />Job</h2>
          <p className="text-sm text-gray-800">{order.description}</p>
          {order.clientBuilding && (
            <div className="text-sm text-gray-600 flex items-center gap-2"><Building2 className="w-4 h-4" />{order.clientBuilding.name}</div>
          )}
          {order.address && (
            <div className="text-sm text-gray-600 flex items-center gap-2"><MapPin className="w-4 h-4" />{order.address}</div>
          )}
        </div>

        <CrewPanel orderId={order.id} />

        <ExpensesPanel orderId={order.id} orderNumber={order.orderNumber} />

        <div className="bg-white rounded-lg shadow border p-4 text-sm text-gray-700">
          To start, pause, log time or complete this job, open it from your{" "}
          <Link to="/artisan/dashboard" className="text-indigo-700 hover:underline">dashboard</Link>.
          Only the <b>lead</b> can mark the job complete.
        </div>
      </div>
    </div>
  );
}
