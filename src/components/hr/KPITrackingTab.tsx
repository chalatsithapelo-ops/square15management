import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  Plus,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit,
  X,
  CheckCircle,
} from "lucide-react";
import { Dialog } from "@headlessui/react";

const kpiCreateSchema = z.object({
  employeeId: z.number().min(1, "Please select an employee"),
  kpiName: z.string().min(1, "KPI name is required"),
  description: z.string().optional(),
  targetValue: z.number().min(0, "Target value must be positive"),
  unit: z.string().min(1, "Unit is required"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  periodStart: z.string(),
  periodEnd: z.string(),
  notes: z.string().optional(),
});

type KPICreateForm = z.infer<typeof kpiCreateSchema>;

const kpiUpdateSchema = z.object({
  actualValue: z.number().min(0, "Actual value must be positive"),
  notes: z.string().optional(),
  markAsReviewed: z.boolean().optional(),
});

type KPIUpdateForm = z.infer<typeof kpiUpdateSchema>;

export function KPITrackingTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>("ACTIVE");

  const employeesQuery = useQuery(
    trpc.getEmployees.queryOptions({
      token: token!,
    })
  );

  const kpisQuery = useQuery(
    trpc.getEmployeeKPIs.queryOptions({
      token: token!,
      employeeId: selectedEmployee || undefined,
      status: statusFilter as any,
    })
  );

  const createForm = useForm<KPICreateForm>({
    resolver: zodResolver(kpiCreateSchema),
    defaultValues: {
      frequency: "MONTHLY",
    },
  });

  const updateForm = useForm<KPIUpdateForm>({
    resolver: zodResolver(kpiUpdateSchema),
  });

  const createKPIMutation = useMutation(
    trpc.createEmployeeKPI.mutationOptions({
      onSuccess: () => {
        toast.success("KPI created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getEmployeeKPIs.queryKey() });
        setShowCreateForm(false);
        createForm.reset();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create KPI");
      },
    })
  );

  const updateKPIMutation = useMutation(
    trpc.updateEmployeeKPI.mutationOptions({
      onSuccess: () => {
        toast.success("KPI updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getEmployeeKPIs.queryKey() });
        setEditingKPI(null);
        updateForm.reset();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update KPI");
      },
    })
  );

  const employees = employeesQuery.data || [];
  const kpis = kpisQuery.data || [];

  const onCreateSubmit = (data: KPICreateForm) => {
    createKPIMutation.mutate({
      token: token!,
      ...data,
    });
  };

  const onUpdateSubmit = (data: KPIUpdateForm) => {
    if (!editingKPI) return;
    
    updateKPIMutation.mutate({
      token: token!,
      kpiId: editingKPI.id,
      ...data,
    });
  };

  const handleEditClick = (kpi: any) => {
    setEditingKPI(kpi);
    updateForm.reset({
      actualValue: kpi.actualValue,
      notes: kpi.notes || "",
      markAsReviewed: false,
    });
  };

  const getAchievementColor = (rate: number) => {
    if (rate >= 100) return "text-green-600 bg-green-100";
    if (rate >= 75) return "text-blue-600 bg-blue-100";
    if (rate >= 50) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getAchievementIcon = (rate: number) => {
    if (rate >= 100) return TrendingUp;
    if (rate >= 50) return Minus;
    return TrendingDown;
  };

  const statusStats = [
    { status: "ACTIVE", count: kpis.filter(k => k.status === "ACTIVE").length, color: "bg-green-100 text-green-800" },
    { status: "INACTIVE", count: kpis.filter(k => k.status === "INACTIVE").length, color: "bg-gray-100 text-gray-800" },
    { status: "ARCHIVED", count: kpis.filter(k => k.status === "ARCHIVED").length, color: "bg-blue-100 text-blue-800" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={selectedEmployee || ""}
            onChange={(e) => setSelectedEmployee(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.role})
              </option>
            ))}
          </select>

          <div className="flex items-center space-x-2">
            {statusStats.map((stat) => (
              <button
                key={stat.status}
                onClick={() => setStatusFilter(statusFilter === stat.status ? null : stat.status)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === stat.status
                    ? "ring-2 ring-purple-600 " + stat.color
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {stat.status} ({stat.count})
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create KPI
        </button>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {kpis.map((kpi) => {
          const AchievementIcon = getAchievementIcon(kpi.achievementRate);
          return (
            <div key={kpi.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">{kpi.kpiName}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      kpi.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                      kpi.status === "INACTIVE" ? "bg-gray-100 text-gray-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {kpi.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {kpi.employee.firstName} {kpi.employee.lastName} • {kpi.frequency}
                  </p>
                  {kpi.description && (
                    <p className="text-sm text-gray-500 mt-1">{kpi.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleEditClick(kpi)}
                  className="ml-2 p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Target:</span>
                  <span className="font-semibold text-gray-900">
                    {kpi.targetValue.toLocaleString()} {kpi.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Actual:</span>
                  <span className="font-semibold text-gray-900">
                    {kpi.actualValue.toLocaleString()} {kpi.unit}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Achievement</span>
                    <span className={`text-sm font-bold px-2 py-1 rounded-full ${getAchievementColor(kpi.achievementRate)}`}>
                      <AchievementIcon className="h-3 w-3 inline mr-1" />
                      {kpi.achievementRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        kpi.achievementRate >= 100 ? "bg-green-600" :
                        kpi.achievementRate >= 75 ? "bg-blue-600" :
                        kpi.achievementRate >= 50 ? "bg-yellow-600" :
                        "bg-red-600"
                      }`}
                      style={{ width: `${Math.min(kpi.achievementRate, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 text-xs text-gray-500">
                  <div className="flex items-center justify-between">
                    <span>
                      {new Date(kpi.periodStart).toLocaleDateString()} - {new Date(kpi.periodEnd).toLocaleDateString()}
                    </span>
                    {kpi.reviewedAt && (
                      <span className="flex items-center text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Reviewed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {kpis.length === 0 && (
          <div className="col-span-2 p-12 text-center bg-white rounded-xl border border-gray-200">
            <Target className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No KPIs found</p>
          </div>
        )}
      </div>

      {/* Create KPI Modal */}
      <Dialog
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Create New KPI
              </Dialog.Title>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee *
                    </label>
                    <select
                      {...createForm.register("employeeId", { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select an employee</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} - {emp.role}
                        </option>
                      ))}
                    </select>
                    {createForm.formState.errors.employeeId && (
                      <p className="mt-1 text-sm text-red-600">{createForm.formState.errors.employeeId.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      KPI Name *
                    </label>
                    <input
                      type="text"
                      {...createForm.register("kpiName")}
                      placeholder="e.g., Jobs Completed, Revenue Generated"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {createForm.formState.errors.kpiName && (
                      <p className="mt-1 text-sm text-red-600">{createForm.formState.errors.kpiName.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      {...createForm.register("description")}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Value *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...createForm.register("targetValue", { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {createForm.formState.errors.targetValue && (
                      <p className="mt-1 text-sm text-red-600">{createForm.formState.errors.targetValue.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit *
                    </label>
                    <input
                      type="text"
                      {...createForm.register("unit")}
                      placeholder="e.g., jobs, hours, R, %"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {createForm.formState.errors.unit && (
                      <p className="mt-1 text-sm text-red-600">{createForm.formState.errors.unit.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequency *
                    </label>
                    <select
                      {...createForm.register("frequency")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Period Start *
                    </label>
                    <input
                      type="date"
                      {...createForm.register("periodStart")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Period End *
                    </label>
                    <input
                      type="date"
                      {...createForm.register("periodEnd")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      {...createForm.register("notes")}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createKPIMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {createKPIMutation.isPending ? "Creating..." : "Create KPI"}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Update KPI Modal */}
      <Dialog
        open={editingKPI !== null}
        onClose={() => setEditingKPI(null)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-lg w-full bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Update KPI Progress
              </Dialog.Title>
              <button
                onClick={() => setEditingKPI(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editingKPI && (
              <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-900 mb-1">{editingKPI.kpiName}</h4>
                    <p className="text-sm text-gray-600">
                      Target: {editingKPI.targetValue} {editingKPI.unit}
                    </p>
                    <p className="text-sm text-gray-600">
                      Current: {editingKPI.actualValue} {editingKPI.unit} ({editingKPI.achievementRate.toFixed(1)}%)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Actual Value *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...updateForm.register("actualValue", { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {updateForm.formState.errors.actualValue && (
                      <p className="mt-1 text-sm text-red-600">{updateForm.formState.errors.actualValue.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      {...updateForm.register("notes")}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...updateForm.register("markAsReviewed")}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-700">
                      Mark as reviewed
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingKPI(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateKPIMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {updateKPIMutation.isPending ? "Updating..." : "Update KPI"}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
