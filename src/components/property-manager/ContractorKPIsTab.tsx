import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { Plus, Target, TrendingUp, Calendar, AlertCircle, Loader2, Edit } from "lucide-react";
import { Dialog } from "@headlessui/react";

interface ContractorKPIsTabProps {
  contractorId: number;
}

export function ContractorKPIsTab({ contractorId }: ContractorKPIsTabProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    kpiName: "",
    description: "",
    targetValue: 0,
    unit: "jobs",
    frequency: "MONTHLY" as "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY",
    periodStart: "",
    periodEnd: "",
  });

  // Fetch KPIs
  const kpisQuery = useQuery(
    trpc.getContractorPerformance.queryOptions({
      token: token!,
      contractorId,
    })
  );

  const kpis = kpisQuery.data?.kpis || [];

  // Create KPI mutation
  const createKPIMutation = useMutation(
    trpc.createContractorKPI.mutationOptions({
      onSuccess: () => {
        toast.success("KPI created successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getContractorPerformance.queryKey(),
        });
        setShowCreateForm(false);
        resetForm();
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to create KPI");
      },
    })
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Authentication required");
      return;
    }

    if (!formData.kpiName || !formData.periodStart || !formData.periodEnd) {
      toast.error("Please fill in all required fields");
      return;
    }

    createKPIMutation.mutate({
      token,
      contractorId,
      kpiName: formData.kpiName,
      description: formData.description,
      targetValue: formData.targetValue,
      unit: formData.unit,
      frequency: formData.frequency,
      periodStart: new Date(formData.periodStart),
      periodEnd: new Date(formData.periodEnd),
    });
  };

  const resetForm = () => {
    setFormData({
      kpiName: "",
      description: "",
      targetValue: 0,
      unit: "jobs",
      frequency: "MONTHLY",
      periodStart: "",
      periodEnd: "",
    });
  };

  const getStatusColor = (achievementRate: number) => {
    if (achievementRate >= 100) return "text-green-600 bg-green-100";
    if (achievementRate >= 75) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900">Key Performance Indicators</h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add KPI
        </button>
      </div>

      {/* KPIs List */}
      {kpisQuery.isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading KPIs...</div>
      ) : kpis.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No KPIs defined yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kpis.map((kpi: any) => (
            <div key={kpi.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">{kpi.kpiName}</h4>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(kpi.achievementRate)}`}>
                  {kpi.achievementRate.toFixed(1)}%
                </span>
              </div>

              {kpi.description && (
                <p className="text-sm text-gray-600 mb-3">{kpi.description}</p>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Target:</span>
                  <span className="font-medium text-gray-900">
                    {kpi.targetValue} {kpi.unit}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Actual:</span>
                  <span className="font-medium text-gray-900">
                    {kpi.actualValue} {kpi.unit}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Frequency:</span>
                  <span className="font-medium text-gray-900">{kpi.frequency}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  {new Date(kpi.periodStart).toLocaleDateString()} - {new Date(kpi.periodEnd).toLocaleDateString()}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      kpi.achievementRate >= 100
                        ? "bg-green-600"
                        : kpi.achievementRate >= 75
                        ? "bg-yellow-600"
                        : "bg-red-600"
                    }`}
                    style={{ width: `${Math.min(kpi.achievementRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create KPI Modal */}
      <Dialog open={showCreateForm} onClose={() => setShowCreateForm(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-lg shadow-xl p-6">
            <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">
              Create New KPI
            </Dialog.Title>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  KPI Name *
                </label>
                <input
                  type="text"
                  value={formData.kpiName}
                  onChange={(e) => setFormData({ ...formData, kpiName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Jobs Completed, Quality Rating"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Value *
                  </label>
                  <input
                    type="number"
                    value={formData.targetValue}
                    onChange={(e) => setFormData({ ...formData, targetValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit *
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="jobs, %, R"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequency *
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period Start *
                  </label>
                  <input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period End *
                  </label>
                  <input
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createKPIMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createKPIMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create KPI"
                  )}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
