import { Waves, TrendingUp, TrendingDown, Building2, CreditCard, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface CashFlowStatementProps {
  invoices: any[];
  orders: any[];
  quotations: any[];
  paymentRequests: any[];
  assets: any[];
  liabilities: any[];
  dateRange: {
    start: string;
    end: string;
  };
  operationalExpenses?: any[];
  alternativeRevenues?: any[];
}

export default function CashFlowStatement({
  invoices,
  orders,
  quotations,
  paymentRequests,
  assets,
  liabilities,
  dateRange,
  operationalExpenses = [],
  alternativeRevenues = [],
}: CashFlowStatementProps) {
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);

  // OPERATING ACTIVITIES
  const cashFromCustomers = invoices
    .filter((i) => i.status === "PAID" && i.paidDate)
    .filter((i) => {
      const paidDate = new Date(i.paidDate);
      return paidDate >= startDate && paidDate <= endDate;
    })
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const alternativeRevenueInflows = alternativeRevenues
    .filter((rev) => rev.status === "APPROVED")
    .filter((rev) => {
      const revDate = new Date(rev.date || rev.createdAt);
      return revDate >= startDate && revDate <= endDate;
    })
    .reduce((sum, rev) => sum + (rev.amount || 0), 0);

  const totalOperatingInflows = cashFromCustomers + alternativeRevenueInflows;

  const orderMaterialCosts = orders.reduce((sum, o) => sum + (o.materialCost || 0), 0);
  const orderLabourCosts = orders.reduce((sum, o) => sum + (o.labourCost || 0), 0);
  
  const quotationMaterialCosts = quotations
    .filter((q) => q.status === "APPROVED")
    .reduce((sum, q) => sum + (q.companyMaterialCost || 0), 0);
  
  const quotationLabourCosts = quotations
    .filter((q) => q.status === "APPROVED")
    .reduce((sum, q) => sum + (q.companyLabourCost || 0), 0);

  const cashPaidToSuppliers = orderMaterialCosts + quotationMaterialCosts;
  const cashPaidForLabour = orderLabourCosts + quotationLabourCosts;

  const cashPaidToArtisans = paymentRequests
    .filter((pr) => pr.status === "PAID" && pr.paidDate)
    .filter((pr) => {
      const paidDate = new Date(pr.paidDate);
      return paidDate >= startDate && paidDate <= endDate;
    })
    .reduce((sum, pr) => sum + (pr.calculatedAmount || 0), 0);

  const operationalExpenseOutflows = operationalExpenses
    .filter((exp) => exp.status === "APPROVED")
    .filter((exp) => {
      const expDate = new Date(exp.date || exp.createdAt);
      return expDate >= startDate && expDate <= endDate;
    })
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const totalOperatingOutflows = cashPaidToSuppliers + cashPaidForLabour + cashPaidToArtisans + operationalExpenseOutflows;
  const netCashFromOperating = totalOperatingInflows - totalOperatingOutflows;

  // INVESTING ACTIVITIES
  const assetPurchases = assets
    .filter((a) => {
      const purchaseDate = new Date(a.purchaseDate);
      return purchaseDate >= startDate && purchaseDate <= endDate;
    })
    .reduce((sum, a) => sum + (a.purchasePrice || 0), 0);

  const assetSales = 0; // Simplified - would need asset disposal tracking
  const netCashFromInvesting = assetSales - assetPurchases;

  // FINANCING ACTIVITIES
  const newLiabilities = liabilities
    .filter((l) => {
      const createdDate = new Date(l.createdAt);
      return createdDate >= startDate && createdDate <= endDate;
    })
    .reduce((sum, l) => sum + (l.amount || 0), 0);

  const liabilityPayments = liabilities
    .filter((l) => l.isPaid && l.paidDate)
    .filter((l) => {
      const paidDate = new Date(l.paidDate!);
      return paidDate >= startDate && paidDate <= endDate;
    })
    .reduce((sum, l) => sum + (l.amount || 0), 0);

  const netCashFromFinancing = newLiabilities - liabilityPayments;

  // NET CHANGE IN CASH
  const netCashChange = netCashFromOperating + netCashFromInvesting + netCashFromFinancing;

  // For beginning/ending cash, we use a simplified approach
  // In a production system, this would be tracked in the database
  const beginningCash = 0;
  const endingCash = beginningCash + netCashChange;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b-2 border-gray-300">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Waves className="w-6 h-6 text-cyan-600" />
          <h2 className="text-2xl font-bold text-gray-900">Cash Flow Statement</h2>
        </div>
        <p className="text-sm text-gray-600">
          Period: {format(new Date(dateRange.start), 'dd MMM yyyy')} - {format(new Date(dateRange.end), 'dd MMM yyyy')}
        </p>
      </div>

      {/* Operating Activities Section */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-blue-900">CASH FLOWS FROM OPERATING ACTIVITIES</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Cash Received from Customers</span>
            <span className="font-semibold text-green-600">R {cashFromCustomers.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Alternative Revenue Inflows</span>
            <span className="font-semibold text-green-600">R {alternativeRevenueInflows.toLocaleString()}</span>
          </div>
          <div className="pt-2 border-t border-blue-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Cash Paid for:</p>
            <div className="space-y-2 pl-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Suppliers (Materials)</span>
                <span className="text-red-600">(R {cashPaidToSuppliers.toLocaleString()})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Labour Costs</span>
                <span className="text-red-600">(R {cashPaidForLabour.toLocaleString()})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Artisan Payments</span>
                <span className="text-red-600">(R {cashPaidToArtisans.toLocaleString()})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Operational Expenses</span>
                <span className="text-red-600">(R {operationalExpenseOutflows.toLocaleString()})</span>
              </div>
            </div>
          </div>
          <div className="pt-2 border-t-2 border-blue-300">
            <div className="flex justify-between items-center">
              <span className="font-bold text-blue-900">Net Cash from Operating Activities</span>
              <span className={`text-xl font-bold ${netCashFromOperating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R {netCashFromOperating.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Investing Activities Section */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-bold text-purple-900">CASH FLOWS FROM INVESTING ACTIVITIES</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Asset Purchases</span>
            <span className="text-red-600">(R {assetPurchases.toLocaleString()})</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Asset Sales</span>
            <span className="text-green-600">R {assetSales.toLocaleString()}</span>
          </div>
          <div className="pt-2 border-t-2 border-purple-300">
            <div className="flex justify-between items-center">
              <span className="font-bold text-purple-900">Net Cash from Investing Activities</span>
              <span className={`text-xl font-bold ${netCashFromInvesting >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R {netCashFromInvesting.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Financing Activities Section */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-bold text-amber-900">CASH FLOWS FROM FINANCING ACTIVITIES</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">New Loans/Liabilities</span>
            <span className="text-green-600">R {newLiabilities.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Loan/Liability Payments</span>
            <span className="text-red-600">(R {liabilityPayments.toLocaleString()})</span>
          </div>
          <div className="pt-2 border-t-2 border-amber-300">
            <div className="flex justify-between items-center">
              <span className="font-bold text-amber-900">Net Cash from Financing Activities</span>
              <span className={`text-xl font-bold ${netCashFromFinancing >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R {netCashFromFinancing.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Change in Cash Section */}
      <div className={`rounded-xl p-6 border-2 ${
        netCashChange >= 0 
          ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
          : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-300'
      }`}>
        <div className="space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-gray-300">
            <span className="text-lg font-bold text-gray-900">NET INCREASE/(DECREASE) IN CASH</span>
            <span className={`text-3xl font-bold ${netCashChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R {netCashChange.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Cash at Beginning of Period</span>
            <span className="font-semibold text-gray-900">R {beginningCash.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
            <span className="text-lg font-bold text-gray-900">Cash at End of Period</span>
            <span className={`text-2xl font-bold ${endingCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R {endingCash.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cash Inflow
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cash Outflow
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Cash Flow
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  Operating Activities
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                  R {cashFromCustomers.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                  R {totalOperatingOutflows.toLocaleString()}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                  netCashFromOperating >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  R {netCashFromOperating.toLocaleString()}
                </td>
              </tr>
              <tr className="bg-purple-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  Investing Activities
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                  R {assetSales.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                  R {assetPurchases.toLocaleString()}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                  netCashFromInvesting >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  R {netCashFromInvesting.toLocaleString()}
                </td>
              </tr>
              <tr className="bg-amber-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  Financing Activities
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                  R {newLiabilities.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                  R {liabilityPayments.toLocaleString()}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                  netCashFromFinancing >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  R {netCashFromFinancing.toLocaleString()}
                </td>
              </tr>
              <tr className={netCashChange >= 0 ? 'bg-green-50' : 'bg-red-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  Net Change in Cash
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  -
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${
                  netCashChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  R {netCashChange.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Flow Insights */}
      {netCashFromOperating < 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <TrendingDown className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-900">Negative Operating Cash Flow</p>
              <p className="text-sm text-orange-700 mt-1">
                Your business is spending more cash on operations than it's receiving from customers. 
                Consider reviewing payment terms, collection processes, or operational efficiency.
              </p>
            </div>
          </div>
        </div>
      )}

      {netCashFromOperating > 0 && netCashChange < 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">Positive Operating Cash Flow</p>
              <p className="text-sm text-blue-700 mt-1">
                Your core operations are generating positive cash flow, which is a healthy sign. 
                The overall cash decrease is due to investments or financing activities.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
