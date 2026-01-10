import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState, useEffect } from "react";
import { X, Bell, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";

// Notification type categories and labels
const NOTIFICATION_CATEGORIES = {
  "Order Updates": [
    { type: "ORDER_ASSIGNED", label: "Order assignments" },
    { type: "ORDER_STATUS_UPDATED", label: "Order status changes" },
    { type: "ORDER_COMPLETED", label: "Order completions" },
  ],
  "Quotation Updates": [
    { type: "QUOTATION_ASSIGNED", label: "Quotation assignments" },
    { type: "QUOTATION_STATUS_UPDATED", label: "Quotation status changes" },
    { type: "QUOTATION_READY_FOR_REVIEW", label: "Quotations ready for review" },
  ],
  "Invoice & Payment": [
    { type: "INVOICE_CREATED", label: "New invoices" },
    { type: "INVOICE_STATUS_UPDATED", label: "Invoice status changes" },
    { type: "PAYMENT_REQUEST_CREATED", label: "Payment requests" },
    { type: "PAYMENT_REQUEST_APPROVED", label: "Payment approvals" },
    { type: "PAYMENT_REQUEST_REJECTED", label: "Payment rejections" },
    { type: "PAYMENT_REQUEST_PAID", label: "Payment confirmations" },
    { type: "STATEMENT_GENERATED", label: "Statement generation" },
  ],
  "Project & Milestone": [
    { type: "PROJECT_ASSIGNED", label: "Project assignments" },
    { type: "PROJECT_STATUS_UPDATED", label: "Project status changes" },
    { type: "MILESTONE_ASSIGNED", label: "Milestone assignments" },
    { type: "MILESTONE_STATUS_UPDATED", label: "Milestone status changes" },
  ],
  "Property Management": [
    { type: "RFQ_SUBMITTED", label: "RFQ submissions" },
    { type: "RFQ_QUOTED", label: "RFQ quotes" },
    { type: "RFQ_APPROVED", label: "RFQ approvals" },
    { type: "RFQ_REJECTED", label: "RFQ rejections" },
    { type: "PM_ORDER_SUBMITTED", label: "Property manager orders" },
    { type: "PM_ORDER_ACCEPTED", label: "Order acceptances" },
    { type: "PM_ORDER_STATUS_UPDATED", label: "Order status updates" },
    { type: "PM_ORDER_COMPLETED", label: "Order completions" },
    { type: "PM_INVOICE_SENT", label: "Invoice notifications" },
    { type: "PM_INVOICE_APPROVED", label: "Invoice approvals" },
    { type: "PM_INVOICE_REJECTED", label: "Invoice rejections" },
    { type: "PM_INVOICE_OVERDUE", label: "Overdue invoices" },
    { type: "MAINTENANCE_REQUEST_SUBMITTED", label: "Maintenance requests" },
    { type: "MAINTENANCE_REQUEST_APPROVED", label: "Maintenance approvals" },
    { type: "MAINTENANCE_REQUEST_COMPLETED", label: "Maintenance completions" },
    { type: "BUDGET_THRESHOLD_REACHED", label: "Budget alerts" },
    { type: "SCHEDULED_MAINTENANCE_DUE", label: "Scheduled maintenance" },
  ],
  "Communication & Other": [
    { type: "MESSAGE_RECEIVED", label: "New messages" },
    { type: "LEAD_FOLLOW_UP_REMINDER", label: "Lead follow-up reminders" },
    { type: "SYSTEM_ALERT", label: "System alerts" },
  ],
} as const;

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationSettingsModal({
  isOpen,
  onClose,
}: NotificationSettingsModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [localDisabledTypes, setLocalDisabledTypes] = useState<string[]>([]);

  // Fetch current preferences
  const preferencesQuery = useQuery(
    trpc.getUserNotificationPreferences.queryOptions(
      {
        token: token!,
      },
      {
        enabled: !!token && isOpen,
      }
    )
  );

  // Sync local state with fetched data
  useEffect(() => {
    if (preferencesQuery.data) {
      setLocalDisabledTypes(preferencesQuery.data.disabledNotificationTypes);
    }
  }, [preferencesQuery.data]);

  // Update preferences mutation
  const updatePreferencesMutation = useMutation(
    trpc.updateUserNotificationPreferences.mutationOptions({
      onSuccess: () => {
        toast.success("Notification preferences updated");
        queryClient.invalidateQueries({
          queryKey: trpc.getUserNotificationPreferences.queryKey(),
        });
        onClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update preferences");
      },
    })
  );

  const handleToggle = (type: string) => {
    setLocalDisabledTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleSave = () => {
    updatePreferencesMutation.mutate({
      token: token!,
      disabledTypes: localDisabledTypes as any[],
    });
  };

  const handleSelectAll = () => {
    setLocalDisabledTypes([]);
  };

  const handleDeselectAll = () => {
    const allTypes = Object.values(NOTIFICATION_CATEGORIES)
      .flat()
      .map((item) => item.type);
    setLocalDisabledTypes(allTypes);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Settings className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-semibold text-gray-900"
                      >
                        Notification Preferences
                      </Dialog.Title>
                      <p className="text-sm text-gray-600">
                        Choose which notifications you want to receive
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {preferencesQuery.isLoading ? (
                  <div className="py-8 text-center text-gray-600">
                    Loading preferences...
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={handleSelectAll}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Enable All
                      </button>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={handleDeselectAll}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Disable All
                      </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto space-y-6 mb-6">
                      {Object.entries(NOTIFICATION_CATEGORIES).map(
                        ([category, items]) => (
                          <div key={category} className="space-y-3">
                            <h4 className="font-medium text-gray-900 text-sm">
                              {category}
                            </h4>
                            <div className="space-y-2 pl-4">
                              {items.map((item) => {
                                const isEnabled = !localDisabledTypes.includes(
                                  item.type
                                );
                                return (
                                  <label
                                    key={item.type}
                                    className="flex items-center gap-3 cursor-pointer group"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => handleToggle(item.type)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                                      {item.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={updatePreferencesMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updatePreferencesMutation.isPending
                          ? "Saving..."
                          : "Save Preferences"}
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
