import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import {
  Plus,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Building2,
  Loader2,
  X,
  PieChart,
  Receipt,
  Clock,
  CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { MetricCard } from "~/components/MetricCard";

export function BuildingBudgetTracker() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showCreateBudgetModal, setShowCreateBudgetModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showScheduleMaintenanceModal, setShowScheduleMaintenanceModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<any>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [filterBuilding, setFilterBuilding] = useState<number | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string>("ACTIVE");

  // Fetch buildings
  const buildingsQuery = useQuery(
    trpc.getBuildings.queryOptions(
      { token: token! },
      { enabled: !!token }
    )
  );

  // Fetch budgets
  const budgetsQuery = useQuery(
    trpc.getBuildingBudgets.queryOptions(
      {
        token: token!,
        buildingId: filterBuilding,
        status: filterStatus === "ALL" ? undefined : filterStatus,
      },
      { enabled: !!token, refetchInterval: 30000 }
    )
  );

  // Fetch maintenance schedules
  const schedulesQuery = useQuery(
    trpc.getBuildingMaintenanceSchedules.queryOptions(
      {
        token: token!,
        buildingId: filterBuilding,
      },
      { enabled: !!token, refetchInterval: 30000 }
    )
  );

  const buildings = (buildingsQuery.data as any[]) || [];
  const budgets = (budgetsQuery.data as any[]) || [];
  const schedules = (schedulesQuery.data as any[]) || [];

  // Calculate aggregate metrics
  const metrics = useMemo(() => {
    const totalBudget = budgets.reduce((sum, b) => sum + b.totalBudget, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.totalSpent, 0);
    const totalRemaining = budgets.reduce((sum, b) => sum + b.totalRemaining, 0);
    const utilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const overBudgetCount = budgets.filter((b: any) => b.totalSpent > b.totalBudget).length;
    const nearLimitCount = budgets.filter(
      (b: any) => b.totalSpent / b.totalBudget > 0.9 && b.totalSpent <= b.totalBudget
    ).length;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      utilization,
      overBudgetCount,
      nearLimitCount,
    };
  }, [budgets]);

  const upcomingMaintenance = useMemo(() => {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return schedules.filter((s: any) => {
      const dueDate = new Date(s.nextDueDate);
      return dueDate >= now && dueDate <= next7Days && s.status === "ACTIVE";
    });
  }, [schedules]);

  if (buildingsQuery.isLoading || budgetsQuery.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        <p className="ml-3 text-gray-600">Loading budgets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modals */}
      <CreateBudgetModal
        isOpen={showCreateBudgetModal}
        onClose={() => {
          setShowCreateBudgetModal(false);
          setSelectedBuilding(null);
        }}
        buildings={buildings}
        preselectedBuilding={selectedBuilding}
      />
      <AddExpenseModal
        isOpen={showAddExpenseModal}
        onClose={() => {
          setShowAddExpenseModal(false);
          setSelectedBudget(null);
        }}
        budget={selectedBudget}
      />
      <ScheduleMaintenanceModal
        isOpen={showScheduleMaintenanceModal}
        onClose={() => {
          setShowScheduleMaintenanceModal(false);
          setSelectedBuilding(null);
        }}
        buildings={buildings}
        preselectedBuilding={selectedBuilding}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          name="Total Budget"
          value={`R${metrics.totalBudget.toLocaleString()}`}
          icon={DollarSign}
          color="blue"
          gradient={true}
        />
        <MetricCard
          name="Total Spent"
          value={`R${metrics.totalSpent.toLocaleString()}`}
          icon={TrendingDown}
          color="orange"
          gradient={true}
          subtext={`${metrics.utilization.toFixed(1)}% utilized`}
        />
        <MetricCard
          name="Remaining Budget"
          value={`R${metrics.totalRemaining.toLocaleString()}`}
          icon={TrendingUp}
          color="green"
          gradient={true}
        />
        <MetricCard
          name="Budget Alerts"
          value={metrics.overBudgetCount + metrics.nearLimitCount}
          icon={AlertCircle}
          color={metrics.overBudgetCount > 0 ? "red" : "yellow"}
          gradient={true}
          subtext={
            metrics.overBudgetCount > 0
              ? `${metrics.overBudgetCount} over budget`
              : `${metrics.nearLimitCount} near limit`
          }
        />
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={filterBuilding || ""}
            onChange={(e) => setFilterBuilding(e.target.value ? parseInt(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Buildings</option>
            {buildings.map((building: any) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowScheduleMaintenanceModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-md"
          >
            <Calendar className="h-5 w-5 mr-2" />
            Schedule Maintenance
          </button>
          <button
            onClick={() => setShowCreateBudgetModal(true)}
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-md"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Budget
          </button>
        </div>
      </div>

      {/* Upcoming Maintenance Alert */}
      {upcomingMaintenance.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <Clock className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-900">
                Upcoming Maintenance ({upcomingMaintenance.length})
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                You have {upcomingMaintenance.length} maintenance task{upcomingMaintenance.length > 1 ? "s" : ""} due in the next 7 days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Budgets List */}
      {budgets.length === 0 ? (
        <div className="text-center py-16">
          <PieChart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Budgets Yet</h3>
          <p className="text-sm text-gray-600 mb-6">
            Create your first budget to start tracking expenses for your buildings.
          </p>
          <button
            onClick={() => setShowCreateBudgetModal(true)}
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Your First Budget
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {budgets.map((budget: any) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onAddExpense={() => {
                setSelectedBudget(budget);
                setShowAddExpenseModal(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetCard({ budget, onAddExpense }: { budget: any; onAddExpense: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const utilization = budget.totalBudget > 0 ? (budget.totalSpent / budget.totalBudget) * 100 : 0;
  const isOverBudget = budget.totalSpent > budget.totalBudget;
  const isNearLimit = utilization > 90 && !isOverBudget;

  const categoryData = [
    { name: "Preventative Maintenance", budgeted: budget.preventativeMaintenance, key: "preventativeMaintenance" },
    { name: "Reactive Maintenance", budgeted: budget.reactiveMaintenance, key: "reactiveMaintenance" },
    { name: "Corrective Maintenance", budgeted: budget.correctiveMaintenance, key: "correctiveMaintenance" },
    { name: "Capital Expenditures", budgeted: budget.capitalExpenditures, key: "capitalExpenditures" },
    { name: "Utilities", budgeted: budget.utilities, key: "utilities" },
    { name: "Insurance", budgeted: budget.insurance, key: "insurance" },
    { name: "Property Tax", budgeted: budget.propertyTax, key: "propertyTax" },
    { name: "Other", budgeted: budget.other, key: "other" },
  ].filter((cat) => cat.budgeted > 0);

  // Calculate spent by category from expenses
  const spentByCategory = budget.expenses.reduce((acc: any, expense: any) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">
              {budget.building.name} - FY {budget.fiscalYear}
              {budget.quarter && ` Q${budget.quarter}`}
            </h4>
            <p className="text-sm text-gray-600">{budget.building.address}</p>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                budget.status === "ACTIVE"
                  ? "bg-green-100 text-green-700"
                  : budget.status === "APPROVED"
                  ? "bg-blue-100 text-blue-700"
                  : budget.status === "CLOSED"
                  ? "bg-gray-100 text-gray-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {budget.status}
            </span>
            {isOverBudget && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                Over Budget
              </span>
            )}
            {isNearLimit && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                Near Limit
              </span>
            )}
          </div>
        </div>

        {/* Budget Summary */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-600">Total Budget</p>
            <p className="text-lg font-semibold text-gray-900">R{budget.totalBudget.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Spent</p>
            <p className={`text-lg font-semibold ${isOverBudget ? "text-red-600" : "text-gray-900"}`}>
              R{budget.totalSpent.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Remaining</p>
            <p className={`text-lg font-semibold ${budget.totalRemaining < 0 ? "text-red-600" : "text-green-600"}`}>
              R{budget.totalRemaining.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Budget Utilization</span>
            <span className={`text-xs font-medium ${isOverBudget ? "text-red-600" : "text-gray-900"}`}>
              {utilization.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isOverBudget ? "bg-red-600" : isNearLimit ? "bg-yellow-500" : "bg-green-600"
              }`}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </div>
        </div>

        {/* Period */}
        <p className="text-sm text-gray-600 mb-4">
          Period: {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
        </p>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            {showDetails ? "Hide Details" : "View Details"}
          </button>
          <button
            onClick={onAddExpense}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
          >
            <Receipt className="h-4 w-4 mr-1" />
            Add Expense
          </button>
        </div>

        {/* Detailed Breakdown */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="text-sm font-semibold text-gray-900 mb-3">Category Breakdown</h5>
            <div className="space-y-2">
              {categoryData.map((category) => {
                const spent = spentByCategory[category.key] || 0;
                const percentage = category.budgeted > 0 ? (spent / category.budgeted) * 100 : 0;
                const isOverCategoryBudget = spent > category.budgeted;

                return (
                  <div key={category.key} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-700">{category.name}</span>
                      <span className="text-xs text-gray-600">
                        R{spent.toLocaleString()} / R{category.budgeted.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          isOverCategoryBudget ? "bg-red-500" : percentage > 90 ? "bg-yellow-500" : "bg-teal-500"
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Expenses */}
            {budget.expenses.length > 0 && (
              <div className="mt-4">
                <h5 className="text-sm font-semibold text-gray-900 mb-2">Recent Expenses</h5>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {budget.expenses.slice(0, 5).map((expense: any) => (
                    <div key={expense.id} className="flex justify-between items-start text-xs bg-gray-50 p-2 rounded">
                      <div>
                        <p className="font-medium text-gray-900">{expense.description}</p>
                        <p className="text-gray-600">
                          {expense.category.replace(/([A-Z])/g, " $1").trim()} • {new Date(expense.expenseDate).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900">R{expense.amount.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateBudgetModal({
  isOpen,
  onClose,
  buildings,
  preselectedBuilding,
}: {
  isOpen: boolean;
  onClose: () => void;
  buildings: any[];
  preselectedBuilding?: any;
}) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    buildingId: preselectedBuilding?.id || "",
    fiscalYear: new Date().getFullYear(),
    quarter: "",
    startDate: "",
    endDate: "",
    preventativeMaintenance: 0,
    reactiveMaintenance: 0,
    correctiveMaintenance: 0,
    capitalExpenditures: 0,
    utilities: 0,
    insurance: 0,
    propertyTax: 0,
    other: 0,
    notes: "",
  });

  const createBudgetMutation = useMutation(
    trpc.createBuildingBudget.mutationOptions({
      onSuccess: () => {
        toast.success("Budget created successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getBuildingBudgets.queryKey(),
        });
        onClose();
        resetForm();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create budget");
      },
    })
  );

  const resetForm = () => {
    setFormData({
      buildingId: preselectedBuilding?.id || "",
      fiscalYear: new Date().getFullYear(),
      quarter: "",
      startDate: "",
      endDate: "",
      preventativeMaintenance: 0,
      reactiveMaintenance: 0,
      correctiveMaintenance: 0,
      capitalExpenditures: 0,
      utilities: 0,
      insurance: 0,
      propertyTax: 0,
      other: 0,
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!formData.buildingId || !formData.startDate || !formData.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    createBudgetMutation.mutate({
      token,
      buildingId: parseInt(formData.buildingId),
      fiscalYear: formData.fiscalYear,
      quarter: formData.quarter ? parseInt(formData.quarter) : undefined,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      preventativeMaintenance: formData.preventativeMaintenance,
      reactiveMaintenance: formData.reactiveMaintenance,
      correctiveMaintenance: formData.correctiveMaintenance,
      capitalExpenditures: formData.capitalExpenditures,
      utilities: formData.utilities,
      insurance: formData.insurance,
      propertyTax: formData.propertyTax,
      other: formData.other,
      notes: formData.notes || undefined,
    });
  };

  const totalBudget =
    formData.preventativeMaintenance +
    formData.reactiveMaintenance +
    formData.correctiveMaintenance +
    formData.capitalExpenditures +
    formData.utilities +
    formData.insurance +
    formData.propertyTax +
    formData.other;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Create Building Budget</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Building Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Building <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.buildingId}
              onChange={(e) => setFormData({ ...formData, buildingId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="">Select a building</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name} - {building.address}
                </option>
              ))}
            </select>
          </div>

          {/* Period Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fiscal Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.fiscalYear}
                onChange={(e) => setFormData({ ...formData, fiscalYear: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quarter (Optional)</label>
              <select
                value={formData.quarter}
                onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Annual</option>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          {/* Budget Categories */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Budget Categories</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preventative Maintenance</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.preventativeMaintenance}
                  onChange={(e) =>
                    setFormData({ ...formData, preventativeMaintenance: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reactive Maintenance</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.reactiveMaintenance}
                  onChange={(e) =>
                    setFormData({ ...formData, reactiveMaintenance: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Corrective Maintenance</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.correctiveMaintenance}
                  onChange={(e) =>
                    setFormData({ ...formData, correctiveMaintenance: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capital Expenditures</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.capitalExpenditures}
                  onChange={(e) =>
                    setFormData({ ...formData, capitalExpenditures: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Utilities</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.utilities}
                  onChange={(e) => setFormData({ ...formData, utilities: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.insurance}
                  onChange={(e) => setFormData({ ...formData, insurance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Tax</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.propertyTax}
                  onChange={(e) => setFormData({ ...formData, propertyTax: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Other</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.other}
                  onChange={(e) => setFormData({ ...formData, other: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Total Budget Display */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-teal-900">Total Budget:</span>
              <span className="text-xl font-bold text-teal-900">R{totalBudget.toLocaleString()}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Add any additional notes about this budget..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBudgetMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
            >
              {createBudgetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Budget
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddExpenseModal({
  isOpen,
  onClose,
  budget,
}: {
  isOpen: boolean;
  onClose: () => void;
  budget: any;
}) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    description: "",
    category: "",
    amount: 0,
    expenseDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const createExpenseMutation = useMutation(
    trpc.createBudgetExpense.mutationOptions({
      onSuccess: () => {
        toast.success("Expense added successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getBuildingBudgets.queryKey(),
        });
        onClose();
        resetForm();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to add expense");
      },
    })
  );

  const resetForm = () => {
    setFormData({
      description: "",
      category: "",
      amount: 0,
      expenseDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !budget) return;

    if (!formData.description || !formData.category || formData.amount <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    createExpenseMutation.mutate({
      token,
      budgetId: budget.id,
      description: formData.description,
      category: formData.category as any,
      amount: formData.amount,
      expenseDate: new Date(formData.expenseDate).toISOString(),
      notes: formData.notes || undefined,
    });
  };

  if (!isOpen || !budget) return null;

  const categories = [
    { value: "preventativeMaintenance", label: "Preventative Maintenance" },
    { value: "reactiveMaintenance", label: "Reactive Maintenance" },
    { value: "correctiveMaintenance", label: "Corrective Maintenance" },
    { value: "capitalExpenditures", label: "Capital Expenditures" },
    { value: "utilities", label: "Utilities" },
    { value: "insurance", label: "Insurance" },
    { value: "propertyTax", label: "Property Tax" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full flex flex-col max-h-[90vh]">
        {/* Header - Sticky */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Add Expense</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                <strong>Budget:</strong> {budget.building.name} - FY {budget.fiscalYear}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <strong>Remaining:</strong> R{budget.totalRemaining.toLocaleString()}
              </p>
            </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., HVAC Repair"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (R) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expense Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.expenseDate}
              onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Add any additional notes..."
            />
          </div>

          {/* Form Actions - Sticky Footer */}
        </form>
        </div>
        
        <div className="flex-shrink-0 flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="expense-form"
            disabled={createExpenseMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            {createExpenseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Expense
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleMaintenanceModal({
  isOpen,
  onClose,
  buildings,
  preselectedBuilding,
}: {
  isOpen: boolean;
  onClose: () => void;
  buildings: any[];
  preselectedBuilding?: any;
}) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    buildingId: preselectedBuilding?.id || "",
    title: "",
    description: "",
    maintenanceType: "PREVENTATIVE",
    category: "",
    frequency: "MONTHLY",
    startDate: "",
    nextDueDate: "",
    estimatedCost: 0,
    notifyDaysBefore: 7,
    notes: "",
  });

  const createScheduleMutation = useMutation(
    trpc.createBuildingMaintenanceSchedule.mutationOptions({
      onSuccess: () => {
        toast.success("Maintenance scheduled successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getBuildingMaintenanceSchedules.queryKey(),
        });
        onClose();
        resetForm();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to schedule maintenance");
      },
    })
  );

  const resetForm = () => {
    setFormData({
      buildingId: preselectedBuilding?.id || "",
      title: "",
      description: "",
      maintenanceType: "PREVENTATIVE",
      category: "",
      frequency: "MONTHLY",
      startDate: "",
      nextDueDate: "",
      estimatedCost: 0,
      notifyDaysBefore: 7,
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!formData.buildingId || !formData.title || !formData.startDate || !formData.nextDueDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    createScheduleMutation.mutate({
      token,
      buildingId: parseInt(formData.buildingId),
      title: formData.title,
      description: formData.description,
      maintenanceType: formData.maintenanceType as any,
      category: formData.category,
      frequency: formData.frequency as any,
      startDate: new Date(formData.startDate).toISOString(),
      nextDueDate: new Date(formData.nextDueDate).toISOString(),
      estimatedCost: formData.estimatedCost > 0 ? formData.estimatedCost : undefined,
      notifyDaysBefore: formData.notifyDaysBefore,
      notes: formData.notes || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Schedule Maintenance</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Building <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.buildingId}
              onChange={(e) => setFormData({ ...formData, buildingId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="">Select a building</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., HVAC System Inspection"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Describe the maintenance task..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maintenance Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.maintenanceType}
                onChange={(e) => setFormData({ ...formData, maintenanceType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="PREVENTATIVE">Preventative</option>
                <option value="REACTIVE">Reactive</option>
                <option value="CORRECTIVE">Corrective</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., HVAC, Plumbing"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUALLY">Annually</option>
              <option value="ONE_TIME">One-Time</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.nextDueDate}
                onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost (R)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.estimatedCost}
                onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notify Days Before</label>
              <input
                type="number"
                min="0"
                value={formData.notifyDaysBefore}
                onChange={(e) => setFormData({ ...formData, notifyDaysBefore: parseInt(e.target.value) || 7 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createScheduleMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
            >
              {createScheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Schedule Maintenance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
