import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { X, Download, FileText, TrendingUp, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { ContractorDocumentsTab } from "./ContractorDocumentsTab";
import { ContractorKPIsTab } from "./ContractorKPIsTab";

interface ContractorDetailsModalProps {
  contractor: any;
  isOpen: boolean;
  onClose: () => void;
}

export function ContractorDetailsModal({ contractor, isOpen, onClose }: ContractorDetailsModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState<"overview" | "performance" | "kpis" | "spending" | "documents">("overview");

  // Fetch performance data
  const performanceQuery = useQuery(
    trpc.getContractorPerformance.queryOptions({
      token: token!,
      contractorId: contractor.id,
    })
  );

  // Fetch spending data
  const spendingQuery = useQuery(
    trpc.getContractorSpending.queryOptions({
      token: token!,
      contractorId: contractor.id,
    })
  );

  // Fetch documents
  const documentsQuery = useQuery(
    trpc.getContractorDocuments.queryOptions({
      token: token!,
      contractorId: contractor.id,
    })
  );

  if (!isOpen) return null;

  const performance = performanceQuery.data;
  const spending = spendingQuery.data;
  const documents = documentsQuery.data?.documents || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-full sm:max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {contractor.firstName} {contractor.lastName}
            </h2>
            <p className="text-sm text-gray-600">{contractor.companyName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-0 px-6">
            {[
              { id: "overview", label: "Overview" },
              { id: "performance", label: "Performance" },
              { id: "kpis", label: "KPIs" },
              { id: "spending", label: "Spending" },
              { id: "documents", label: "Documents" },
            ].map((tab: any) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Email</label>
                    <p className="text-gray-900">{contractor.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Service Type</label>
                    <span className="inline-block bg-teal-100 text-teal-800 px-3 py-1 rounded text-sm font-medium mt-1">
                      {contractor.serviceType}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Status</label>
                    <span
                      className={`inline-block px-3 py-1 rounded text-sm font-medium mt-1 ${
                        contractor.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : contractor.status === "INACTIVE"
                          ? "bg-gray-100 text-gray-800"
                          : contractor.status === "SUSPENDED"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {contractor.status}
                    </span>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Jobs Completed</label>
                    <p className="text-2xl font-bold text-gray-900">{contractor.totalJobsCompleted || 0}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Average Rating</label>
                    <p className="text-2xl font-bold text-gray-900">
                      {(contractor.averageRating || 0).toFixed(1)} / 5
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Total Spent</label>
                    <p className="text-2xl font-bold text-gray-900">R {(contractor.totalSpent || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === "performance" && (
            <div className="space-y-6">
              {performanceQuery.isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading performance data...</div>
              ) : performance ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">On-Time Completion Rate</p>
                          <p className="text-2xl font-bold text-blue-600 mt-1">
                            {(performance.onTimeCompletionRate || 0).toFixed(1)}%
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-blue-400" />
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Quality Score</p>
                          <p className="text-2xl font-bold text-green-600 mt-1">
                            {(performance.qualityScore || 0).toFixed(1)} / 10
                          </p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                      </div>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Customer Satisfaction</p>
                          <p className="text-2xl font-bold text-orange-600 mt-1">
                            {(performance.customerSatisfactionScore || 0).toFixed(1)} / 10
                          </p>
                        </div>
                        <AlertCircle className="w-8 h-8 text-orange-400" />
                      </div>
                    </div>
                  </div>

                  {performance.description && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Performance Notes</h4>
                      <p className="text-gray-700 text-sm leading-relaxed">{performance.description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No performance data available</div>
              )}
            </div>
          )}

          {/* KPIs Tab */}
          {activeTab === "kpis" && (
            <ContractorKPIsTab contractorId={contractor.id} />
          )}

          {/* Spending Tab */}
          {activeTab === "spending" && (
            <div className="space-y-6">
              {spendingQuery.isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading spending data...</div>
              ) : spending ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total Spending</p>
                          <p className="text-2xl font-bold text-purple-600 mt-1">
                            R {(spending.totalSpending || 0).toLocaleString()}
                          </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-purple-400" />
                      </div>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <div>
                        <p className="text-sm text-gray-600">Number of Projects</p>
                        <p className="text-2xl font-bold text-indigo-600 mt-1">{spending.numberOfProjects || 0}</p>
                      </div>
                    </div>

                    <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                      <div>
                        <p className="text-sm text-gray-600">Average Project Cost</p>
                        <p className="text-2xl font-bold text-pink-600 mt-1">
                          R {spending.numberOfProjects ? ((spending.totalSpending || 0) / (spending.numberOfProjects || 1)).toLocaleString() : 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {spending.monthlySpending && spending.monthlySpending.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Monthly Spending Trend</h4>
                      <div className="space-y-2">
                        {spending.monthlySpending.map((month: any, index: number) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{month.month}</span>
                            <span className="font-medium text-gray-900">R {month.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No spending data available</div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <ContractorDocumentsTab contractorId={contractor.id} />
          )}
        </div>

        {/* Close Button */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
