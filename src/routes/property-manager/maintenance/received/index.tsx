import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  XCircle,
  Eye,
  ArrowLeft,
  Edit2,
  FileText,
  AlertTriangle,
  Clock,
  AlertCircle,
  Send,
  Zap,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/property-manager/maintenance/received/")({
  component: PropertyManagerReceivedMaintenancePage,
});

function PropertyManagerReceivedMaintenancePage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"list" | "detail" | "convert">("list");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [convertAction, setConvertAction] = useState<"RFQ" | "ORDER" | null>(null);
  const [selectedContractorId, setSelectedContractorId] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  // Fetch received maintenance requests
  const requestsQuery = useQuery(
    trpc.getReceivedMaintenanceRequests.queryOptions(
      { token: token!, propertyManagerId: user?.id || 0 },
      { enabled: !!token && !!user }
    )
  );

  // Fetch contractors for order conversion
  const contractorsQuery = useQuery(
    trpc.getContractors.queryOptions(
      { token: token! },
      { enabled: !!token && convertAction === "ORDER" }
    )
  );

  // Approve request
  const approveMutation = useMutation(
    trpc.approveMaintenanceRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Maintenance request approved!");
        setView("list");
        setSelectedRequest(null);
        setApprovalNotes("");
        queryClient.invalidateQueries({ queryKey: trpc.getReceivedMaintenanceRequests.queryKey() });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to approve request");
      },
    })
  );

  // Reject request
  const rejectMutation = useMutation(
    trpc.rejectMaintenanceRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Maintenance request rejected");
        setView("list");
        setSelectedRequest(null);
        setRejectionReason("");
        queryClient.invalidateQueries({ queryKey: trpc.getReceivedMaintenanceRequests.queryKey() });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to reject request");
      },
    })
  );

  // Convert to RFQ
  const convertToRFQMutation = useMutation(
    trpc.convertMaintenanceToRFQ.mutationOptions({
      onSuccess: () => {
        toast.success("Converted to RFQ!");
        setView("list");
        setSelectedRequest(null);
        setConvertAction(null);
        queryClient.invalidateQueries({ queryKey: trpc.getReceivedMaintenanceRequests.queryKey() });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to convert to RFQ");
      },
    })
  );

  // Convert to Order
  const convertToOrderMutation = useMutation(
    trpc.convertMaintenanceToOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Converted to Order!");
        setView("list");
        setSelectedRequest(null);
        setConvertAction(null);
        setSelectedContractorId(null);
        queryClient.invalidateQueries({ queryKey: trpc.getReceivedMaintenanceRequests.queryKey() });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to convert to Order");
      },
    })
  );

  const requests = requestsQuery.data || [];
  const pendingRequests = requests.filter((r: any) => r.status === "RECEIVED");
  const approvedRequests = requests.filter((r: any) => r.status === "APPROVED");
  const rejectedRequests = requests.filter((r: any) => r.status === "REJECTED");
  const convertedRequests = requests.filter((r: any) => r.status === "CONVERTED");

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Zap className="h-8 w-8 mr-3 text-orange-600" />
            Received Maintenance Requests
          </h1>
          <p className="text-gray-600 mt-2">
            Review and approve maintenance requests from customers and contractors
          </p>
        </div>

        {/* List View */}
        {view === "list" && (
          <div className="space-y-6">
            {/* Status Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending Review</p>
                    <p className="text-2xl font-bold text-gray-900">{pendingRequests.length}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-400" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Approved</p>
                    <p className="text-2xl font-bold text-gray-900">{approvedRequests.length}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Rejected</p>
                    <p className="text-2xl font-bold text-gray-900">{rejectedRequests.length}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Converted</p>
                    <p className="text-2xl font-bold text-gray-900">{convertedRequests.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-purple-400" />
                </div>
              </div>
            </div>

            {/* Pending Requests (Action Required) */}
            {pendingRequests.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-blue-200 overflow-hidden">
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
                  <h3 className="font-semibold text-blue-900">Pending Review ({pendingRequests.length})</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {pendingRequests.map((request: any) => (
                    <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => {
                          setSelectedRequest(request);
                          setView("detail");
                        }}>
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-gray-900">{request.title}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              request.urgency === "URGENT" ? "bg-red-100 text-red-800" :
                              request.urgency === "HIGH" ? "bg-orange-100 text-orange-800" :
                              request.urgency === "NORMAL" ? "bg-blue-100 text-blue-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {request.urgency}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{request.description}</p>
                          <div className="flex gap-4 mt-3 text-sm">
                            <span className="text-gray-600">From: {request.customer?.firstName} {request.customer?.lastName}</span>
                            <span className="text-gray-600">Category: {request.category}</span>
                            <span className="text-gray-600">Received: {new Date(request.receivedDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setView("detail");
                          }}
                          className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Requests */}
            {approvedRequests.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-green-50 px-6 py-4 border-b border-green-200">
                  <h3 className="font-semibold text-green-900">Approved Requests</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {approvedRequests.map((request: any) => (
                    <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => {
                      setSelectedRequest(request);
                      setView("detail");
                    }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-gray-900">{request.title}</h4>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                              APPROVED
                            </span>
                          </div>
                          <div className="flex gap-4 mt-2 text-sm">
                            <span className="text-gray-600">From: {request.customer?.firstName} {request.customer?.lastName}</span>
                            <span className="text-gray-600">Approved: {new Date(request.approvedDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Eye className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rejected Requests */}
            {rejectedRequests.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-red-50 px-6 py-4 border-b border-red-200">
                  <h3 className="font-semibold text-red-900">Rejected Requests</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {rejectedRequests.map((request: any) => (
                    <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => {
                      setSelectedRequest(request);
                      setView("detail");
                    }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-gray-900">{request.title}</h4>
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                              REJECTED
                            </span>
                          </div>
                          <p className="text-sm text-red-700 mt-2">Reason: {request.rejectionReason}</p>
                        </div>
                        <Eye className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {requests.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Maintenance Requests</h3>
                <p className="text-gray-600">
                  Maintenance requests from customers will appear here
                </p>
              </div>
            )}
          </div>
        )}

        {/* Detail View */}
        {view === "detail" && selectedRequest && (
          <div className="space-y-6">
            <button
              onClick={() => {
                setView("list");
                setSelectedRequest(null);
              }}
              className="inline-flex items-center text-teal-600 hover:text-teal-700 font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Request Details */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedRequest.title}</h2>
                      <p className="text-sm text-gray-600 mt-1">{selectedRequest.requestNumber}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      selectedRequest.status === "APPROVED" ? "bg-green-100 text-green-800" :
                      selectedRequest.status === "REJECTED" ? "bg-red-100 text-red-800" :
                      selectedRequest.status === "CONVERTED" ? "bg-purple-100 text-purple-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {selectedRequest.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Urgency</p>
                      <p className="text-lg font-semibold text-gray-900 mt-2">{selectedRequest.urgency}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Category</p>
                      <p className="text-lg font-semibold text-gray-900 mt-2">{selectedRequest.category}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 uppercase tracking-wide">From</p>
                      <p className="text-lg font-semibold text-gray-900 mt-2">
                        {selectedRequest.customer?.firstName} {selectedRequest.customer?.lastName}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Received</p>
                      <p className="text-lg font-semibold text-gray-900 mt-2">
                        {new Date(selectedRequest.receivedDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedRequest.description}</p>
                  </div>

                  {selectedRequest.buildingName && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Location</h3>
                      <p className="text-gray-700">{selectedRequest.buildingName}</p>
                    </div>
                  )}

                  {selectedRequest.approvalNotes && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Approval Notes</h4>
                      <p className="text-sm text-blue-800">{selectedRequest.approvalNotes}</p>
                    </div>
                  )}

                  {selectedRequest.rejectionReason && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-900 mb-2">Rejection Reason</h4>
                      <p className="text-sm text-red-800">{selectedRequest.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Sidebar */}
              <div className="space-y-4">
                {selectedRequest.status === "RECEIVED" && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                    <h3 className="font-semibold text-gray-900">Approve or Reject</h3>

                    {/* Approval Notes Textarea */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Approval Notes (Optional)
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Add notes about this request..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      />
                    </div>

                    {/* Approve Button */}
                    <button
                      onClick={() => {
                        if (!token || !selectedRequest.id) return;
                        const user = useAuthStore.getState().user;
                        approveMutation.mutate({
                          token,
                          requestId: selectedRequest.id,
                          approvalNotes: approvalNotes || undefined,
                          approvedBy: user?.id || 0,
                        });
                      }}
                      disabled={approveMutation.isPending}
                      className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      {approveMutation.isPending ? "Approving..." : "Approve Request"}
                    </button>

                    {/* Rejection Reason Textarea */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rejection Reason (if rejecting)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why you're rejecting this request..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                      />
                    </div>

                    {/* Reject Button */}
                    <button
                      onClick={() => {
                        if (!rejectionReason.trim()) {
                          toast.error("Please provide a rejection reason");
                          return;
                        }
                        if (!token || !selectedRequest.id) return;
                        rejectMutation.mutate({
                          token,
                          requestId: selectedRequest.id,
                          rejectionReason: rejectionReason,
                        });
                      }}
                      disabled={rejectMutation.isPending}
                      className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="h-5 w-5" />
                      {rejectMutation.isPending ? "Rejecting..." : "Reject Request"}
                    </button>
                  </div>
                )}

                {selectedRequest.status === "APPROVED" && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                    <h3 className="font-semibold text-gray-900">Convert Request</h3>

                    <button
                      onClick={() => {
                        setConvertAction("RFQ");
                        setEditedTitle(selectedRequest.title);
                        setEditedDescription(selectedRequest.description);
                        setView("convert");
                      }}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <FileText className="h-5 w-5" />
                      Convert to RFQ
                    </button>

                    <button
                      onClick={() => {
                        setConvertAction("ORDER");
                        setEditedTitle(selectedRequest.title);
                        setEditedDescription(selectedRequest.description);
                        setView("convert");
                      }}
                      className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Send className="h-5 w-5" />
                      Convert to Order
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Convert View */}
        {view === "convert" && selectedRequest && convertAction && (
          <div className="space-y-6">
            <button
              onClick={() => {
                setView("detail");
                setConvertAction(null);
              }}
              className="inline-flex items-center text-teal-600 hover:text-teal-700 font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Details
            </button>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Convert to {convertAction}
              </h2>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  You can edit the details below before creating the {convertAction}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                {convertAction === "ORDER" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Contractor *
                    </label>
                    <select 
                      value={selectedContractorId || ""}
                      onChange={(e) => setSelectedContractorId(parseInt(e.target.value) || null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      required
                    >
                      <option value="">Choose a contractor...</option>
                      {(contractorsQuery.data as any)?.contractors?.map((contractor: any) => (
                        <option key={contractor.id} value={contractor.id}>
                          {contractor.companyName} - {contractor.companyEmail}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (!token || !selectedRequest.id) return;
                    const user = useAuthStore.getState().user;
                    
                    if (convertAction === "RFQ") {
                      convertToRFQMutation.mutate({
                        token,
                        requestId: selectedRequest.id,
                        title: editedTitle,
                        description: editedDescription,
                        propertyManagerId: user?.id || 0,
                      });
                    } else if (convertAction === "ORDER") {
                      if (!selectedContractorId) {
                        toast.error("Please select a contractor");
                        return;
                      }
                      convertToOrderMutation.mutate({
                        token,
                        requestId: selectedRequest.id,
                        contractorId: selectedContractorId,
                        title: editedTitle,
                        description: editedDescription,
                        propertyManagerId: user?.id || 0,
                      });
                    }
                  }}
                  disabled={convertToRFQMutation.isPending || convertToOrderMutation.isPending}
                  className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                >
                  {(convertToRFQMutation.isPending || convertToOrderMutation.isPending) ? "Converting..." : `Create ${convertAction}`}
                </button>
                <button
                  onClick={() => {
                    setView("detail");
                    setConvertAction(null);
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
