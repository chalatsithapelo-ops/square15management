import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { BarChart, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Bar } from "recharts/es6/cartesian/Bar";
import { Download, TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon } from "lucide-react";

export function PropertyFinancialReporting() {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [reportType, setReportType] = useState<"INCOME_STATEMENT" | "BALANCE_SHEET" | "CASH_FLOW">("INCOME_STATEMENT");
  const [periodStart, setPeriodStart] = useState<Date>(new Date(new Date().setMonth(new Date().getMonth() - 12)));
  const [periodEnd, setPeriodEnd] = useState<Date>(new Date());

  // Fetch buildings for selection
  const buildingsQuery = useQuery(
    trpc.getBuildings.queryOptions({
      token: token!,
    })
  );

  // Fetch financial report
  const reportQuery = useQuery(
    selectedBuilding
      ? trpc.getPropertyFinancialReport.queryOptions({
          token: token!,
          buildingId: selectedBuilding,
          reportType,
          periodStart,
          periodEnd,
        })
      : { enabled: false, queryKey: ["disabled"] }
  );

  const buildings = buildingsQuery.data?.buildings || [];
  const reportData = reportQuery.data;

  // Color palette for charts
  const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

  if (!selectedBuilding) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Property Financial Reports</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <PieChartIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Select a property to view financial reports</p>
          <div className="w-full max-w-sm mx-auto">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Property
            </label>
            <select
              value={selectedBuilding || ""}
              onChange={(e) => setSelectedBuilding(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a property...</option>
              {buildings.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name} - {b.address}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  const selectedBuildingData = buildings.find((b: any) => b.id === selectedBuilding);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {selectedBuildingData?.name}
          </h1>
          <p className="text-gray-600">{selectedBuildingData?.address}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedBuilding(null)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Change Property
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Report Controls */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex gap-4 flex-wrap">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="INCOME_STATEMENT">Income Statement</option>
              <option value="BALANCE_SHEET">Balance Sheet</option>
              <option value="CASH_FLOW">Cash Flow</option>
            </select>
          </div>

          {/* Period Start */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From
            </label>
            <input
              type="date"
              value={periodStart.toISOString().split("T")[0]}
              onChange={(e) => setPeriodStart(new Date(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Period End */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To
            </label>
            <input
              type="date"
              value={periodEnd.toISOString().split("T")[0]}
              onChange={(e) => setPeriodEnd(new Date(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Report Content */}
      {reportQuery.isLoading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Loading report...
        </div>
      ) : reportData?.reportType === "INCOME_STATEMENT" ? (
        <div className="space-y-6">
          {/* Income Statement Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-600 text-sm">Total Income</p>
              <p className="text-2xl font-bold text-gray-900">
                R {(reportData?.incomeStatements?.[0]?.revenue?.totalIncome || 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-600 text-sm">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900">
                R {(reportData?.incomeStatements?.[0]?.expenses?.totalExpenses || 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-600 text-sm">Operating Profit</p>
              <p className="text-2xl font-bold text-green-600">
                R {(reportData?.incomeStatements?.[0]?.profitAndLoss?.operatingProfit || 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-600 text-sm">Profit Margin</p>
              <p className="text-2xl font-bold text-gray-900">
                {(reportData?.incomeStatements?.[0]?.profitAndLoss?.profitMargin || 0).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Income Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Income vs Expenses Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={reportData?.incomeStatements || []}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => `R ${value.toLocaleString("en-ZA")}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue.totalIncome"
                  name="Total Income"
                  stroke="#10b981"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="expenses.totalExpenses"
                  name="Total Expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Period</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Rental Income</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Maintenance Fees</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Total Expenses</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Operating Profit</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.incomeStatements?.map((stmt: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900">{stmt.period}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-900">
                        R {stmt.revenue.rentalIncome.toLocaleString("en-ZA")}
                      </td>
                      <td className="px-6 py-3 text-sm text-right text-gray-900">
                        R {stmt.revenue.maintenanceFees.toLocaleString("en-ZA")}
                      </td>
                      <td className="px-6 py-3 text-sm text-right text-gray-900">
                        R {stmt.expenses.totalExpenses.toLocaleString("en-ZA")}
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-green-600">
                        R {stmt.profitAndLoss.operatingProfit.toLocaleString("en-ZA")}
                      </td>
                      <td className="px-6 py-3 text-sm text-right text-gray-900">
                        {stmt.profitAndLoss.profitMargin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : reportData?.reportType === "BALANCE_SHEET" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Assets */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assets</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Building Value</span>
                <span className="font-semibold">R {(reportData?.balanceSheets?.[0]?.assets?.buildingValue || 0).toLocaleString("en-ZA")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Improvements</span>
                <span className="font-semibold">R {(reportData?.balanceSheets?.[0]?.assets?.improvements || 0).toLocaleString("en-ZA")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Deposits</span>
                <span className="font-semibold">R {(reportData?.balanceSheets?.[0]?.assets?.deposits || 0).toLocaleString("en-ZA")}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total Assets</span>
                <span className="text-blue-600">R {(reportData?.balanceSheets?.[0]?.assets?.totalAssets || 0).toLocaleString("en-ZA")}</span>
              </div>
            </div>
          </div>

          {/* Liabilities */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Liabilities</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Mortgage</span>
                <span className="font-semibold">R {(reportData?.balanceSheets?.[0]?.liabilities?.mortgage || 0).toLocaleString("en-ZA")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Loans</span>
                <span className="font-semibold">R {(reportData?.balanceSheets?.[0]?.liabilities?.loans || 0).toLocaleString("en-ZA")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Accounts Payable</span>
                <span className="font-semibold">R {(reportData?.balanceSheets?.[0]?.liabilities?.accountsPayable || 0).toLocaleString("en-ZA")}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total Liabilities</span>
                <span className="text-red-600">R {(reportData?.balanceSheets?.[0]?.liabilities?.totalLiabilities || 0).toLocaleString("en-ZA")}</span>
              </div>
            </div>
          </div>

          {/* Equity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Equity & Ratios</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Equity</span>
                <span className="font-semibold text-green-600">R {(reportData?.balanceSheets?.[0]?.equity?.totalEquity || 0).toLocaleString("en-ZA")}</span>
              </div>
              <div className="border-t pt-2">
                <p className="text-gray-600 text-sm mb-3">Key Ratios</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Debt-to-Equity</span>
                    <span className="font-semibold">{(reportData?.balanceSheets?.[0]?.ratios?.debtToEquityRatio || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>ROA</span>
                    <span className="font-semibold">{(reportData?.balanceSheets?.[0]?.ratios?.returnOnAssets || 0).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={reportData?.cashFlowStatements || []}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `R ${value.toLocaleString("en-ZA")}`} />
              <Legend />
              <Bar dataKey="operatingCashFlow" fill="#10b981" name="Operating Activities" />
              <Bar dataKey="investingCashFlow" fill="#f59e0b" name="Investing Activities" />
              <Bar dataKey="netCashFlow" fill="#3b82f6" name="Net Cash Flow" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
