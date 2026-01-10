import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  User,
  TrendingUp,
  FileText,
  Sparkles,
  RefreshCw,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Download,
  AlertCircle,
  Award,
  Star,
  CheckCircle,
  Target,
  DollarSign,
  Edit,
  X,
  Loader2,
} from "lucide-react";
import { EmployeePerformanceTrends } from "~/components/hr/EmployeePerformanceTrends";
import { EmployeeLeadHistoryTable } from "~/components/hr/EmployeeLeadHistoryTable";
import { EmployeeCoachingRecommendations } from "~/components/hr/EmployeeCoachingRecommendations";
import { exportEmployeePerformance } from "~/components/hr/EmployeePerformanceExport";

export const Route = createFileRoute("/admin/hr/employees/$employeeId/")({
  component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
  const { employeeId } = Route.useParams();
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"performance" | "leads" | "coaching" | "reviews" | "payslips">("performance");
  const [timeRange, setTimeRange] = useState(6); // months
  const [coachingKey, setCoachingKey] = useState(0);
  const [editingPayslip, setEditingPayslip] = useState<any | null>(null);

  const employeeIdNum = parseInt(employeeId, 10);

  // Fetch employee performance history
  const performanceQuery = useQuery(
    trpc.getEmployeePerformanceHistory.queryOptions({
      token: token!,
      employeeId: employeeIdNum,
      months: timeRange,
    })
  );

  // Fetch employee leads
  const leadsQuery = useQuery(
    trpc.getLeadsForEmployee.queryOptions({
      token: token!,
      employeeId: employeeIdNum,
    })
  );

  // Fetch employee performance reviews
  const reviewsQuery = useQuery(
    trpc.getPerformanceReviews.queryOptions({
      token: token!,
      employeeId: employeeIdNum,
    })
  );

  // Fetch employee payslips
  const payslipsQuery = useQuery(
    trpc.getPayslips.queryOptions({
      token: token!,
      employeeId: employeeIdNum,
    })
  );

  // Generate coaching recommendations mutation
  const generateCoachingMutation = useMutation(
    trpc.generateCoachingRecommendation.mutationOptions({
      onSuccess: () => {
        toast.success("Coaching recommendations generated successfully!");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate coaching recommendations");
      },
    })
  );

  const updatePayslipMutation = useMutation(
    trpc.updatePayslip.mutationOptions({
      onSuccess: () => {
        toast.success("Payslip updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getPayslips.queryKey() });
        setEditingPayslip(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update payslip");
      },
    })
  );

  const generatePayslipPdfMutation = useMutation(
    trpc.generatePayslipPdf.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Failed to generate payslip PDF");
      },
    })
  );

  // Use React Query to cache coaching recommendations
  const coachingQuery = useQuery({
    queryKey: ['coaching', employeeIdNum, coachingKey],
    queryFn: async () => {
      const result = await generateCoachingMutation.mutateAsync({
        token: token!,
        employeeId: employeeIdNum,
      });
      return result;
    },
    enabled: false, // Don't auto-fetch, only when explicitly triggered
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

  const handleGenerateCoaching = async () => {
    coachingQuery.refetch();
  };

  const handleRegenerateCoaching = async () => {
    setCoachingKey(prev => prev + 1);
  };

  const handleExportCoaching = () => {
    if (!coachingQuery.data) return;
    
    const coachingData = coachingQuery.data;
    const content = `
AI-POWERED COACHING INSIGHTS
Employee: ${coachingData.employeeName}
Generated: ${new Date(coachingData.generatedAt).toLocaleString()}

OVERALL ASSESSMENT
${coachingData.coaching.overallAssessment}

KEY STRENGTHS
${coachingData.coaching.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}

AREAS FOR IMPROVEMENT
${coachingData.coaching.areasForImprovement.map((a, i) => `
${i + 1}. ${a.area} [${a.priority}]
   Current: ${a.currentPerformance}
   Target: ${a.targetPerformance}
`).join('\n')}

ACTIONABLE RECOMMENDATIONS
${coachingData.coaching.actionableRecommendations.map((r, i) => `
${i + 1}. ${r.recommendation}
   Impact: ${r.expectedImpact}
   Timeframe: ${r.timeframe}
`).join('\n')}

TRAINING NEEDS
${coachingData.coaching.trainingNeeds.map((t, i) => `${i + 1}. ${t}`).join('\n')}

SHORT-TERM GOALS (1-3 months)
${coachingData.coaching.shortTermGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

LONG-TERM GOALS (6-12 months)
${coachingData.coaching.longTermGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

RECOMMENDED COACHING APPROACH
${coachingData.coaching.coachingStyle}

PERFORMANCE METRICS
- Total Leads: ${coachingData.metrics.totalLeads}
- Conversion Rate: ${coachingData.metrics.conversionRate}%
- Avg Deal Value: R${coachingData.metrics.avgDealValue.toLocaleString()}
- Avg Response Time: ${coachingData.metrics.avgResponseTimeHours}h
- Completed Orders: ${coachingData.metrics.completedOrders}
- Avg Rating: ${coachingData.metrics.avgRating}/5
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coaching-insights-${employee.firstName}-${employee.lastName}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Coaching insights exported successfully!');
  };

  const handleExportPerformance = () => {
    if (!performanceQuery.data || !employee) return;
    
    exportEmployeePerformance({
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeRole: employee.role,
      employeeEmail: employee.email,
      summary: performanceQuery.data.summary,
      monthlyMetrics: performanceQuery.data.monthlyMetrics,
      monthlyOrders: performanceQuery.data.monthlyOrders,
      monthlyReviews: performanceQuery.data.monthlyReviews,
      kpis: performanceQuery.data.kpis,
    });
    
    toast.success('Performance data exported successfully!');
  };

  const handleDownloadPayslip = async (payslipId: number, payslipNumber: string) => {
    try {
      toast.loading("Generating payslip PDF...");
      
      const pdfData = await generatePayslipPdfMutation.mutateAsync({
        token: token!,
        payslipId,
      });

      const byteCharacters = atob(pdfData.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payslip-${payslipNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Payslip downloaded!");
    } catch (error) {
      console.error("Error downloading payslip:", error);
      toast.dismiss();
    }
  };

  const handleUpdatePayslip = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPayslip) return;

    const formData = new FormData(e.currentTarget);
    const data: any = {
      token: token!,
      payslipId: editingPayslip.id,
    };

    for (const [key, value] of formData.entries()) {
      if (value) {
        data[key] = typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value;
      }
    }
    
    updatePayslipMutation.mutate(data);
  };

  const isLoading = performanceQuery.isLoading || leadsQuery.isLoading || reviewsQuery.isLoading;
  const employee = performanceQuery.data?.employee;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Employee Not Found</h2>
          <p className="text-gray-600 mb-4">The employee you're looking for doesn't exist.</p>
          <Link
            to="/admin/hr"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to HR
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "performance" as const, label: "Performance Trends", icon: TrendingUp },
    { id: "reviews" as const, label: "Performance Reviews", icon: Award },
    { id: "leads" as const, label: "Lead History", icon: FileText },
    { id: "coaching" as const, label: "Coaching Insights", icon: Sparkles },
    { id: "payslips" as const, label: "Payslips", icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/admin/hr"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-lg">
                {employee.firstName[0]}
                {employee.lastName[0]}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {employee.firstName} {employee.lastName}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <div className="flex items-center">
                    <Briefcase className="h-4 w-4 mr-1" />
                    {employee.role}
                  </div>
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-1" />
                    {employee.email}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Joined {new Date(employee.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Time Range Selector */}
            {activeTab === "performance" && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    queryClient.invalidateQueries({
                      queryKey: trpc.getEmployeePerformanceHistory.queryKey(),
                    });
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={3}>Last 3 months</option>
                  <option value={6}>Last 6 months</option>
                  <option value={12}>Last 12 months</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${
                      isActive
                        ? "border-purple-600 text-purple-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "performance" && performanceQuery.data && (
          <EmployeePerformanceTrends
            monthlyMetrics={performanceQuery.data.monthlyMetrics}
            monthlyOrders={performanceQuery.data.monthlyOrders}
            monthlyReviews={performanceQuery.data.monthlyReviews}
            summary={performanceQuery.data.summary}
            employeeRole={employee.role}
            kpis={performanceQuery.data.kpis}
            isLoading={performanceQuery.isLoading}
            onExport={handleExportPerformance}
          />
        )}

        {activeTab === "reviews" && reviewsQuery.data && (
          <div className="space-y-4">
            {reviewsQuery.data.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Award className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Performance Reviews Yet
                </h3>
                <p className="text-gray-600 mb-4">
                  This employee hasn't received any formal performance reviews yet.
                </p>
              </div>
            ) : (
              reviewsQuery.data.map((review) => (
                <div key={review.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Performance Review
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          review.status === "COMPLETED" ? "bg-green-100 text-green-800" :
                          review.status === "PENDING_EMPLOYEE_ACKNOWLEDGMENT" ? "bg-yellow-100 text-yellow-800" :
                          review.status === "ARCHIVED" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {review.status === "COMPLETED" ? "Completed" :
                           review.status === "PENDING_EMPLOYEE_ACKNOWLEDGMENT" ? "Pending Acknowledgment" :
                           review.status === "ARCHIVED" ? "Archived" : "Draft"}
                        </span>
                        {review.overallRating && (
                          <div className="flex items-center text-yellow-500">
                            <Star className="h-4 w-4 fill-current mr-1" />
                            <span className="text-sm font-semibold text-gray-900">
                              {review.overallRating.toFixed(1)} / 5.0
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>
                          Reviewed by {review.reviewer.firstName} {review.reviewer.lastName}
                        </span>
                        <span>
                          Period: {new Date(review.reviewPeriodStart).toLocaleDateString()} - {new Date(review.reviewPeriodEnd).toLocaleDateString()}
                        </span>
                        <span>
                          Date: {new Date(review.reviewDate).toLocaleDateString()}
                        </span>
                        {review.employeeAcknowledgedAt && (
                          <span className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Acknowledged
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Category Ratings */}
                  {(review.qualityOfWork || review.productivity || review.communication || 
                    review.teamwork || review.initiative || review.problemSolving ||
                    review.reliability || review.customerService || review.technicalSkills || review.leadership) && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Performance Ratings</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {review.qualityOfWork && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Quality</div>
                            <div className="text-lg font-bold text-gray-900">{review.qualityOfWork}/5</div>
                          </div>
                        )}
                        {review.productivity && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Productivity</div>
                            <div className="text-lg font-bold text-gray-900">{review.productivity}/5</div>
                          </div>
                        )}
                        {review.communication && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Communication</div>
                            <div className="text-lg font-bold text-gray-900">{review.communication}/5</div>
                          </div>
                        )}
                        {review.teamwork && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Teamwork</div>
                            <div className="text-lg font-bold text-gray-900">{review.teamwork}/5</div>
                          </div>
                        )}
                        {review.initiative && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Initiative</div>
                            <div className="text-lg font-bold text-gray-900">{review.initiative}/5</div>
                          </div>
                        )}
                        {review.problemSolving && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Problem Solving</div>
                            <div className="text-lg font-bold text-gray-900">{review.problemSolving}/5</div>
                          </div>
                        )}
                        {review.reliability && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Reliability</div>
                            <div className="text-lg font-bold text-gray-900">{review.reliability}/5</div>
                          </div>
                        )}
                        {review.customerService && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Customer Service</div>
                            <div className="text-lg font-bold text-gray-900">{review.customerService}/5</div>
                          </div>
                        )}
                        {review.technicalSkills && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Technical Skills</div>
                            <div className="text-lg font-bold text-gray-900">{review.technicalSkills}/5</div>
                          </div>
                        )}
                        {review.leadership && (
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Leadership</div>
                            <div className="text-lg font-bold text-gray-900">{review.leadership}/5</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Review Details */}
                  <div className="space-y-4">
                    {review.keyAchievements && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1 flex items-center">
                          <Award className="h-4 w-4 mr-1 text-green-600" />
                          Key Achievements
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.keyAchievements}</p>
                      </div>
                    )}
                    
                    {review.strengths && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-1 text-blue-600" />
                          Strengths
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.strengths}</p>
                      </div>
                    )}
                    
                    {review.areasForImprovement && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1 flex items-center">
                          <Target className="h-4 w-4 mr-1 text-orange-600" />
                          Areas for Improvement
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.areasForImprovement}</p>
                      </div>
                    )}
                    
                    {review.improvementActions && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Improvement Actions</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.improvementActions}</p>
                      </div>
                    )}
                    
                    {review.goalsForNextPeriod && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1 flex items-center">
                          <Target className="h-4 w-4 mr-1 text-purple-600" />
                          Goals for Next Period
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.goalsForNextPeriod}</p>
                      </div>
                    )}
                    
                    {review.trainingNeeds && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Training Needs</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.trainingNeeds}</p>
                      </div>
                    )}
                    
                    {review.careerDevelopment && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Career Development</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.careerDevelopment}</p>
                      </div>
                    )}
                    
                    {review.reviewerComments && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Reviewer Comments</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.reviewerComments}</p>
                      </div>
                    )}
                    
                    {review.employeeComments && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Employee Comments</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.employeeComments}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "leads" && leadsQuery.data && (
          <EmployeeLeadHistoryTable
            leads={leadsQuery.data}
            isLoading={leadsQuery.isLoading}
          />
        )}

        {activeTab === "coaching" && (
          <div className="space-y-6">
            {!coachingQuery.data && !coachingQuery.isFetching && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Sparkles className="mx-auto h-16 w-16 text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Generate AI-Powered Coaching Insights
                </h3>
                <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                  Get personalized coaching recommendations based on {employee.firstName}'s performance
                  data, including strengths, areas for improvement, actionable steps, and development
                  goals.
                </p>
                <button
                  onClick={handleGenerateCoaching}
                  disabled={coachingQuery.isFetching}
                  className="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Coaching Recommendations
                </button>
              </div>
            )}

            {coachingQuery.isFetching && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <RefreshCw className="mx-auto h-16 w-16 text-purple-600 mb-4 animate-spin" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Analyzing Performance Data...
                </h3>
                <p className="text-gray-600">
                  Our AI is generating personalized coaching recommendations. This may take a moment.
                </p>
              </div>
            )}

            {coachingQuery.isError && (
              <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-red-600 mb-4" />
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Failed to Generate Coaching Insights
                </h3>
                <p className="text-red-700 mb-4">
                  {coachingQuery.error instanceof Error ? coachingQuery.error.message : 'An error occurred'}
                </p>
                <button
                  onClick={handleGenerateCoaching}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </button>
              </div>
            )}

            {coachingQuery.data && !coachingQuery.isFetching && (
              <>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={handleExportCoaching}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export as Text
                  </button>
                  <button
                    onClick={handleRegenerateCoaching}
                    disabled={coachingQuery.isFetching}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Recommendations
                  </button>
                </div>
                <EmployeeCoachingRecommendations
                  coaching={coachingQuery.data.coaching}
                  metrics={coachingQuery.data.metrics}
                  employeeName={coachingQuery.data.employeeName}
                  generatedAt={coachingQuery.data.generatedAt}
                  isLoading={false}
                />
              </>
            )}
          </div>
        )}

        {activeTab === "payslips" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Payslips</h2>
            </div>
            
            {payslipsQuery.isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="mx-auto h-12 w-12 text-gray-400 animate-spin mb-4" />
                <p className="text-sm text-gray-600">Loading payslips...</p>
              </div>
            ) : payslipsQuery.data?.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm text-gray-600">No payslips found for this employee</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payslip #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Net Pay
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payslipsQuery.data?.map((payslip) => (
                      <tr key={payslip.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payslip.payslipNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(payslip.paymentDate).toLocaleDateString("en-ZA")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                          R{payslip.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => setEditingPayslip(payslip)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDownloadPayslip(payslip.id, payslip.payslipNumber)}
                            disabled={generatePayslipPdfMutation.isPending}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Payslip Modal */}
      {editingPayslip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
            <form onSubmit={handleUpdatePayslip}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Edit Payslip - {editingPayslip.payslipNumber}</h2>
                  <button
                    type="button"
                    onClick={() => setEditingPayslip(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Earnings */}
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900">Earnings</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Basic Salary</label>
                      <input type="number" name="basicSalary" defaultValue={editingPayslip.basicSalary} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Overtime</label>
                      <input type="number" name="overtime" defaultValue={editingPayslip.overtime} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bonus</label>
                      <input type="number" name="bonus" defaultValue={editingPayslip.bonus} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Allowances</label>
                      <input type="number" name="allowances" defaultValue={editingPayslip.allowances} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Commission</label>
                      <input type="number" name="commission" defaultValue={editingPayslip.commission} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Other Earnings</label>
                      <input type="number" name="otherEarnings" defaultValue={editingPayslip.otherEarnings} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900">Deductions</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Income Tax (PAYE)</label>
                      <input type="number" name="incomeTax" defaultValue={editingPayslip.incomeTax} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">UIF</label>
                      <input type="number" name="uif" defaultValue={editingPayslip.uif} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Pension Fund</label>
                      <input type="number" name="pensionFund" defaultValue={editingPayslip.pensionFund} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Medical Aid</label>
                      <input type="number" name="medicalAid" defaultValue={editingPayslip.medicalAid} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Other Deductions</label>
                      <input type="number" name="otherDeductions" defaultValue={editingPayslip.otherDeductions} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
                  <textarea name="notes" defaultValue={editingPayslip.notes || ""} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                </div>
              </div>

              <div className="bg-gray-100 px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingPayslip(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePayslipMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
                >
                  {updatePayslipMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
