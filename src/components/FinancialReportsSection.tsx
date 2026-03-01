import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { FileText, Download, Loader2, TrendingUp, Calendar, AlertCircle, Filter, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";

export function FinancialReportsSection() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [reportType, setReportType] = useState<string>("MONTHLY_PL");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [generatingReportId, setGeneratingReportId] = useState<number | null>(null);
  
  // Filter states
  const [projectType, setProjectType] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");
  const [artisanId, setArtisanId] = useState<string>("");
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const reportsQuery = useQuery(
    trpc.getFinancialReports.queryOptions({
      token: token!,
    })
  );

  const projectTypesQuery = useQuery(
    trpc.getProjectTypes.queryOptions({
      token: token!,
    })
  );

  const customersQuery = useQuery(
    trpc.getCustomers.queryOptions({
      token: token!,
    })
  );

  const artisansQuery = useQuery(
    trpc.getArtisans.queryOptions({
      token: token!,
    })
  );

  const reportStatusQuery = useQuery({
    ...trpc.getFinancialReportById.queryOptions({
      token: token!,
      reportId: generatingReportId!,
    }),
    enabled: generatingReportId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "GENERATING") {
        return 2000; // Poll every 2 seconds while generating
      }
      return false; // Stop polling when complete or failed
    },
  });

  const generateReportMutation = useMutation(
    trpc.generateFinancialReport.mutationOptions({
      onSuccess: (data) => {
        toast.success("Report generation started!");
        setGeneratingReportId(data.reportId);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate report");
      },
    })
  );

  // Monitor report status and update when complete
  useEffect(() => {
    if (reportStatusQuery.data) {
      const status = reportStatusQuery.data.status;
      if (status === "COMPLETED") {
        toast.success("Report generated successfully!");
        setGeneratingReportId(null);
        reportsQuery.refetch();
      } else if (status === "FAILED") {
        toast.error(
          reportStatusQuery.data.errorMessage || "Report generation failed"
        );
        setGeneratingReportId(null);
      }
    }
  }, [reportStatusQuery.data, reportsQuery]);

  const handleGenerateReport = () => {
    const input: any = {
      token: token!,
      reportType: reportType as any,
      year,
    };

    if (useCustomDates && customStartDate && customEndDate) {
      input.customStartDate = customStartDate;
      input.customEndDate = customEndDate;
    } else {
      if (reportType.includes("MONTHLY")) {
        input.month = month;
      } else if (reportType.includes("QUARTERLY")) {
        input.quarter = quarter;
      }
    }

    // Add filters if selected
    if (projectType) input.projectType = projectType;
    if (clientEmail) input.clientEmail = clientEmail;
    if (artisanId) input.artisanId = parseInt(artisanId);

    generateReportMutation.mutate(input);
  };

  const reports = reportsQuery.data || [];
  const projectTypes = projectTypesQuery.data || [];
  const customers = customersQuery.data || [];
  const artisans = artisansQuery.data || [];
  const isGenerating = generatingReportId !== null;

  const reportTypeOptions = [
    { value: "MONTHLY_PL", label: "Monthly P&L Statement" },
    { value: "QUARTERLY_PL", label: "Quarterly P&L Statement" },
    { value: "ANNUAL_PL", label: "Annual P&L Statement" },
    { value: "MONTHLY_BALANCE_SHEET", label: "Monthly Balance Sheet" },
    { value: "QUARTERLY_BALANCE_SHEET", label: "Quarterly Balance Sheet" },
    { value: "ANNUAL_BALANCE_SHEET", label: "Annual Balance Sheet" },
    { value: "MONTHLY_CFS", label: "Monthly Cash Flow Statement" },
    { value: "QUARTERLY_CFS", label: "Quarterly Cash Flow Statement" },
    { value: "ANNUAL_CFS", label: "Annual Cash Flow Statement" },
    { value: "MONTHLY_BUSINESS_INSIGHTS", label: "Monthly Business Insights Report" },
  ];

  return (
    <div className="space-y-6">
      {/* Report Generation Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-5 w-5 text-teal-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Generate Financial Report
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
            >
              {reportTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              disabled={isGenerating}
              min={2020}
              max={2100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
            />
          </div>

          {!useCustomDates && reportType.includes("MONTHLY") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString("default", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!useCustomDates && reportType.includes("QUARTERLY") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quarter
              </label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(parseInt(e.target.value))}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              >
                <option value={1}>Q1 (Jan-Mar)</option>
                <option value={2}>Q2 (Apr-Jun)</option>
                <option value={3}>Q3 (Jul-Sep)</option>
                <option value={4}>Q4 (Oct-Dec)</option>
              </select>
            </div>
          )}
        </div>

        {/* Custom Date Range Toggle */}
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={useCustomDates}
              onChange={(e) => setUseCustomDates(e.target.checked)}
              disabled={isGenerating}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="ml-2 text-sm text-gray-700">Use custom date range</span>
          </label>
        </div>

        {useCustomDates && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              />
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800 transition-colors"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? 'Hide Filters' : 'Show Advanced Filters'}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Type
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100 bg-white"
              >
                <option value="">All Project Types</option>
                {projectTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client
              </label>
              <select
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100 bg-white"
              >
                <option value="">All Clients</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.email}>
                    {customer.firstName} {customer.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Artisan
              </label>
              <select
                value={artisanId}
                onChange={(e) => setArtisanId(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100 bg-white"
              >
                <option value="">All Artisans</option>
                {artisans.map((artisan) => (
                  <option key={artisan.id} value={artisan.id.toString()}>
                    {artisan.firstName} {artisan.lastName}
                  </option>
                ))}
              </select>
            </div>

            {(projectType || clientEmail || artisanId) && (
              <div className="md:col-span-3">
                <button
                  type="button"
                  onClick={() => {
                    setProjectType("");
                    setClientEmail("");
                    setArtisanId("");
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleGenerateReport}
          disabled={isGenerating || generateReportMutation.isPending}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <FileText className="h-5 w-5 mr-2" />
              Generate Report
            </>
          )}
        </button>

        {isGenerating && reportStatusQuery.data && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <Loader2 className="h-5 w-5 text-blue-600 mr-3 animate-spin flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Generating your financial report...
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  This may take a minute. We're analyzing your financial data and
                  generating AI insights.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generated Reports List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Calendar className="h-5 w-5 text-teal-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Generated Reports
          </h2>
        </div>

        {reportsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              No reports generated yet
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Generate your first financial report above
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {reportTypeOptions.find(
                          (opt) => opt.value === report.reportType
                        )?.label || report.reportType}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          report.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : report.status === "GENERATING"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mb-2">
                      <div>
                        <span className="font-medium">Period:</span>{" "}
                        {report.reportPeriod}
                      </div>
                      <div>
                        <span className="font-medium">Revenue:</span> R
                        {report.totalRevenue.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Expenses:</span> R
                        {report.totalExpenses.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Profit:</span> R
                        {report.netProfit.toLocaleString()}
                      </div>
                    </div>
                    {report.aiInsights && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {report.aiInsights.substring(0, 150)}...
                      </p>
                    )}
                    {report.status === "FAILED" && report.errorMessage && (
                      <div className="flex items-start mt-2 text-xs text-red-600">
                        <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{report.errorMessage}</span>
                      </div>
                    )}
                  </div>
                  {report.status === "COMPLETED" && (report.pdfUrl || report.csvUrl) && (
                    <div className="ml-4 flex items-center gap-2">
                      {report.pdfUrl && (
                        <button
                          onClick={async () => {
                            try {
                              const result = await trpc.getPresignedDownloadUrl.query({
                                token: token!,
                                url: report.pdfUrl!,
                                expiresInSeconds: 600,
                              });
                              window.open(result.url, '_blank');
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to generate download link');
                            }
                          }}
                          className="flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                          title="Download PDF"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          PDF
                        </button>
                      )}
                      {report.csvUrl && (
                        <button
                          onClick={async () => {
                            try {
                              const result = await trpc.getPresignedDownloadUrl.query({
                                token: token!,
                                url: report.csvUrl!,
                                expiresInSeconds: 600,
                              });
                              window.open(result.url, '_blank');
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to generate download link');
                            }
                          }}
                          className="flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors cursor-pointer"
                          title="Download Excel/CSV"
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-1" />
                          Excel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
