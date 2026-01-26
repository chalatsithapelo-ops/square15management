import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { X, Plus, Trash2 } from "lucide-react";

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitOfMeasure: string;
}

export function CreateInvoiceModal({ isOpen, onClose }: CreateInvoiceModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    invoiceNumber: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    address: "",
    dueDate: "",
    notes: "",
    companyMaterialCost: 0,
    companyLabourCost: 0,
    tax: 0,
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: "",
      quantity: 0,
      unitPrice: 0,
      total: 0,
      unitOfMeasure: "pcs",
    },
  ]);

  const createInvoiceMutation = useMutation(
    trpc.createInvoice.mutationOptions({
      onSuccess: () => {
        toast.success("Invoice created successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerInvoices.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getTenantInvoicesIssued.queryKey(),
        });
        resetForm();
        onClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create invoice.");
      },
    })
  );

  const resetForm = () => {
    setFormData({
      invoiceNumber: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      address: "",
      dueDate: "",
      notes: "",
      companyMaterialCost: 0,
      companyLabourCost: 0,
      tax: 0,
    });
    setItems([
      {
        description: "",
        quantity: 0,
        unitPrice: 0,
        total: 0,
        unitOfMeasure: "pcs",
      },
    ]);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const subtotal = calculateSubtotal();
  const vat = subtotal * 0.15; // Automatic 15% VAT
  const total = subtotal + vat;
  const estimatedProfit =
    total - formData.companyMaterialCost - formData.companyLabourCost;

  const handleItemChange = <K extends keyof InvoiceItem>(
    index: number,
    field: K,
    value: InvoiceItem[K]
  ) => {
    const updatedItems = [...items];
    const current = updatedItems[index]!;
    const next: InvoiceItem = { ...current };
    (next as any)[field] = value;

    // Auto-calculate total when quantity or unitPrice changes
    if (field === "quantity" || field === "unitPrice") {
      next.total = next.quantity * next.unitPrice;
    }

    updatedItems[index] = next;
    setItems(updatedItems);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: "",
        quantity: 0,
        unitPrice: 0,
        total: 0,
        unitOfMeasure: "pcs",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      toast.error("Invoice must have at least one item");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.customerName ||
      !formData.customerEmail ||
      !formData.address
    ) {
      toast.error("Please fill in all required customer fields");
      return;
    }

    if (items.some((item) => !item.description || item.quantity <= 0)) {
      toast.error("Please fill in all invoice items");
      return;
    }

    if (!token) {
      toast.error("No authentication token found");
      return;
    }

    createInvoiceMutation.mutate({
      token,
      invoiceNumber: formData.invoiceNumber || undefined,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      address: formData.address,
      items,
      subtotal,
      tax: vat, // Use calculated VAT
      total,
      companyMaterialCost: formData.companyMaterialCost,
      companyLabourCost: formData.companyLabourCost,
      estimatedProfit,
      dueDate: formData.dueDate || undefined,
      notes: formData.notes || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg sm:rounded-lg max-w-full sm:max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-6 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Create New Invoice</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 sm:w-6 h-5 sm:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* Invoice Header */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Invoice Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Invoice Number (optional - auto-generated if empty)"
                value={formData.invoiceNumber}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceNumber: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Customer Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Customer Name *"
                value={formData.customerName}
                onChange={(e) =>
                  setFormData({ ...formData, customerName: e.target.value })
                }
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="email"
                placeholder="Customer Email *"
                value={formData.customerEmail}
                onChange={(e) =>
                  setFormData({ ...formData, customerEmail: e.target.value })
                }
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="tel"
                placeholder="Customer Phone *"
                value={formData.customerPhone}
                onChange={(e) =>
                  setFormData({ ...formData, customerPhone: e.target.value })
                }
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="text"
                placeholder="Address *"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Invoice Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Invoice Items
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-start">
                    <div className="md:col-span-4">
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(index, "description", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        UoM
                      </label>
                      <select
                        value={item.unitOfMeasure}
                        onChange={(e) =>
                          handleItemChange(index, "unitOfMeasure", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="pcs">Pieces</option>
                        <option value="hrs">Hours</option>
                        <option value="m">Meters</option>
                        <option value="m2">Sq. Meters</option>
                        <option value="kg">Kilograms</option>
                        <option value="l">Liters</option>
                        <option value="unit">Unit</option>
                        <option value="box">Box</option>
                        <option value="roll">Roll</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "quantity",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "unitPrice",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Total
                      </label>
                      <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm font-medium text-gray-900">
                          R{item.total.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-1 pt-6">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Financial Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-sm text-gray-600">Company Material Cost (R)</p>
                <input
                  type="number"
                  step="0.01"
                  value={formData.companyMaterialCost}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      companyMaterialCost: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-sm text-gray-600">Company Labour Cost (R)</p>
                <input
                  type="number"
                  step="0.01"
                  value={formData.companyLabourCost}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      companyLabourCost: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal:</span>
                <span className="font-medium">R{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>VAT (15%):</span>
                <span className="font-medium">R{vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-900 font-bold text-lg border-t border-teal-200 pt-2">
                <span>Total:</span>
                <span>R{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Estimated Profit:</span>
                <span
                  className={`font-medium ${
                    estimatedProfit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  R{estimatedProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              rows={3}
              placeholder="Any additional notes or terms..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={createInvoiceMutation.isPending}
              className="flex-1 px-4 py-2 text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 rounded-lg font-medium transition-colors"
            >
              {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
