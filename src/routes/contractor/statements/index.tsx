import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useEffect, Fragment } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { RequireSubscriptionFeature } from "~/components/RequireSubscriptionFeature";
import {
  ArrowLeft,
  Plus,
  Search,
  FileText,
  Mail,
  Calendar,
  DollarSign,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit,
  X,
} from "lucide-react";
import { StatementPreview } from "~/components/StatementPreview";
import { Dialog, Transition } from "@headlessui/react";

export const Route = createFileRoute("/contractor/statements/")({
  component: StatementsPageGuarded,
});

function StatementsPageGuarded() {
  return (
    <RequireSubscriptionFeature feature="hasStatements" returnPath="/contractor/dashboard">
      <StatementsPage />
    </RequireSubscriptionFeature>
  );
}

const statementSchema = z.object({
  client_email: z.string().email("Invalid email address"),
  period_start: z.string().min(1, "Start date is required"),
  period_end: z.string().min(1, "End date is required"),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type StatementForm = z.infer<typeof statementSchema>;

const editStatementSchema = z.object({
  statement_number: z.string().min(1, "Statement number is required"),
  client_name: z.string().min(1, "Client name is required"),
  customerPhone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type EditStatementForm = z.infer<typeof editStatementSchema>;

function StatementsPage() {
  const { token, user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [shouldFetchCustomer, setShouldFetchCustomer] = useState(false);
  const [expandedStatementId, setExpandedStatementId] = useState<number | null>(null);
  const [editingStatement, setEditingStatement] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const statementsQuery = useQuery(
    trpc.getStatements.queryOptions({
      token: token!,
    })
  );

  const customerDetailsQuery = useQuery({
    ...trpc.getCustomerDetailsByEmail.queryOptions({
      token: token!,
      customerEmail: customerEmail,
    }),
    enabled: shouldFetchCustomer && customerEmail.length > 0 && customerEmail.includes("@"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<StatementForm>({
    resolver: zodResolver(statementSchema),
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<EditStatementForm>({
    resolver: zodResolver(editStatementSchema),
  });

  useEffect(() => {
    if (customerDetailsQuery.data) {
      setValue("customerName", customerDetailsQuery.data.customerName);
      setValue("customerPhone", customerDetailsQuery.data.customerPhone || "");
      setValue("address", customerDetailsQuery.data.address || "");
      setShouldFetchCustomer(false);
      toast.success("Customer details loaded!");
    }
  }, [customerDetailsQuery.data, setValue]);

  useEffect(() => {
    if (customerDetailsQuery.error) {
      toast.error("No customer found with this email");
      setShouldFetchCustomer(false);
    }
  }, [customerDetailsQuery.error]);

  const generateStatementMutation = useMutation(
    trpc.generateStatement.mutationOptions({
      onSuccess: () => {
        toast.success("Statement generation started! It will be ready shortly.");
        queryClient.invalidateQueries({ queryKey: trpc.getStatements.queryKey() });
        reset();
        setShowGenerateForm(false);
        
        // Poll for updates
        const interval = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: trpc.getStatements.queryKey() });
        }, 3000);
        
        setTimeout(() => clearInterval(interval), 30000);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate statement");
      },
    })
  );

  const statements = statementsQuery.data || [];

  const generateStatementPdfMutation = useMutation(
    trpc.generateStatementPdf.mutationOptions({
      onSuccess: (data, variables) => {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const statement = statements.find((s) => s.id === variables.statementId);
        link.download = `statement-${statement?.statement_number || variables.statementId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Statement PDF downloaded successfully!");
        setGeneratingPdfId(null);
      },
      onError: (error) => {
        // Handle authentication errors by clearing auth and redirecting
        if (error.data?.code === "UNAUTHORIZED") {
          clearAuth();
          toast.error("Your session has expired. Please log in again.");
          navigate({ to: "/" });
        } else {
          toast.error(error.message || "Failed to download statement PDF");
        }
        setGeneratingPdfId(null);
      },
    })
  );

  const updateStatementDetailsMutation = useMutation(
    trpc.updateStatementDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Statement updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getStatements.queryKey() });
        setShowEditModal(false);
        setEditingStatement(null);
        resetEdit();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update statement");
      },
    })
  );

  const handleEmailBlur = (email: string) => {
    if (email && email.includes("@") && email !== customerEmail) {
      setCustomerEmail(email);
      setShouldFetchCustomer(true);
    }
  };

  const onSubmit = (data: StatementForm) => {
    generateStatementMutation.mutate({
      token: token!,
      ...data,
    });
  };

  const handleDownloadPdf = (statementId: number) => {
    setGeneratingPdfId(statementId);
    generateStatementPdfMutation.mutate({
      token: token!,
      statementId,
    });
  };

  const handleEditStatement = (statement: any) => {
    setEditingStatement(statement.id);
    resetEdit({
      statement_number: statement.statement_number,
      client_name: statement.client_name,
      customerPhone: statement.customerPhone || "",
      address: statement.address || "",
      notes: statement.notes || "",
    });
    setShowEditModal(true);
  };

  const onSubmitEdit = (data: EditStatementForm) => {
    if (!editingStatement) return;
    
    updateStatementDetailsMutation.mutate({
      token: token!,
      statementId: editingStatement,
      ...data,
    });
  };

  const filteredStatements = statements.filter(
    (statement) =>
      statement.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      statement.client_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      statement.statement_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const completedStatements = statements.filter((s) => ["sent", "paid"].includes(s.status)).length;
  const generatingStatements = statements.filter((s) => s.status === "generated").length;
  const overdueStatements = statements.filter((s) => s.status === "overdue").length;

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: any }> = {
      generated: {
        label: "Generated",
        className: "bg-blue-100 text-blue-800",
        icon: Clock,
      },
      sent: {
        label: "Sent",
        className: "bg-indigo-100 text-indigo-800",
        icon: CheckCircle2,
      },
      viewed: {
        label: "Viewed",
        className: "bg-purple-100 text-purple-800",
        icon: CheckCircle2,
      },
      paid: {
        label: "Paid",
        className: "bg-green-100 text-green-800",
        icon: CheckCircle2,
      },
      overdue: {
        label: "Overdue",
        className: "bg-red-100 text-red-800",
        icon: AlertCircle,
      },
    };

    const badge = badges[status] || badges.generated;
    const Icon = badge.icon;

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}
      >
        <Icon className="h-3 w-3 mr-1" />
        {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/contractor/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-2 rounded-xl shadow-md">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Customer Statements</h1>
                <p className="text-sm text-gray-600">
                  {statements.length} total statements • Automatic overdue charges and payment tracking
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGenerateForm(!showGenerateForm)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-md transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              Generate Statement
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Overview</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-900 mb-1">{completedStatements}</div>
              <div className="text-xs font-medium px-2 py-1 rounded-full inline-block bg-green-100 text-green-800">
                Sent/Paid
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-900 mb-1">{generatingStatements}</div>
              <div className="text-xs font-medium px-2 py-1 rounded-full inline-block bg-blue-100 text-blue-800">
                Generated
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-900 mb-1">{overdueStatements}</div>
              <div className="text-xs font-medium px-2 py-1 rounded-full inline-block bg-red-100 text-red-800">
                Overdue
              </div>
            </div>
          </div>
        </div>

        {/* Generate Form */}
        {showGenerateForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate New Statement</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Email *
                  </label>
                  <input
                    type="email"
                    {...register("client_email")}
                    onBlur={(e) => handleEmailBlur(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errors.client_email && (
                    <p className="mt-1 text-sm text-red-600">{errors.client_email.message}</p>
                  )}
                  {customerDetailsQuery.isLoading && (
                    <p className="mt-1 text-xs text-blue-600 flex items-center">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Loading customer details...
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    {...register("customerName")}
                    placeholder="Will be auto-filled"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Phone
                  </label>
                  <input
                    type="text"
                    {...register("customerPhone")}
                    placeholder="Will be auto-filled"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    {...register("address")}
                    placeholder="Will be auto-filled"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period Start Date *
                  </label>
                  <input
                    type="date"
                    {...register("period_start")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errors.period_start && (
                    <p className="mt-1 text-sm text-red-600">{errors.period_start.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period End Date *
                  </label>
                  <input
                    type="date"
                    {...register("period_end")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errors.period_end && (
                    <p className="mt-1 text-sm text-red-600">{errors.period_end.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    {...register("notes")}
                    rows={3}
                    placeholder="Add any additional notes or instructions for this statement..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowGenerateForm(false);
                    reset();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateStatementMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {generateStatementMutation.isPending ? "Generating..." : "Generate Statement"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search statements..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Statements List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredStatements.map((statement) => (
              <div key={statement.id} className="hover:bg-gray-50 transition-colors">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {statement.statement_number}
                        </h3>
                        {getStatusBadge(statement.status)}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-600 mb-3">
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          {statement.client_email}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {new Date(statement.period_start).toLocaleDateString()} -{" "}
                          {new Date(statement.period_end).toLocaleDateString()}
                        </div>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                          Amount Due: R{(statement.total_amount_due ?? 0).toLocaleString()}
                        </div>
                        {(statement.total_interest ?? 0) > 0 && (
                          <div className="flex items-center text-red-600">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Interest: R{(statement.total_interest ?? 0).toLocaleString()}
                          </div>
                        )}
                        {statement.sent_date && (
                          <div className="flex items-center text-gray-600">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            Sent: {new Date(statement.sent_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {statement.invoice_ids?.length || 0} invoice(s) • Subtotal: R{(statement.subtotal ?? 0).toLocaleString()}
                      </div>
                      
                      {/* View Details Button */}
                      <button
                        onClick={() => setExpandedStatementId(expandedStatementId === statement.id ? null : statement.id)}
                        className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center"
                      >
                        {expandedStatementId === statement.id ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-1" />
                            View Full Statement Details
                          </>
                        )}
                      </button>

                      {statement.notes && (
                        <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                          <p className="text-xs font-medium text-blue-900 mb-1">Notes:</p>
                          <p className="text-xs text-blue-700">{statement.notes}</p>
                        </div>
                      )}
                      {statement.status === "overdue" && statement.errorMessage && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-red-900 mb-1">Error:</p>
                          <p className="text-sm text-red-700">{statement.errorMessage}</p>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex flex-col space-y-2">
                      <button
                        onClick={() => handleEditStatement(statement)}
                        className="px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors inline-flex items-center"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      {["sent", "paid", "viewed"].includes(statement.status) && (
                        <button
                          onClick={() => handleDownloadPdf(statement.id)}
                          disabled={
                            generateStatementPdfMutation.isPending && generatingPdfId === statement.id
                          }
                          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                        >
                          {generateStatementPdfMutation.isPending &&
                          generatingPdfId === statement.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Downloading...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-1" />
                              Download PDF
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Statement Details */}
                {expandedStatementId === statement.id && (
                  <div className="px-6 pb-6">
                    <div className="border-t border-gray-200 pt-4">
                      <StatementPreview statement={statement} />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredStatements.length === 0 && (
              <div className="p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No statements found</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Statement Modal */}
      <Transition appear show={showEditModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          if (!updateStatementDetailsMutation.isPending) {
            setShowEditModal(false);
            setEditingStatement(null);
            resetEdit();
          }
        }}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Edit Statement Details
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingStatement(null);
                        resetEdit();
                      }}
                      disabled={updateStatementDetailsMutation.isPending}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Statement Number *
                        </label>
                        <input
                          type="text"
                          {...registerEdit("statement_number")}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          You can edit this number if needed. It must be unique.
                        </p>
                        {editErrors.statement_number && (
                          <p className="mt-1 text-sm text-red-600">{editErrors.statement_number.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Client Name *
                        </label>
                        <input
                          type="text"
                          {...registerEdit("client_name")}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        {editErrors.client_name && (
                          <p className="mt-1 text-sm text-red-600">{editErrors.client_name.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          {...registerEdit("customerPhone")}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address
                        </label>
                        <input
                          type="text"
                          {...registerEdit("address")}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <textarea
                          {...registerEdit("notes")}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditModal(false);
                          setEditingStatement(null);
                          resetEdit();
                        }}
                        disabled={updateStatementDetailsMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updateStatementDetailsMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {updateStatementDetailsMutation.isPending ? "Updating..." : "Update Statement"}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
