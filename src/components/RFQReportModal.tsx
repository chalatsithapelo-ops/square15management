import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, FileText, User, Calendar, DollarSign, Wrench, Clock, Package } from "lucide-react";

interface QuotationLineItem {
  description: string;
  quantity?: number;
  category: string;
  notes?: string;
}

interface ExpenseSlip {
  category: string;
  description?: string;
  amount?: number;
  url: string;
}

interface Quotation {
  id: number;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  validUntil?: string;
  notes?: string;
  clientReferenceQuoteNumber?: string;
  createdAt: string;
  assignedTo?: {
    firstName: string;
    lastName: string;
  };
  quotationLineItems?: QuotationLineItem[];
  numPeopleNeeded?: number;
  estimatedDuration?: number;
  durationUnit?: "HOURLY" | "DAILY";
  labourRate?: number;
  companyMaterialCost?: number;
  companyLabourCost?: number;
  expenseSlips?: ExpenseSlip[];
}

interface RFQReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  onDownloadPdf?: (quotationId: number) => void;
  isDownloading?: boolean;
}

export function RFQReportModal({
  isOpen,
  onClose,
  quotation,
  onDownloadPdf,
  isDownloading = false,
}: RFQReportModalProps) {
  if (!quotation) return null;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-800" },
      PENDING_ARTISAN_REVIEW: { label: "Pending Artisan Review", className: "bg-yellow-100 text-yellow-800" },
      IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
      READY_FOR_REVIEW: { label: "Ready for Admin Review", className: "bg-orange-100 text-orange-800" },
      APPROVED: { label: "Approved", className: "bg-green-100 text-green-800" },
      REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-800" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-brand-primary-600 to-brand-primary-700 px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="rounded-lg bg-white/10 p-2">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-white">
                        RFQ Report - {quotation.quoteNumber}
                      </Dialog.Title>
                      <p className="text-sm text-white/80">Artisan Work Assessment</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6">
                  <div className="space-y-6">
                    {/* Basic Information */}
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <h4 className="mb-3 flex items-center text-sm font-semibold text-gray-900">
                        <Package className="mr-2 h-4 w-4 text-brand-primary-600" />
                        Request Information
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-gray-500">RFQ Number</label>
                          <p className="text-sm font-medium text-gray-900">{quotation.quoteNumber}</p>
                        </div>
                        {quotation.clientReferenceQuoteNumber && (
                          <div>
                            <label className="text-xs font-medium text-gray-500">Client Reference</label>
                            <p className="text-sm font-medium text-gray-900">{quotation.clientReferenceQuoteNumber}</p>
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-medium text-gray-500">Status</label>
                          <div className="mt-1">{getStatusBadge(quotation.status)}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Created Date</label>
                          <p className="text-sm text-gray-900">
                            {new Date(quotation.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <h4 className="mb-3 flex items-center text-sm font-semibold text-gray-900">
                        <User className="mr-2 h-4 w-4 text-brand-primary-600" />
                        Customer Information
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-gray-500">Name</label>
                          <p className="text-sm text-gray-900">{quotation.customerName}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Email</label>
                          <p className="text-sm text-gray-900">{quotation.customerEmail}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Phone</label>
                          <p className="text-sm text-gray-900">{quotation.customerPhone}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Address</label>
                          <p className="text-sm text-gray-900">{quotation.address}</p>
                        </div>
                      </div>
                    </div>

                    {quotation.assignedTo && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <h4 className="mb-3 flex items-center text-sm font-semibold text-gray-900">
                          <Wrench className="mr-2 h-4 w-4 text-brand-primary-600" />
                          Artisan Information
                        </h4>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Assigned Artisan</label>
                          <p className="text-sm font-medium text-gray-900">
                            {quotation.assignedTo.firstName} {quotation.assignedTo.lastName}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Scope of Work */}
                    {quotation.quotationLineItems && quotation.quotationLineItems.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-brand-primary-50 p-4">
                        <h4 className="mb-3 text-sm font-semibold text-gray-900">Scope of Work</h4>
                        <div className="space-y-2">
                          {quotation.quotationLineItems.map((item, idx) => (
                            <div key={idx} className="rounded bg-white p-3 text-sm shadow-sm">
                              <div className="mb-1 flex items-start justify-between">
                                <span className="font-medium text-gray-900">{item.description}</span>
                                <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                                  {item.category}
                                </span>
                              </div>
                              {item.quantity && (
                                <div className="text-xs text-gray-600">Quantity: {item.quantity}</div>
                              )}
                              {item.notes && (
                                <div className="mt-1 text-xs text-gray-600">{item.notes}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Labour Estimation */}
                    {quotation.numPeopleNeeded && quotation.estimatedDuration && quotation.durationUnit && (
                      <div className="rounded-lg border border-gray-200 bg-green-50 p-4">
                        <h4 className="mb-3 flex items-center text-sm font-semibold text-gray-900">
                          <Clock className="mr-2 h-4 w-4 text-green-600" />
                          Labour Estimation
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                          <div>
                            <label className="text-xs font-medium text-gray-600">People Needed</label>
                            <p className="font-medium text-gray-900">{quotation.numPeopleNeeded}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Duration</label>
                            <p className="font-medium text-gray-900">
                              {quotation.estimatedDuration}{" "}
                              {quotation.durationUnit === "HOURLY" ? "hours" : "days"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Rate</label>
                            <p className="font-medium text-gray-900">
                              R{quotation.labourRate?.toFixed(2) || "0.00"}/
                              {quotation.durationUnit === "HOURLY" ? "hr" : "day"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Labour Cost</label>
                            <p className="font-semibold text-gray-900">
                              R{quotation.companyLabourCost?.toFixed(2) || 
                                ((quotation.numPeopleNeeded || 0) * 
                                (quotation.estimatedDuration || 0) * 
                                (quotation.labourRate || 0)).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Supplier Quotations / Expense Slips */}
                    {quotation.expenseSlips && quotation.expenseSlips.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <h4 className="mb-3 text-sm font-semibold text-gray-900">
                          Supplier Quotations ({quotation.expenseSlips.length})
                        </h4>
                        <div className="space-y-2">
                          {quotation.expenseSlips.map((slip, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between rounded bg-white p-3 text-sm shadow-sm"
                            >
                              <div>
                                <div className="font-medium text-gray-900">
                                  {slip.category}
                                  {slip.description && ` - ${slip.description}`}
                                </div>
                                {slip.amount && (
                                  <div className="mt-1 text-xs text-gray-600">
                                    Amount: R{slip.amount.toFixed(2)}
                                  </div>
                                )}
                              </div>
                              <a
                                href={slip.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-brand-primary-600 hover:text-brand-primary-700"
                              >
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cost Summary */}
                    <div className="rounded-lg border border-gray-200 bg-brand-secondary-50 p-4">
                      <h4 className="mb-3 flex items-center text-sm font-semibold text-gray-900">
                        <DollarSign className="mr-2 h-4 w-4 text-brand-secondary-600" />
                        Cost Summary
                      </h4>
                      <div className="space-y-2 text-sm">
                        {quotation.companyMaterialCost !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Material Cost:</span>
                            <span className="font-medium text-gray-900">
                              R{quotation.companyMaterialCost.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {quotation.companyLabourCost !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Labour Cost:</span>
                            <span className="font-medium text-gray-900">
                              R{quotation.companyLabourCost.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-gray-300 pt-2">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-medium text-gray-900">R{quotation.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax (VAT):</span>
                          <span className="font-medium text-gray-900">R{quotation.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t-2 border-gray-400 pt-2">
                          <span className="font-bold text-gray-900">Total:</span>
                          <span className="text-lg font-bold text-gray-900">
                            R{quotation.total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {quotation.notes && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <h4 className="mb-2 text-sm font-semibold text-gray-900">Additional Notes</h4>
                        <p className="whitespace-pre-wrap text-sm text-gray-700">{quotation.notes}</p>
                      </div>
                    )}

                    {/* Valid Until */}
                    {quotation.validUntil && (
                      <div className="rounded-lg border border-gray-200 bg-yellow-50 p-4">
                        <div className="flex items-center text-sm">
                          <Calendar className="mr-2 h-4 w-4 text-yellow-600" />
                          <span className="text-gray-600">Valid Until:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {new Date(quotation.validUntil).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                  {onDownloadPdf && quotation && (
                    <button
                      onClick={() => onDownloadPdf(quotation.id)}
                      disabled={isDownloading}
                      className="inline-flex items-center rounded-lg bg-brand-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary-700 disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <>
                          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Download PDF
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default RFQReportModal;
