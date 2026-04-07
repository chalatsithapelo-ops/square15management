import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import {
  ArrowLeft,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  AlertTriangle,
  Clock,
  Edit3,
  Search,
  Filter,
  Inbox,
  Bot,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Save,
} from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";

export const Route = createFileRoute("/admin/order-inbox/")({
  component: OrderInboxPage,
});

// ── Confidence badge colour ────────────────────────────────────────
function confidenceBadge(c: number) {
  if (c >= 0.85) return "bg-green-100 text-green-800";
  if (c >= 0.6) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function OrderInboxPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"PENDING_REVIEW" | "APPROVED" | "REJECTED">("PENDING_REVIEW");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Permission check
  const userPermissionsQuery = useQuery(
    trpc.getUserPermissions.queryOptions({ token: token! })
  );
  const isAdmin = userPermissionsQuery.data?.permissions.includes("VIEW_PAYMENT_REQUESTS") || false;

  // Fetch inbox
  const inboxQuery = useQuery({
    ...trpc.getOrderInbox.queryOptions({ token: token!, status: statusFilter }),
    enabled: !!token && isAdmin,
    refetchInterval: 30_000, // live refresh every 30s
  });

  // Review mutation
  const reviewMut = useMutation(
    trpc.reviewOrderEmail.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getOrderInbox.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        setExpandedId(null);
      },
    })
  );

  if (!isAdmin) return <AccessDenied />;

  const items = inboxQuery.data ?? [];
  const filtered = items.filter((i: any) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (i.fromEmail || "").toLowerCase().includes(q) ||
      (i.subject || "").toLowerCase().includes(q) ||
      (i.order?.customerName || "").toLowerCase().includes(q) ||
      (i.order?.orderNumber || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/admin/dashboard" className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <Inbox className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Order Email Inbox</h1>
        </div>
        <p className="text-sm text-gray-500">
          Emails are automatically parsed by AI and mapped to orders in <span className="font-semibold">PENDING REVIEW</span> status. Approve or reject below.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex items-center gap-1 bg-white rounded-lg border p-1">
          {(["PENDING_REVIEW", "APPROVED", "REJECTED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                statusFilter === s
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {s === "PENDING_REVIEW" ? "Pending" : s === "APPROVED" ? "Approved" : "Rejected"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by email, name, order..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <span className="text-sm text-gray-500">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Loading / Empty */}
      {inboxQuery.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="ml-2 text-gray-500">Loading inbox…</span>
        </div>
      )}
      {!inboxQuery.isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Mail className="w-12 h-12 mb-2" />
          <p>No {statusFilter === "PENDING_REVIEW" ? "pending" : statusFilter.toLowerCase()} order emails</p>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-4">
        {filtered.map((item: any) => (
          <InboxCard
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onReview={(action, edits, notes) =>
              reviewMut.mutate({
                token: token!,
                emailSourceId: item.id,
                action,
                edits,
                reviewNotes: notes,
              })
            }
            isReviewing={reviewMut.isPending}
          />
        ))}
      </div>
    </div>
  );
}

// ── Individual inbox card ──────────────────────────────────────────
function InboxCard({
  item,
  expanded,
  onToggle,
  onReview,
  isReviewing,
}: {
  item: any;
  expanded: boolean;
  onToggle: () => void;
  onReview: (action: "APPROVE" | "REJECT", edits?: any, notes?: string) => void;
  isReviewing: boolean;
}) {
  const order = item.order;
  const ai = item.aiExtracted as any;

  // Editable fields (for admin corrections before approval)
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState({
    customerName: order?.customerName || "",
    customerEmail: order?.customerEmail || "",
    customerPhone: order?.customerPhone || "",
    address: order?.address || "",
    serviceType: order?.serviceType || "",
    description: order?.description || "",
    notes: order?.notes || "",
  });
  const [reviewNotes, setReviewNotes] = useState("");

  const isPending = item.status === "PENDING_REVIEW";

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              item.status === "PENDING_REVIEW"
                ? "bg-amber-100 text-amber-600"
                : item.status === "APPROVED"
                ? "bg-green-100 text-green-600"
                : "bg-red-100 text-red-600"
            }`}
          >
            {item.status === "PENDING_REVIEW" ? (
              <Clock className="w-5 h-5" />
            ) : item.status === "APPROVED" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 truncate">{item.fromName || item.fromEmail}</span>
              {order && (
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                  {order.orderNumber}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">{item.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceBadge(item.aiConfidence)}`}>
            <Bot className="w-3 h-3 inline mr-0.5 -mt-0.5" />
            {(item.aiConfidence * 100).toFixed(0)}%
          </span>
          <span className="text-xs text-gray-400">
            {new Date(item.receivedAt).toLocaleDateString("en-ZA", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-5 py-4 space-y-5">
          {/* Email preview */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1">Email Preview</h4>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {item.bodyPreview || "No body preview available"}
            </div>
          </div>

          {/* AI-Extracted fields */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-semibold uppercase text-gray-400">AI-Extracted Order Data</h4>
              {isPending && (
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="ml-auto text-xs text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> {editMode ? "Cancel Edit" : "Edit Before Approve"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ["Customer Name", "customerName"],
                ["Email", "customerEmail"],
                ["Phone", "customerPhone"],
                ["Address", "address"],
                ["Service Type", "serviceType"],
              ] as const).map(([label, key]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500">{label}</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={edits[key]}
                      onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
                      className="w-full border rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{order?.[key] || "-"}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Description — full width */}
            <div className="mt-3">
              <label className="text-xs text-gray-500">Description</label>
              {editMode ? (
                <textarea
                  value={edits.description}
                  onChange={(e) => setEdits({ ...edits, description: e.target.value })}
                  rows={3}
                  className="w-full border rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              ) : (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{order?.description || "-"}</p>
              )}
            </div>

            {order?.notes && (
              <div className="mt-2">
                <label className="text-xs text-gray-500">Notes / Urgency</label>
                {editMode ? (
                  <input
                    type="text"
                    value={edits.notes}
                    onChange={(e) => setEdits({ ...edits, notes: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-700">{order.notes}</p>
                )}
              </div>
            )}
          </div>

          {/* Low confidence warning */}
          {item.aiConfidence < 0.6 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <span className="font-semibold">Low confidence extraction.</span> The AI couldn't find all required fields clearly.
                Please review the email body carefully and edit before approving.
              </div>
            </div>
          )}

          {/* Reviewer info for already-reviewed */}
          {item.reviewedBy && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <UserCheck className="w-4 h-4" />
              Reviewed by <span className="font-semibold">{item.reviewedBy.name}</span>
              {item.reviewedAt && <span>on {new Date(item.reviewedAt).toLocaleDateString("en-ZA")}</span>}
              {item.reviewNotes && <span className="ml-2 italic">— {item.reviewNotes}</span>}
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Review notes (optional)</label>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex gap-2 items-end">
                <button
                  onClick={() => onReview("APPROVE", editMode ? edits : undefined, reviewNotes || undefined)}
                  disabled={isReviewing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                  {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Approve → PENDING
                </button>
                <button
                  onClick={() => onReview("REJECT", undefined, reviewNotes || undefined)}
                  disabled={isReviewing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
