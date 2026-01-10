import { TrendingDown, DollarSign, Users, Package } from "lucide-react";
import { ExpenseBreakdownChart } from "~/components/charts/ExpenseBreakdownChart";

interface ExpenseAnalyticsProps {
  expenses: any[];
  orders: any[];
  quotations: any[];
  expensesByCategory: {
    artisan_payments: number;
    materials: number;
    labour: number;
  };
  totalExpenses: number;
  materialCosts: number;
  labourCosts: number;
  artisanPayments: number;
  operationalExpenses?: any[];
  operationalExpensesTotal?: number;
}

export default function ExpenseAnalytics({
  expenses,
  orders,
  quotations,
  expensesByCategory,
  totalExpenses,
  materialCosts,
  labourCosts,
  artisanPayments,
  operationalExpenses = [],
  operationalExpensesTotal = 0,
}: ExpenseAnalyticsProps) {
  // Ensure all numeric values are safe
  const safeArtisanPayments = Number(artisanPayments) || 0;
  const safeMaterialCosts = Number(materialCosts) || 0;
  const safeLabourCosts = Number(labourCosts) || 0;
  const safeOperationalExpensesTotal = Number(operationalExpensesTotal) || 0;
  const safeTotalExpenses = Number(totalExpenses) || 0;
  const safeExpenses = expenses || [];
  const safeOrders = orders || [];
  const safeQuotations = quotations || [];
  const safeOperationalExpenses = operationalExpenses || [];
  
  const grandTotalExpenses = safeTotalExpenses + safeOperationalExpensesTotal;
  
  return (
    <div className="space-y-6">
      {/* Total Expenses Summary */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-purple-700 mb-1">Total Expenses</h3>
            <p className="text-3xl font-bold text-purple-900">
              R {grandTotalExpenses.toLocaleString()}
            </p>
            <p className="text-xs text-purple-600 mt-1">
              Project Expenses: R {safeTotalExpenses.toLocaleString()} + Operational: R {safeOperationalExpensesTotal.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-purple-500 rounded-lg">
            <TrendingDown className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-red-700 bg-red-200 px-2 py-1 rounded-full">
              Artisans
            </span>
          </div>
          <h3 className="text-2xl font-bold text-red-900 mb-1">
            R {safeArtisanPayments.toLocaleString()}
          </h3>
          <p className="text-sm text-red-700">Artisan Payments</p>
          <div className="mt-3 pt-3 border-t border-red-200">
            <p className="text-xs text-red-600">
              {safeExpenses.filter(e => e.status === 'PAID').length} payments processed
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-500 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-amber-700 bg-amber-200 px-2 py-1 rounded-full">
              Materials
            </span>
          </div>
          <h3 className="text-2xl font-bold text-amber-900 mb-1">
            R {safeMaterialCosts.toLocaleString()}
          </h3>
          <p className="text-sm text-amber-700">Material Costs</p>
          <div className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-xs text-amber-600">
              {safeOrders.length + safeQuotations.filter(q => q.status === 'APPROVED').length} jobs
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500 rounded-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-orange-700 bg-orange-200 px-2 py-1 rounded-full">
              Labour
            </span>
          </div>
          <h3 className="text-2xl font-bold text-orange-900 mb-1">
            R {safeLabourCosts.toLocaleString()}
          </h3>
          <p className="text-sm text-orange-700">Labour Costs</p>
          <div className="mt-3 pt-3 border-t border-orange-200">
            <p className="text-xs text-orange-600">
              Across all projects
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500 rounded-lg">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-purple-700 bg-purple-200 px-2 py-1 rounded-full">
              Operational
            </span>
          </div>
          <h3 className="text-2xl font-bold text-purple-900 mb-1">
            R {safeOperationalExpensesTotal.toLocaleString()}
          </h3>
          <p className="text-sm text-purple-700">Operational Expenses</p>
          <div className="mt-3 pt-3 border-t border-purple-200">
            <p className="text-xs text-purple-600">
              {safeOperationalExpenses.filter(e => e.status === 'APPROVED').length} expenses approved
            </p>
          </div>
        </div>
      </div>

      {/* Expense Breakdown Chart */}
      <ExpenseBreakdownChart
        labourCosts={safeLabourCosts}
        materialCosts={safeMaterialCosts}
        artisanPayments={safeArtisanPayments}
      />

      {/* Recent Expenses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Expense Transactions</h2>
        </div>
        
        {safeExpenses.length === 0 ? (
          <div className="text-center py-8">
            <TrendingDown className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No expense transactions in this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Artisan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {safeExpenses.slice(0, 10).map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(expense.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.artisan?.firstName} {expense.artisan?.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {expense.hoursWorked ? 'Hourly' : expense.daysWorked ? 'Daily' : 'Fixed'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        expense.status === 'PAID' 
                          ? 'bg-green-100 text-green-800'
                          : expense.status === 'APPROVED'
                          ? 'bg-blue-100 text-blue-800'
                          : expense.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {expense.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                      R {(expense.calculatedAmount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
