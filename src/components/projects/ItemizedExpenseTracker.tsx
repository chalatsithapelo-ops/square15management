import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { Plus, X, Upload, FileText, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type ItemizedExpense = {
  itemDescription: string;
  quotedAmount: number;
  actualSpent: number;
  supplierInvoiceUrl?: string;
  reasonForOverspend?: string;
};

interface ItemizedExpenseTrackerProps {
  expenses: ItemizedExpense[];
  onExpensesChange: (expenses: ItemizedExpense[]) => void;
}

export default function ItemizedExpenseTracker({
  expenses,
  onExpensesChange,
}: ItemizedExpenseTrackerProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const addExpenseItem = () => {
    onExpensesChange([
      ...expenses,
      {
        itemDescription: "",
        quotedAmount: 0,
        actualSpent: 0,
        supplierInvoiceUrl: undefined,
        reasonForOverspend: undefined,
      },
    ]);
  };

  const removeExpenseItem = (index: number) => {
    onExpensesChange(expenses.filter((_, i) => i !== index));
  };

  const updateExpenseItem = (index: number, field: keyof ItemizedExpense, value: any) => {
    const updated = expenses.map((expense, i) => {
      if (i === index) {
        const newExpense = { ...expense, [field]: value };
        // Clear reasonForOverspend if no longer over budget
        if (field === 'actualSpent' || field === 'quotedAmount') {
          if (newExpense.actualSpent <= newExpense.quotedAmount) {
            newExpense.reasonForOverspend = undefined;
          }
        }
        return newExpense;
      }
      return expense;
    });
    onExpensesChange(updated);
  };

  const handleInvoiceUpload = async (index: number, file: File) => {
    setUploadingIndex(index);
    try {
      const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
        token: token!,
        fileName: file.name,
        fileType: file.type,
      });

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload invoice");
      }

      updateExpenseItem(index, "supplierInvoiceUrl", fileUrl);
      toast.success("Invoice uploaded successfully");
    } catch (error) {
      console.error("Error uploading invoice:", error);
      toast.error("Failed to upload invoice");
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <div className="space-y-3">
      {expenses.map((expense, index) => {
        const isOverBudget = expense.actualSpent > expense.quotedAmount;
        const variance = expense.actualSpent - expense.quotedAmount;

        return (
          <div key={index} className="border border-gray-300 rounded-lg p-4 bg-white relative">
            <button
              type="button"
              onClick={() => removeExpenseItem(index)}
              className="absolute top-2 right-2 p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Item Description */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  value={expense.itemDescription}
                  onChange={(e) => updateExpenseItem(index, "itemDescription", e.target.value)}
                  placeholder="e.g., Cement bags, Paint, Labour..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Quoted Amount */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Quoted Amount (R) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expense.quotedAmount || ""}
                  onChange={(e) => updateExpenseItem(index, "quotedAmount", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Actual Spent */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Actual Spent (R) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expense.actualSpent || ""}
                  onChange={(e) => updateExpenseItem(index, "actualSpent", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                    isOverBudget ? "border-red-300 bg-red-50 text-red-900 font-semibold" : "border-gray-300"
                  }`}
                />
              </div>

              {/* Variance Display */}
              {expense.quotedAmount > 0 && expense.actualSpent > 0 && (
                <div className="md:col-span-2">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    isOverBudget ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"
                  }`}>
                    {isOverBudget && <AlertTriangle className="h-4 w-4 text-red-600" />}
                    <span className={`font-semibold ${isOverBudget ? "text-red-700" : "text-green-700"}`}>
                      Variance: {variance >= 0 ? "+" : ""}R{variance.toFixed(2)}
                      {isOverBudget && " (Over Budget)"}
                    </span>
                  </div>
                </div>
              )}

              {/* Reason for Overspend (conditional) */}
              {isOverBudget && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-red-700 mb-1">
                    Reason for Overspend * (Required when over budget)
                  </label>
                  <textarea
                    value={expense.reasonForOverspend || ""}
                    onChange={(e) => updateExpenseItem(index, "reasonForOverspend", e.target.value)}
                    placeholder="Explain why the actual cost exceeded the quoted amount..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-red-300 bg-red-50 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Supplier Invoice Upload */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier Invoice
                </label>
                {expense.supplierInvoiceUrl ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={expense.supplierInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-sm bg-green-50 border border-green-200 rounded-lg text-green-700 hover:bg-green-100 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="truncate">Invoice uploaded</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => updateExpenseItem(index, "supplierInvoiceUrl", undefined)}
                      className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleInvoiceUpload(index, file);
                        }
                      }}
                      disabled={uploadingIndex === index}
                      className="hidden"
                      id={`invoice-upload-${index}`}
                    />
                    <label
                      htmlFor={`invoice-upload-${index}`}
                      className={`flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer transition-colors ${
                        uploadingIndex === index
                          ? "bg-gray-100 cursor-not-allowed"
                          : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      {uploadingIndex === index ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Upload Invoice</span>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addExpenseItem}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
      >
        <Plus className="h-5 w-5" />
        Add Expense Item
      </button>

      {expenses.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-blue-700">Total Quoted:</span>
              <span className="font-semibold text-blue-900">
                R{expenses.reduce((sum, e) => sum + e.quotedAmount, 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Total Spent:</span>
              <span className="font-semibold text-blue-900">
                R{expenses.reduce((sum, e) => sum + e.actualSpent, 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-blue-300 pt-1 mt-1">
              <span className="text-blue-700 font-medium">Variance:</span>
              <span className={`font-bold ${
                expenses.reduce((sum, e) => sum + (e.actualSpent - e.quotedAmount), 0) > 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}>
                {expenses.reduce((sum, e) => sum + (e.actualSpent - e.quotedAmount), 0) >= 0 ? "+" : ""}
                R{expenses.reduce((sum, e) => sum + (e.actualSpent - e.quotedAmount), 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
