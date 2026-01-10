import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  ArrowLeft,
  FileText,
  Download,
  Share2,
  AlertCircle,
  Brain,
  Sparkles,
  Target,
  TrendingUp as TrendingUpIcon,
  AlertCircle as AlertCircleIcon,
  Lightbulb,
  X,
} from "lucide-react";
import { ComprehensiveProjectReport } from "~/components/projects/ComprehensiveProjectReport";
import toast from "react-hot-toast";
import { useState } from "react";

export const Route = createFileRoute("/admin/projects/$projectId/report")({
  component: ProjectReportPage,
});

function ProjectReportPage() {
  const { projectId } = useParams({ from: "/admin/projects/$projectId/report" });
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryResults, setSummaryResults] = useState<any>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Fetch the comprehensive project report
  const reportQuery = useQuery(
    trpc.getComprehensiveProjectReport.queryOptions({
      token: token!,
      projectId: parseInt(projectId),
    })
  );

  const reportData = reportQuery.data;
  const isLoading = reportQuery.isLoading;
  const error = reportQuery.error;

  const generateProjectReportMutation = useMutation(
    trpc.generateProjectReportPdf.mutationOptions({
      onSuccess: (data) => {
        // Decode base64 PDF and trigger download
        const binaryString = atob(data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const filename = reportData 
          ? `${reportData.project.projectNumber}_${reportData.project.name.replace(/\s+/g, "_")}_Comprehensive_Report.pdf`
          : `Project_Report_${new Date().getTime()}.pdf`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PDF report");
      },
    })
  );

  const generateSummaryMutation = useMutation(
    trpc.generateProjectSummary.mutationOptions({
      onSuccess: (data) => {
        setSummaryResults(data);
        setGeneratingSummary(false);
        toast.success("Project summary generated successfully!");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate project summary");
        setGeneratingSummary(false);
      },
    })
  );

  const handleExportPDF = () => {
    if (!reportData) return;
    
    const generatePromise = generateProjectReportMutation.mutateAsync({
      token: token!,
      projectId: parseInt(projectId),
    });

    toast.promise(
      generatePromise,
      {
        loading: "Generating PDF report...",
        success: "PDF report downloaded successfully!",
        error: "Failed to generate PDF report",
      }
    );
  };

  const handleGenerateSummary = (summaryType: "EXECUTIVE" | "DETAILED" | "STATUS_UPDATE") => {
    setGeneratingSummary(true);
    
    const summaryPromise = generateSummaryMutation.mutateAsync({
      token: token!,
      projectId: parseInt(projectId),
      summaryType,
    });

    toast.promise(
      summaryPromise,
      {
        loading: `Generating ${summaryType.toLowerCase().replace("_", " ")} summary with AI...`,
        success: "Summary generated!",
        error: "Failed to generate summary",
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/admin/projects"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-xl shadow-md">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Comprehensive Project Report
                </h1>
                <p className="text-sm text-gray-600">
                  {reportData ? reportData.project.name : "Loading..."}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowSummaryModal(true)}
                disabled={isLoading || !!error}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <Brain className="h-4 w-4 mr-2" />
                Generate AI Summary
              </button>
              <button
                disabled={isLoading || !!error}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (reportData) {
                    // Future: Implement share functionality
                    alert("Share functionality coming soon!");
                  }
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </button>
              <button
                disabled={isLoading || !!error}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleExportPDF}
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-1">
                  Error Loading Report
                </h3>
                <p className="text-sm text-red-700">
                  {error.message || "An unexpected error occurred while loading the project report."}
                </p>
                <button
                  onClick={() => reportQuery.refetch()}
                  className="mt-3 inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Summary Section */}
        {summaryResults && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-xl shadow-md">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">AI-Generated Project Summary</h2>
                  <p className="text-sm text-gray-600">
                    Generated {new Date(summaryResults.generatedAt).toLocaleString()} by {summaryResults.generatedBy}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSummaryResults(null)}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Overall Status Badge */}
            <div className="flex items-center space-x-4 mb-6">
              <div className={`inline-flex items-center px-4 py-2 rounded-lg font-semibold ${
                summaryResults.summary.overallStatus === "ON_TRACK"
                  ? "bg-green-100 text-green-800"
                  : summaryResults.summary.overallStatus === "AHEAD_OF_SCHEDULE"
                  ? "bg-blue-100 text-blue-800"
                  : summaryResults.summary.overallStatus === "AT_RISK"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}>
                <Target className="h-5 w-5 mr-2" />
                {summaryResults.summary.overallStatus.replace("_", " ")}
              </div>
              <div className={`inline-flex items-center px-4 py-2 rounded-lg font-semibold ${
                summaryResults.summary.confidenceLevel === "HIGH"
                  ? "bg-green-100 text-green-800"
                  : summaryResults.summary.confidenceLevel === "MEDIUM"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}>
                Confidence: {summaryResults.summary.confidenceLevel}
              </div>
            </div>

            {/* Executive Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-purple-900 mb-2 flex items-center">
                <Sparkles className="h-4 w-4 mr-2" />
                Executive Summary
              </h3>
              <p className="text-gray-800">{summaryResults.summary.executiveSummary}</p>
            </div>

            {/* Key Highlights */}
            {summaryResults.summary.keyHighlights && summaryResults.summary.keyHighlights.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <TrendingUpIcon className="h-4 w-4 mr-2 text-green-600" />
                  Key Highlights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {summaryResults.summary.keyHighlights.map((highlight: string, idx: number) => (
                    <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-900">✓ {highlight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Progress Analysis</h3>
                <p className="text-sm text-gray-700">{summaryResults.summary.progressAnalysis}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Budget Analysis</h3>
                <p className="text-sm text-gray-700">{summaryResults.summary.budgetAnalysis}</p>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-red-900 mb-2 flex items-center">
                <AlertCircleIcon className="h-4 w-4 mr-2" />
                Risk Assessment
              </h3>
              <p className="text-sm text-red-800">{summaryResults.summary.riskAssessment}</p>
            </div>

            {/* Upcoming Milestones */}
            {summaryResults.summary.upcomingMilestones && summaryResults.summary.upcomingMilestones.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Upcoming Milestones</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {summaryResults.summary.upcomingMilestones.map((milestone: any, idx: number) => (
                    <div key={idx} className={`border-l-4 rounded-lg p-3 ${
                      milestone.priority === "HIGH"
                        ? "border-red-500 bg-red-50"
                        : milestone.priority === "MEDIUM"
                        ? "border-yellow-500 bg-yellow-50"
                        : "border-blue-500 bg-blue-50"
                    }`}>
                      <div className="text-sm font-semibold text-gray-900">{milestone.name}</div>
                      {milestone.dueDate && (
                        <div className="text-xs text-gray-600 mt-1">Due: {milestone.dueDate}</div>
                      )}
                      <div className={`text-xs font-medium mt-1 ${
                        milestone.priority === "HIGH"
                          ? "text-red-700"
                          : milestone.priority === "MEDIUM"
                          ? "text-yellow-700"
                          : "text-blue-700"
                      }`}>
                        {milestone.priority} Priority
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {summaryResults.summary.recommendations && summaryResults.summary.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Recommendations
                </h3>
                <ul className="space-y-2">
                  {summaryResults.summary.recommendations.map((recommendation: string, idx: number) => (
                    <li key={idx} className="text-sm text-blue-800 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!error && (
          <ComprehensiveProjectReport
            reportData={reportData}
            isLoading={isLoading}
          />
        )}

        {/* Summary Type Selection Modal */}
        {showSummaryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Generate AI Summary</h3>
                  <p className="text-sm text-gray-600 mt-1">Select the type of summary you need</p>
                </div>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  disabled={generatingSummary}
                  className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => {
                    handleGenerateSummary("EXECUTIVE");
                    setShowSummaryModal(false);
                  }}
                  disabled={generatingSummary}
                  className="flex items-start space-x-4 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all disabled:opacity-50 text-left"
                >
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Target className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Executive Summary</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      High-level overview with strategic insights. Perfect for senior management and stakeholders.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleGenerateSummary("DETAILED");
                    setShowSummaryModal(false);
                  }}
                  disabled={generatingSummary}
                  className="flex items-start space-x-4 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all disabled:opacity-50 text-left"
                >
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Detailed Summary</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Comprehensive analysis with technical details and granular progress tracking.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleGenerateSummary("STATUS_UPDATE");
                    setShowSummaryModal(false);
                  }}
                  disabled={generatingSummary}
                  className="flex items-start space-x-4 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all disabled:opacity-50 text-left"
                >
                  <div className="bg-green-100 p-3 rounded-lg">
                    <TrendingUpIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Status Update</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Recent progress, immediate next steps, and short-term outlook.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
