import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMemo } from "react";
import * as z from "zod";
import toast from "react-hot-toast";
import { ArrowLeft, MessageSquare, Send, ThumbsUp } from "lucide-react";

import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute("/customer/feedback/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || user.role !== "CUSTOMER") {
      throw redirect({
        to: "/",
        search: { redirect: location.href },
      });
    }
  },
  component: TenantFeedbackPage,
});

const feedbackSchema = z.object({
  type: z.enum(["COMPLAINT", "COMPLEMENT"]),
  category: z.string().min(2, "Category is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

const categoryOptions = [
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "COMMUNICATION", label: "Communication" },
  { value: "BILLING", label: "Billing" },
  { value: "BUILDING", label: "Building" },
  { value: "SECURITY", label: "Security" },
  { value: "CLEANLINESS", label: "Cleanliness" },
  { value: "OTHER", label: "Other" },
];

function statusBadgeClass(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "IN_PROGRESS":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "RESOLVED":
      return "bg-green-50 text-green-700 border-green-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function TenantFeedbackPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const feedbackQuery = useQuery(
    trpc.getMyTenantFeedback.queryOptions(
      { token: token!, take: 50 },
      { enabled: !!token }
    )
  );

  const submitMutation = useMutation(
    trpc.submitTenantFeedback.mutationOptions({
      onSuccess: () => {
        toast.success("Submitted successfully!");
        form.reset({ type: "COMPLAINT", category: "MAINTENANCE", message: "" });
        queryClient.invalidateQueries({ queryKey: trpc.getMyTenantFeedback.queryKey({ token: token!, take: 50 }) });
      },
      onError: (error: any) => {
        toast.error(error?.message || "Failed to submit");
      },
    })
  );

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { type: "COMPLAINT", category: "MAINTENANCE", message: "" },
  });

  const items = useMemo(() => {
    const data = feedbackQuery.data;
    return Array.isArray(data) ? (data as any[]) : [];
  }, [feedbackQuery.data]);

  const counts = useMemo(() => {
    return {
      total: items.length,
      open: items.filter((i: any) => i.status === "OPEN").length,
      inProgress: items.filter((i: any) => i.status === "IN_PROGRESS").length,
      resolved: items.filter((i: any) => i.status === "RESOLVED").length,
    };
  }, [items]);

  const onSubmit = form.handleSubmit((data) => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    submitMutation.mutate({
      token,
      type: data.type,
      category: data.category,
      message: data.message,
    });
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                to="/customer/dashboard"
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to dashboard
              </Link>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 flex items-center">
              <MessageSquare className="h-8 w-8 mr-3 text-purple-600" />
              Complaints &amp; Compliments
            </h1>
            <p className="text-gray-600 mt-2">
              Send feedback to your property manager, categorized for better tracking.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Open</p>
            <p className="text-2xl font-bold text-gray-900">{counts.open}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-gray-900">{counts.inProgress}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Resolved</p>
            <p className="text-2xl font-bold text-gray-900">{counts.resolved}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Submit feedback</h2>
          </div>
          <form onSubmit={onSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  className="mt-1 w-full rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  {...form.register("type")}
                >
                  <option value="COMPLAINT">Complaint</option>
                  <option value="COMPLEMENT">Compliment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  className="mt-1 w-full rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  {...form.register("category")}
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {form.formState.errors.category && (
                  <p className="mt-1 text-sm text-red-600">
                    {form.formState.errors.category.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Message</label>
              <textarea
                rows={5}
                className="mt-1 w-full rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                placeholder="Describe your complaint or share your compliment..."
                {...form.register("message")}
              />
              {form.formState.errors.message && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.message.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors shadow-md"
            >
              <Send className="h-5 w-5 mr-2" />
              {submitMutation.isPending ? "Submitting..." : "Submit"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Your submissions</h2>
            <button
              onClick={() => feedbackQuery.refetch()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Refresh
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {feedbackQuery.isLoading && (
              <div className="p-6 text-gray-600">Loading...</div>
            )}

            {!feedbackQuery.isLoading && items.length === 0 && (
              <div className="p-6 text-gray-600">No feedback submitted yet.</div>
            )}

            {items.map((item: any) => (
              <div key={item.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {item.type === "COMPLEMENT" ? (
                        <ThumbsUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-purple-600" />
                      )}
                      <p className="font-semibold text-gray-900">
                        {item.type === "COMPLEMENT" ? "Complement" : "Complaint"} · {item.category}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${statusBadgeClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-gray-700 whitespace-pre-wrap">{item.message}</p>
                    <p className="mt-3 text-xs text-gray-500">
                      Submitted {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
