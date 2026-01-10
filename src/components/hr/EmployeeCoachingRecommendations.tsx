import { useState } from "react";
import { 
  Lightbulb, 
  Target, 
  TrendingUp, 
  BookOpen, 
  Calendar,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Clock,
  Award,
} from "lucide-react";
import Markdown from "markdown-to-jsx";

interface CoachingData {
  overallAssessment: string;
  strengths: string[];
  areasForImprovement: Array<{
    area: string;
    currentPerformance: string;
    targetPerformance: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }>;
  actionableRecommendations: Array<{
    recommendation: string;
    expectedImpact: string;
    timeframe: string;
  }>;
  trainingNeeds: string[];
  shortTermGoals: string[];
  longTermGoals: string[];
  coachingStyle: string;
}

interface PerformanceMetrics {
  totalLeads: number;
  conversionRate: number;
  avgDealValue: number;
  avgResponseTimeHours: number;
  completedOrders: number;
  avgRating: number;
}

interface EmployeeCoachingRecommendationsProps {
  coaching: CoachingData;
  metrics: PerformanceMetrics;
  employeeName: string;
  generatedAt: string;
  isLoading?: boolean;
}

const getPriorityColor = (priority: "HIGH" | "MEDIUM" | "LOW") => {
  const colors = {
    HIGH: "bg-red-100 text-red-800 border-red-200",
    MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
    LOW: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return colors[priority];
};

const getPriorityIcon = (priority: "HIGH" | "MEDIUM" | "LOW") => {
  if (priority === "HIGH") return AlertCircle;
  if (priority === "MEDIUM") return Clock;
  return CheckCircle;
};

export function EmployeeCoachingRecommendations({
  coaching,
  metrics,
  employeeName,
  generatedAt,
  isLoading,
}: EmployeeCoachingRecommendationsProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set([0]));

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              <div className="h-3 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const toggleArea = (index: number) => {
    const newExpanded = new Set(expandedAreas);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedAreas(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <Sparkles className="h-6 w-6 text-purple-600 mr-2" />
              <h2 className="text-2xl font-bold text-gray-900">AI-Powered Coaching Insights</h2>
            </div>
            <p className="text-sm text-gray-600">
              Personalized recommendations for {employeeName}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Generated on {new Date(generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="bg-purple-100 rounded-full p-3">
            <Lightbulb className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Overall Assessment */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Target className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Overall Assessment</h3>
        </div>
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed">{coaching.overallAssessment}</p>
        </div>
      </div>

      {/* Strengths */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Award className="h-5 w-5 text-green-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Key Strengths</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {coaching.strengths.map((strength, index) => (
            <div
              key={index}
              className="flex items-start p-3 bg-green-50 border border-green-200 rounded-lg"
            >
              <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">{strength}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Areas for Improvement */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-5 w-5 text-orange-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Areas for Improvement</h3>
        </div>
        <div className="space-y-3">
          {coaching.areasForImprovement.map((area, index) => {
            const PriorityIcon = getPriorityIcon(area.priority);
            const isExpanded = expandedAreas.has(index);
            
            return (
              <div
                key={index}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-purple-300 transition-colors"
              >
                <button
                  onClick={() => toggleArea(index)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(
                            area.priority
                          )}`}
                        >
                          <PriorityIcon className="h-3 w-3 mr-1" />
                          {area.priority}
                        </span>
                        <h4 className="font-semibold text-gray-900">{area.area}</h4>
                      </div>
                    </div>
                    <svg
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        isExpanded ? "transform rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                          Current Performance
                        </div>
                        <p className="text-sm text-gray-700">{area.currentPerformance}</p>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                          Target Performance
                        </div>
                        <p className="text-sm text-gray-700">{area.targetPerformance}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actionable Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Lightbulb className="h-5 w-5 text-purple-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Actionable Recommendations</h3>
        </div>
        <div className="space-y-4">
          {coaching.actionableRecommendations.map((rec, index) => (
            <div
              key={index}
              className="p-4 bg-purple-50 border border-purple-200 rounded-lg"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white text-xs font-bold mr-2">
                      {index + 1}
                    </div>
                    <h4 className="font-semibold text-gray-900">{rec.recommendation}</h4>
                  </div>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-purple-300 text-purple-700 ml-2">
                  <Clock className="h-3 w-3 mr-1" />
                  {rec.timeframe}
                </span>
              </div>
              <p className="text-sm text-gray-700 ml-8">
                <span className="font-medium">Expected Impact:</span> {rec.expectedImpact}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Training Needs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <BookOpen className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Training & Development Needs</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {coaching.trainingNeeds.map((need, index) => (
            <div
              key={index}
              className="flex items-start p-3 bg-blue-50 border border-blue-200 rounded-lg"
            >
              <BookOpen className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">{need}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Short-term Goals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Calendar className="h-5 w-5 text-orange-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Short-term Goals (1-3 months)</h3>
          </div>
          <ul className="space-y-2">
            {coaching.shortTermGoals.map((goal, index) => (
              <li key={index} className="flex items-start">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold mr-2 flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <p className="text-sm text-gray-700">{goal}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Long-term Goals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Target className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Long-term Goals (6-12 months)</h3>
          </div>
          <ul className="space-y-2">
            {coaching.longTermGoals.map((goal, index) => (
              <li key={index} className="flex items-start">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold mr-2 flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <p className="text-sm text-gray-700">{goal}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Coaching Style */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
        <div className="flex items-center mb-3">
          <Sparkles className="h-5 w-5 text-indigo-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Recommended Coaching Approach</h3>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{coaching.coachingStyle}</p>
      </div>

      {/* Performance Context */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Performance Context</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Total Leads</div>
            <div className="text-lg font-bold text-gray-900">{metrics.totalLeads}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Conversion Rate</div>
            <div className="text-lg font-bold text-gray-900">{metrics.conversionRate}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Avg Deal Value</div>
            <div className="text-lg font-bold text-gray-900">R{metrics.avgDealValue.toLocaleString()}</div>
          </div>
          {metrics.avgResponseTimeHours > 0 && (
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Avg Response</div>
              <div className="text-lg font-bold text-gray-900">{metrics.avgResponseTimeHours.toFixed(1)}h</div>
            </div>
          )}
          {metrics.completedOrders > 0 && (
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Orders Done</div>
              <div className="text-lg font-bold text-gray-900">{metrics.completedOrders}</div>
            </div>
          )}
          {metrics.avgRating > 0 && (
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Avg Rating</div>
              <div className="text-lg font-bold text-gray-900">{metrics.avgRating.toFixed(1)}/5</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
