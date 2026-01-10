import { Building2, AlertTriangle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface BalanceSheetProps {
  assets: any[];
  liabilities: any[];
  paymentRequests: any[];
  dateRange: {
    start: string;
    end: string;
  };
}

export default function BalanceSheet({
  assets,
  liabilities,
  paymentRequests,
  dateRange,
}: BalanceSheetProps) {
  const totalAssets = assets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);

  const unpaidLiabilities = liabilities.filter(l => !l.isPaid);
  
  // Define explicit categories to check
  const explicitCategories = ['LOAN', 'ACCOUNTS_PAYABLE', 'CREDIT_LINE'];
  
  const accountsPayable = unpaidLiabilities
    .filter(l => l.category === 'ACCOUNTS_PAYABLE')
    .reduce((sum, l) => sum + l.amount, 0);
  const loans = unpaidLiabilities
    .filter(l => l.category === 'LOAN')
    .reduce((sum, l) => sum + l.amount, 0);
  const creditLines = unpaidLiabilities
    .filter(l => l.category === 'CREDIT_LINE')
    .reduce((sum, l) => sum + l.amount, 0);
  
  // Calculate other liabilities (including those with category 'OTHER' or null/undefined)
  const otherLiabilities = unpaidLiabilities
    .filter(l => !explicitCategories.includes(l.category as any))
    .reduce((sum, l) => sum + l.amount, 0);

  const pendingPayments = paymentRequests
    .filter(pr => pr.status === 'APPROVED' || pr.status === 'PENDING')
    .reduce((sum, pr) => sum + (pr.calculatedAmount || 0), 0);

  const totalLiabilities = accountsPayable + loans + creditLines + otherLiabilities + pendingPayments;
  const equity = totalAssets - totalLiabilities;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b-2 border-gray-300">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Building2 className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-900">Balance Sheet</h2>
        </div>
        <p className="text-sm text-gray-600">
          As of {format(new Date(dateRange.end), 'dd MMMM yyyy')}
        </p>
      </div>

      {/* Assets Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-blue-900">ASSETS</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Current Assets</span>
            <span className="font-semibold text-gray-900">R {totalAssets.toLocaleString()}</span>
          </div>
          <div className="pt-2 border-t-2 border-blue-300">
            <div className="flex justify-between items-center">
              <span className="font-bold text-blue-900">Total Assets</span>
              <span className="text-xl font-bold text-blue-600">R {totalAssets.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Assets Breakdown */}
        {assets.length > 0 && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Asset Breakdown:</p>
            <div className="space-y-1">
              {assets.slice(0, 5).map((asset) => (
                <div key={asset.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{asset.name}</span>
                  <span className="text-gray-900">R {(asset.currentValue || 0).toLocaleString()}</span>
                </div>
              ))}
              {assets.length > 5 && (
                <p className="text-xs text-gray-500 mt-2">
                  ... and {assets.length - 5} more assets
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Liabilities Section */}
      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-bold text-orange-900">LIABILITIES</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Accounts Payable</span>
            <span className="font-semibold text-gray-900">R {accountsPayable.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Loans</span>
            <span className="font-semibold text-gray-900">R {loans.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Credit Lines</span>
            <span className="font-semibold text-gray-900">R {creditLines.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Other Liabilities</span>
            <span className="font-semibold text-gray-900">R {otherLiabilities.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Pending Artisan Payments</span>
            <span className="font-semibold text-gray-900">R {pendingPayments.toLocaleString()}</span>
          </div>
          <div className="pt-2 border-t-2 border-orange-300">
            <div className="flex justify-between items-center">
              <span className="font-bold text-orange-900">Total Liabilities</span>
              <span className="text-xl font-bold text-orange-600">R {totalLiabilities.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Equity Section */}
      <div className={`rounded-xl p-6 border-2 ${
        equity >= 0 
          ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
          : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-300'
      }`}>
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-900">EQUITY (Assets - Liabilities)</span>
          <span className={`text-3xl font-bold ${equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R {equity.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Balance Sheet Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Balance Sheet Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  ASSETS
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                  R {totalAssets.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 pl-12">
                  Current Assets
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  R {totalAssets.toLocaleString()}
                </td>
              </tr>
              <tr className="bg-orange-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  LIABILITIES
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                  R {totalLiabilities.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 pl-12">
                  Accounts Payable
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  R {accountsPayable.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 pl-12">
                  Loans
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  R {loans.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 pl-12">
                  Credit Lines
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  R {creditLines.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 pl-12">
                  Other Liabilities
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  R {otherLiabilities.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 pl-12">
                  Pending Payments
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  R {pendingPayments.toLocaleString()}
                </td>
              </tr>
              <tr className={equity >= 0 ? 'bg-green-50' : 'bg-red-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  EQUITY
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${
                  equity >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  R {equity.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
