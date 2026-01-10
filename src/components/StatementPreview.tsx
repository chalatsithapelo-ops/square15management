import { FileText, Calendar, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";

interface InvoiceDetail {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  original_amount: number;
  amount_paid: number;
  balance: number;
  days_overdue: number;
  interest_charged: number;
  total_due: number;
  age_category: string;
  order_number?: string;
  building?: string;
  description?: string;
}

interface AgeAnalysis {
  current: number;
  days_31_60: number;
  days_61_90: number;
  days_91_120: number;
  over_120: number;
}

interface StatementPreviewProps {
  statement: {
    id: number;
    statement_number: string;
    client_name: string;
    client_email: string;
    customerPhone: string | null;
    address: string | null;
    statement_date: Date;
    period_start: Date;
    period_end: Date;
    invoice_details: InvoiceDetail[] | any;
    age_analysis: AgeAnalysis | any;
    subtotal: number;
    total_interest: number;
    total_amount_due: number;
    payments_received: number;
    previous_balance: number;
    sent_date: Date | null;
    notes: string | null;
    status: string;
  };
}

export function StatementPreview({ statement }: StatementPreviewProps) {
  const invoiceDetails = Array.isArray(statement.invoice_details) 
    ? statement.invoice_details 
    : [];
  
  const ageAnalysis = statement.age_analysis as AgeAnalysis || {
    current: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_91_120: 0,
    over_120: 0,
  };

  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-ZA', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-gray-200 pb-4">
        <div>
          <h3 className="text-2xl font-bold text-blue-600">STATEMENT</h3>
          <p className="text-sm text-gray-600 mt-1">
            Statement #{statement.statement_number}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-gray-600">Date: {formatDate(statement.statement_date)}</p>
          <p className="text-gray-600">Period: {formatDate(statement.period_start)} - {formatDate(statement.period_end)}</p>
          {statement.sent_date && (
            <p className="text-gray-600">Sent: {formatDate(statement.sent_date)}</p>
          )}
        </div>
      </div>

      {/* Bill To and Account Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bill To Section */}
        <div className="border-2 border-green-500 rounded-lg overflow-hidden">
          <div className="bg-green-500 text-white px-4 py-2 font-semibold">
            BILL TO
          </div>
          <div className="p-4 bg-green-50">
            <p className="font-semibold text-gray-900">{statement.client_name}</p>
            {statement.address && (
              <p className="text-sm text-gray-700 mt-1">{statement.address}</p>
            )}
            <p className="text-sm text-gray-700 mt-1">{statement.client_email}</p>
            {statement.customerPhone && (
              <p className="text-sm text-gray-700">Tel: {statement.customerPhone}</p>
            )}
          </div>
        </div>

        {/* Account Summary Section */}
        <div className="border-2 border-green-500 rounded-lg overflow-hidden">
          <div className="bg-green-500 text-white px-4 py-2 font-semibold">
            ACCOUNT SUMMARY
          </div>
          <div className="p-4 bg-green-50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Previous Balance:</span>
              <span className="font-semibold text-gray-900">{formatCurrency(statement.previous_balance ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Amount Paid:</span>
              <span className="font-semibold text-green-600">{formatCurrency(statement.payments_received ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">New Charges:</span>
              <span className="font-semibold text-gray-900">{formatCurrency(statement.subtotal ?? 0)}</span>
            </div>
            {(statement.total_interest ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Interest Charges:</span>
                <span className="font-semibold text-red-600">{formatCurrency(statement.total_interest ?? 0)}</span>
              </div>
            )}
            <div className="border-t-2 border-green-300 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-bold text-gray-900">Total Balance Due:</span>
                <span className="font-bold text-lg text-green-700">{formatCurrency(statement.total_amount_due ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Details Table */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-gray-700" />
          Invoice Details
        </h4>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Charges
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount Credited
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Interest
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoiceDetails.map((invoice: InvoiceDetail, index: number) => (
                <tr key={invoice.invoice_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(invoice.invoice_date)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {invoice.due_date ? formatDate(invoice.due_date) : 'N/A'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(invoice.original_amount ?? 0)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-green-600">
                    {formatCurrency(invoice.amount_paid ?? 0)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {formatCurrency(invoice.balance ?? 0)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-red-600">
                    {(invoice.interest_charged ?? 0) > 0 ? formatCurrency(invoice.interest_charged ?? 0) : '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                    {formatCurrency(invoice.total_due ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr>
                <td colSpan={5} className="px-3 py-3 text-right text-sm font-semibold text-gray-900">
                  Totals:
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                  {formatCurrency(statement.subtotal ?? 0)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-bold text-red-600">
                  {formatCurrency(statement.total_interest ?? 0)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-bold text-green-700">
                  {formatCurrency(statement.total_amount_due ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Age Analysis */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-gray-700" />
          Age Analysis
        </h4>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  31-60 Days
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  61-90 Days
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  91-120 Days
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Over 120 Days
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-100">
                  Account Balance Due
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr>
                <td className="px-4 py-4 text-center text-sm font-medium text-gray-900">
                  {formatCurrency(ageAnalysis.current ?? 0)}
                </td>
                <td className="px-4 py-4 text-center text-sm font-medium text-gray-900">
                  {formatCurrency(ageAnalysis.days_31_60 ?? 0)}
                </td>
                <td className="px-4 py-4 text-center text-sm font-medium text-gray-900">
                  {formatCurrency(ageAnalysis.days_61_90 ?? 0)}
                </td>
                <td className="px-4 py-4 text-center text-sm font-medium text-gray-900">
                  {formatCurrency(ageAnalysis.days_91_120 ?? 0)}
                </td>
                <td className="px-4 py-4 text-center text-sm font-medium text-gray-900">
                  {formatCurrency(ageAnalysis.over_120 ?? 0)}
                </td>
                <td className="px-4 py-4 text-center text-lg font-bold text-green-700 bg-green-50">
                  {formatCurrency(statement.total_amount_due ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {statement.notes && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="text-sm font-semibold text-blue-900 mb-1">Notes:</h5>
              <p className="text-sm text-blue-800">{statement.notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Overdue Warning */}
      {(statement.total_interest ?? 0) > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="text-sm font-semibold text-red-900 mb-1">Overdue Notice:</h5>
              <p className="text-sm text-red-800">
                Interest charges of {formatCurrency(statement.total_interest ?? 0)} have been applied to overdue invoices at 2% per month (cumulative). 
                Please settle outstanding balances immediately to avoid further charges.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
