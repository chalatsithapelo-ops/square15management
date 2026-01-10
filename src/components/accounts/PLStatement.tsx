import { FileText, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

interface PLStatementProps {
  revenue: number;
  invoiceRevenue: number;
  alternativeRevenueTotal?: number;
  revenueBreakdown?: Record<string, number>;
  materialCosts: number;
  labourCosts: number;
  artisanPayments: number;
  expensesByCategory: {
    artisan_payments: number;
    materials: number;
    labour: number;
    operational_expenses?: number;
    operationalBreakdown?: Record<string, number>;
  };
  netProfit: number;
  dateRange: {
    start: string;
    end: string;
  };
}

// Map revenue category codes to readable names
const revenueCategoryLabels: Record<string, string> = {
  CONSULTING: "Consulting Services",
  RENTAL_INCOME: "Rental Income",
  INTEREST: "Interest Income",
  INVESTMENTS: "Investment Returns",
  GRANTS: "Grants",
  DONATIONS: "Donations",
  OTHER: "Other Revenue",
};

// Map expense category codes to readable names
const expenseCategoryLabels: Record<string, string> = {
  PETROL: "Fuel/Petrol",
  OFFICE_SUPPLIES: "Office Supplies",
  RENT: "Rent",
  UTILITIES: "Utilities",
  INSURANCE: "Insurance",
  SALARIES: "Salaries",
  MARKETING: "Marketing",
  MAINTENANCE: "Maintenance",
  TRAVEL: "Travel",
  PROFESSIONAL_FEES: "Professional Fees",
  TELECOMMUNICATIONS: "Telecommunications",
  SOFTWARE_SUBSCRIPTIONS: "Software Subscriptions",
  OTHER: "Other Expenses",
};

export default function PLStatement({
  revenue,
  invoiceRevenue,
  alternativeRevenueTotal = 0,
  revenueBreakdown = {},
  materialCosts,
  labourCosts,
  artisanPayments,
  expensesByCategory,
  netProfit,
  dateRange,
}: PLStatementProps) {
  const operationalBreakdown = expensesByCategory.operationalBreakdown || {};
  const operationalTotal = Object.values(operationalBreakdown).reduce((sum, val) => sum + val, 0);
  
  const totalExpenses = (artisanPayments || 0) + (materialCosts || 0) + (labourCosts || 0) + operationalTotal;
  const profitMargin = (revenue || 0) > 0 ? (((netProfit || 0) / (revenue || 0)) * 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b-2 border-gray-300">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h2>
        </div>
        <p className="text-sm text-gray-600">
          Period: {format(new Date(dateRange.start), 'dd MMM yyyy')} - {format(new Date(dateRange.end), 'dd MMM yyyy')}
        </p>
      </div>

      {/* Revenue Section */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-bold text-green-900">REVENUE</h3>
        </div>
        <div className="space-y-2">
          {/* Invoice Revenue */}
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Paid Invoices</span>
            <span className="font-semibold text-gray-900">R {invoiceRevenue.toLocaleString()}</span>
          </div>

          {/* Alternative Revenue - Dynamic Categories */}
          {Object.entries(revenueBreakdown).map(([category, amount]) => (
            <div key={category} className="flex justify-between items-center py-2">
              <span className="text-gray-700">{revenueCategoryLabels[category] || category}</span>
              <span className="font-semibold text-gray-900">R {amount.toLocaleString()}</span>
            </div>
          ))}

          <div className="pt-2 border-t-2 border-green-300">
            <div className="flex justify-between items-center">
              <span className="font-bold text-green-900">Total Revenue</span>
              <span className="text-xl font-bold text-green-600">R {revenue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 border border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-bold text-red-900">EXPENSES</h3>
        </div>
        <div className="space-y-2">
          {/* Core Business Expenses */}
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Material Costs</span>
            <span className="font-semibold text-gray-900">R {materialCosts.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Labour Costs</span>
            <span className="font-semibold text-gray-900">R {labourCosts.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Artisan Payments</span>
            <span className="font-semibold text-gray-900">R {artisanPayments.toLocaleString()}</span>
          </div>

          {/* Operational Expenses - Dynamic Categories */}
          {Object.entries(operationalBreakdown).map(([category, amount]) => (
            <div key={category} className="flex justify-between items-center py-2">
              <span className="text-gray-700">{expenseCategoryLabels[category] || category}</span>
              <span className="font-semibold text-gray-900">R {amount.toLocaleString()}</span>
            </div>
          ))}

          <div className="pt-2 border-t-2 border-red-300">
            <div className="flex justify-between items-center">
              <span className="font-bold text-red-900">Total Expenses</span>
              <span className="text-xl font-bold text-red-600">R {totalExpenses.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Profit/Loss Section */}
      <div className={`rounded-xl p-6 border-2 ${
        netProfit >= 0 
          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300'
          : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-300'
      }`}>
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-gray-300">
            <span className="text-lg font-bold text-gray-900">NET {netProfit >= 0 ? 'PROFIT' : 'LOSS'}</span>
            <span className={`text-3xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              R {netProfit.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Profit Margin</span>
            <span className={`text-xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {profitMargin}%
            </span>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % of Revenue
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="bg-green-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  Total Revenue
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                  R {revenue.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                  100.00%
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  Material Costs
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  R {materialCosts.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                  {revenue > 0 ? ((materialCosts / revenue) * 100).toFixed(2) : '0.00'}%
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  Labour Costs
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  R {labourCosts.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                  {revenue > 0 ? ((labourCosts / revenue) * 100).toFixed(2) : '0.00'}%
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  Artisan Payments
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  R {artisanPayments.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                  {revenue > 0 ? ((artisanPayments / revenue) * 100).toFixed(2) : '0.00'}%
                </td>
              </tr>
              <tr className="bg-red-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  Total Expenses
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                  R {totalExpenses.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                  {revenue > 0 ? ((totalExpenses / revenue) * 100).toFixed(2) : '0.00'}%
                </td>
              </tr>
              <tr className={netProfit >= 0 ? 'bg-blue-50' : 'bg-orange-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  Net {netProfit >= 0 ? 'Profit' : 'Loss'}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${
                  netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}>
                  R {netProfit.toLocaleString()}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${
                  netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}>
                  {profitMargin}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
