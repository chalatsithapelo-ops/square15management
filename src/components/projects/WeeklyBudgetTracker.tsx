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
  Calendar,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  X,
  Download,
} from "lucide-react";
import { PhotoUpload } from "~/components/PhotoUpload";
import { SignedMinioImage } from "~/components/SignedMinioUrl";
import ItemizedExpenseTracker from "~/components/projects/ItemizedExpenseTracker";

interface WeeklyBudgetTrackerProps {
  milestoneId: number;
  milestoneBudget: number;
  milestoneName: string;
}

const weeklyUpdateSchema = z.object({
  weekStartDate: z.string().min(1, "Start date is required"),
  weekEndDate: z.string().min(1, "End date is required"),
  labourExpenditure: z.number().min(0).default(0),
  materialExpenditure: z.number().min(0).default(0),
  otherExpenditure: z.number().min(0).default(0),
  progressPercentage: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  workDone: z.string().optional(),
  challenges: z.string().optional(),
  successes: z.string().optional(),
  nextWeekPlan: z.string().optional(),
});

type WeeklyUpdateForm = z.infer<typeof weeklyUpdateSchema>;

interface ItemizedExpense {
  itemDescription: string;
  quotedAmount: number;
  actualSpent: number;
  supplierInvoiceUrl?: string;
  reasonForOverspend?: string;
}

export default function WeeklyBudgetTracker({
  milestoneId,
  milestoneBudget,
  milestoneName,
}: WeeklyBudgetTrackerProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [itemizedExpenses, setItemizedExpenses] = useState<ItemizedExpense[]>([]);
  const [showItemizedExpenses, setShowItemizedExpenses] = useState(false);

  const updatesQuery = useQuery(
    trpc.getWeeklyBudgetUpdates.queryOptions({
      token: token!,
      milestoneId,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<WeeklyUpdateForm>({
    resolver: zodResolver(weeklyUpdateSchema),
  });

  const resetAllFormState = () => {
    reset();
    setUploadedImages([]);
    setItemizedExpenses([]);
    setShowItemizedExpenses(false);
    setShowAddForm(false);
  };

  const createUpdateMutation = useMutation(
    trpc.createWeeklyBudgetUpdate.mutationOptions({
      onSuccess: () => {
        toast.success("Weekly update added successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getWeeklyBudgetUpdates.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesByProject.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getProjects.queryKey() });
        resetAllFormState();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to add weekly update");
      },
    })
  );

  const generatePdfMutation = useMutation(
    trpc.generateWeeklyUpdatePdf.mutationOptions({
      onSuccess: (data) => {
        // Decode base64 PDF and trigger download
        const binaryString = atob(data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${milestoneName.replace(/\s+/g, "_")}_Week_${new Date().getTime()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Weekly report downloaded successfully!");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PDF");
      },
    })
  );

  const updates = updatesQuery.data || [];

  const labourExpenditure = watch("labourExpenditure") || 0;
  const materialExpenditure = watch("materialExpenditure") || 0;
  const otherExpenditure = watch("otherExpenditure") || 0;
  const totalExpenditure = labourExpenditure + materialExpenditure + otherExpenditure;

  const cumulativeExpenditure = updates.reduce((sum, u) => sum + u.totalExpenditure, 0);
  const budgetRemaining = milestoneBudget - cumulativeExpenditure;
  const budgetUtilization = milestoneBudget > 0 ? (cumulativeExpenditure / milestoneBudget) * 100 : 0;

  const onSubmit = (data: WeeklyUpdateForm) => {
    createUpdateMutation.mutate({
      token: token!,
      milestoneId,
      ...data,
      imagesDone: uploadedImages,
      itemizedExpenses: itemizedExpenses.length > 0 ? itemizedExpenses : undefined,
    });
  };

  // Get current week dates as default
  const getCurrentWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Monday start
    const monday = new Date(now.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start: monday.toISOString().split("T")[0],
      end: sunday.toISOString().split("T")[0],
    };
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-900">Budget</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">R{milestoneBudget.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-semibold text-purple-900">Spent</h3>
          </div>
          <p className="text-2xl font-bold text-purple-600">R{cumulativeExpenditure.toLocaleString()}</p>
        </div>

        <div className={`rounded-xl p-4 border ${
          budgetRemaining >= 0
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
            : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {budgetRemaining >= 0 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <h3 className={`text-sm font-semibold ${
              budgetRemaining >= 0 ? 'text-green-900' : 'text-red-900'
            }`}>
              Remaining
            </h3>
          </div>
          <p className={`text-2xl font-bold ${
            budgetRemaining >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            R{Math.abs(budgetRemaining).toLocaleString()}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Utilization</h3>
          </div>
          <p className="text-2xl font-bold text-amber-600">{budgetUtilization.toFixed(1)}%</p>
        </div>
      </div>

      {/* Add Weekly Update Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Weekly Budget Updates</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 shadow-md transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Weekly Update
        </button>
      </div>

      {/* Add Update Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Add Weekly Budget Update</h4>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Week Start Date *
                </label>
                <input
                  type="date"
                  {...register("weekStartDate")}
                  defaultValue={getCurrentWeekDates().start}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {errors.weekStartDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.weekStartDate.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Week End Date *
                </label>
                <input
                  type="date"
                  {...register("weekEndDate")}
                  defaultValue={getCurrentWeekDates().end}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {errors.weekEndDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.weekEndDate.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Labour Expenditure (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("labourExpenditure", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material Expenditure (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("materialExpenditure", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Other Expenditure (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("otherExpenditure", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Progress Percentage *
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  {...register("progressPercentage", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0"
                />
                {errors.progressPercentage && (
                  <p className="mt-1 text-sm text-red-600">{errors.progressPercentage.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Done This Week *
                </label>
                <textarea
                  {...register("workDone")}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Describe the work that was completed this week..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Challenges Faced
                </label>
                <textarea
                  {...register("challenges")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Any challenges or obstacles encountered..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Successes & Achievements
                </label>
                <textarea
                  {...register("successes")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Milestones reached, goals achieved..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan for Next Week *
                </label>
                <textarea
                  {...register("nextWeekPlan")}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Describe what will be done in the following week..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  {...register("notes")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Weekly progress notes..."
                />
              </div>

              <div className="md:col-span-2">
                <PhotoUpload
                  onPhotosUploaded={setUploadedImages}
                  minimumPhotos={1}
                  title="Upload Work Progress Photos"
                  description="Upload photos showing the work that was completed this week"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowItemizedExpenses(!showItemizedExpenses)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    Itemized Expense Tracker
                  </span>
                  <span className="text-xs text-gray-600">
                    {itemizedExpenses.length} item{itemizedExpenses.length !== 1 ? 's' : ''} added
                  </span>
                </button>
              </div>

              {showItemizedExpenses && (
                <div className="md:col-span-2 border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h5 className="text-sm font-semibold text-gray-900 mb-3">Budget vs Actual Expense Tracking</h5>
                  <ItemizedExpenseTracker
                    expenses={itemizedExpenses}
                    onExpensesChange={setItemizedExpenses}
                  />
                </div>
              )}

              <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Total Expenditure:</span>
                  <span className="font-bold text-gray-900">R{totalExpenditure.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New Cumulative Total:</span>
                  <span className="font-bold text-gray-900">
                    R{(cumulativeExpenditure + totalExpenditure).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={resetAllFormState}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createUpdateMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {createUpdateMutation.isPending ? "Adding..." : "Add Update"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Updates List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {updates.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No weekly updates yet</p>
            <p className="text-xs text-gray-500 mt-1">Add weekly updates to track budget expenditure</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Week
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Labour
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Material
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Other
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {updates.map((update) => (
                  <tr key={update.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium text-gray-900">
                        {new Date(update.weekStartDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        to {new Date(update.weekEndDate).toLocaleDateString()}
                      </div>
                      {update.notes && (
                        <div className="text-xs text-gray-600 mt-1 max-w-xs truncate">
                          {update.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      R{update.labourExpenditure.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      R{update.materialExpenditure.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      R{update.otherExpenditure.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      R{update.totalExpenditure.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className="font-semibold text-teal-600">{update.progressPercentage}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => {
                            const modal = document.getElementById(`update-details-${update.id}`);
                            if (modal) modal.classList.remove('hidden');
                          }}
                          className="text-blue-600 hover:text-blue-800 underline text-xs"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => generatePdfMutation.mutate({
                            token: token!,
                            updateId: update.id,
                            forCustomer: false,
                          })}
                          disabled={generatePdfMutation.isPending}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded disabled:opacity-50 transition-colors"
                          title="Download PDF Report"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">Total</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    R{updates.reduce((sum, u) => sum + u.labourExpenditure, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    R{updates.reduce((sum, u) => sum + u.materialExpenditure, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    R{updates.reduce((sum, u) => sum + u.otherExpenditure, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    R{cumulativeExpenditure.toLocaleString()}
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Update Modals */}
      {updates.map((update) => (
        <div
          key={`modal-${update.id}`}
          id={`update-details-${update.id}`}
          className="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.currentTarget.classList.add('hidden');
            }
          }}
        >
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-xl bg-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Weekly Update Details
                </h3>
                <p className="text-sm text-gray-600">
                  {new Date(update.weekStartDate).toLocaleDateString()} - {new Date(update.weekEndDate).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => {
                  const modal = document.getElementById(`update-details-${update.id}`);
                  if (modal) modal.classList.add('hidden');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {update.workDone && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Work Completed</h4>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{update.workDone}</p>
                </div>
              )}

              {update.challenges && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Challenges</h4>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{update.challenges}</p>
                </div>
              )}

              {update.successes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Successes</h4>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{update.successes}</p>
                </div>
              )}

              {update.nextWeekPlan && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Next Week's Plan</h4>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{update.nextWeekPlan}</p>
                </div>
              )}

              {update.imagesDone && update.imagesDone.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Progress Photos</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {update.imagesDone.map((imageUrl, idx) => (
                      <SignedMinioImage
                        key={idx}
                        url={imageUrl}
                        alt={`Progress ${idx + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                    ))}
                  </div>
                </div>
              )}

              {update.itemizedExpenses && Array.isArray(update.itemizedExpenses) && update.itemizedExpenses.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Itemized Expenses</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quoted</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(update.itemizedExpenses as any[]).map((expense, idx) => {
                          const isOverBudget = expense.actualSpent > expense.quotedAmount;
                          const variance = expense.actualSpent - expense.quotedAmount;
                          return (
                            <tr key={idx}>
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-900">{expense.itemDescription}</div>
                                {expense.reasonForOverspend && (
                                  <div className="text-xs text-red-600 mt-1">
                                    Reason: {expense.reasonForOverspend}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900">
                                R{expense.quotedAmount.toLocaleString()}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
                                R{expense.actualSpent.toLocaleString()}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                                {variance >= 0 ? '+' : ''}R{variance.toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                {expense.supplierInvoiceUrl ? (
                                  <a
                                    href={expense.supplierInvoiceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline text-xs"
                                  >
                                    View Invoice
                                  </a>
                                ) : (
                                  <span className="text-gray-400 text-xs">No invoice</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
