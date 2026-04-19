import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  CheckCircle2,
  Clock,
  Brain,
  Heart,
  User,
  BarChart3,
  MessageSquare,
  ArrowRight,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/apply/assessments/$token/")({
  component: AssessmentHubPage,
});

const ASSESSMENT_CONFIG = [
  {
    type: "IQ",
    title: "Cognitive Aptitude Test",
    description: "Pattern recognition, numerical reasoning, spatial awareness, and verbal logic",
    icon: Brain,
    color: "blue",
    duration: "~30 min",
  },
  {
    type: "EQ",
    title: "Emotional Intelligence",
    description: "Self-awareness, self-management, social awareness, and relationship skills",
    icon: Heart,
    color: "rose",
    duration: "~25 min",
  },
  {
    type: "MBTI",
    title: "Personality Type Indicator",
    description: "Discover your personality type across 4 dimensions",
    icon: User,
    color: "purple",
    duration: "~15 min",
  },
  {
    type: "BIG_FIVE",
    title: "Big Five (OCEAN) Assessment",
    description: "Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism",
    icon: BarChart3,
    color: "amber",
    duration: "~15 min",
  },
] as const;

function AssessmentHubPage() {
  const { token } = useParams({ from: "/apply/assessments/$token/" });
  const trpc = useTRPC();

  const appQuery = useQuery(
    trpc.getApplicationByToken.queryOptions({ token }, { enabled: !!token })
  );

  const app = appQuery.data;

  if (appQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (appQuery.isError || !app) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-xl p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-900">Invalid Link</h1>
          <p className="mt-2 text-sm text-gray-600">
            This assessment link is invalid or has expired. Please check your email for the correct link.
          </p>
        </div>
      </div>
    );
  }

  if (app.status === "ONBOARDED" || app.status === "REJECTED") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-xl p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-900">Application {app.status === "ONBOARDED" ? "Complete" : "Closed"}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {app.status === "ONBOARDED"
              ? "Congratulations! You have been onboarded. Check your email for login credentials."
              : "This application has been closed. Thank you for your interest."}
          </p>
        </div>
      </div>
    );
  }

  const allAssessmentsDone = app.pendingAssessments.length === 0;
  const allInterviewDone = app.completedInterviewQuestions.length >= app.totalInterviewQuestions;
  const totalProgress = app.completedAssessments.length + (allInterviewDone ? 1 : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
              <span className="text-teal-700 font-bold text-lg">
                {app.firstName[0]}{app.lastName[0]}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Welcome, {app.firstName}!
              </h1>
              <p className="text-sm text-gray-600">
                {app.primaryTrade} • Application Assessment Portal
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Overall Progress</span>
              <span>{totalProgress}/5 complete</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${(totalProgress / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Assessment Cards */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide px-1">
            Psychometric Assessments
          </h2>

          {ASSESSMENT_CONFIG.map((cfg) => {
            const isDone = app.completedAssessments.includes(cfg.type);
            const Icon = cfg.icon;
            const colorClasses: Record<string, { bg: string; icon: string; border: string }> = {
              blue: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-200" },
              rose: { bg: "bg-rose-50", icon: "text-rose-600", border: "border-rose-200" },
              purple: { bg: "bg-purple-50", icon: "text-purple-600", border: "border-purple-200" },
              amber: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-200" },
            };
            const colors = colorClasses[cfg.color];

            return (
              <div
                key={cfg.type}
                className={`bg-white border rounded-xl p-4 flex items-center gap-4 transition-all ${
                  isDone ? "border-green-200 bg-green-50/30" : "border-gray-200 hover:shadow-md"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDone ? "bg-green-100" : colors.bg}`}>
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Icon className={`w-5 h-5 ${colors.icon}`} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{cfg.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{cfg.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {cfg.duration}
                  </span>
                  {isDone ? (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                      Complete
                    </span>
                  ) : (
                    <Link
                      to="/apply/assessments/$token/$type"
                      params={{ token, type: cfg.type }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Start <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {/* AI Interview Card */}
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide px-1 mt-6">
            AI Behavioural Interview
          </h2>

          <div
            className={`bg-white border rounded-xl p-4 flex items-center gap-4 transition-all ${
              allInterviewDone
                ? "border-green-200 bg-green-50/30"
                : !allAssessmentsDone
                  ? "border-gray-100 opacity-60"
                  : "border-gray-200 hover:shadow-md"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              allInterviewDone ? "bg-green-100" : "bg-indigo-50"
            }`}>
              {allInterviewDone ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <MessageSquare className="w-5 h-5 text-indigo-600" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">AI Interview</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {allAssessmentsDone
                  ? `5 behavioural questions • ${app.completedInterviewQuestions.length}/5 answered`
                  : "Complete all assessments first to unlock the interview"}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> ~45 min
              </span>
              {allInterviewDone ? (
                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                  Complete
                </span>
              ) : allAssessmentsDone ? (
                <Link
                  to="/apply/assessments/$token/$type"
                  params={{ token, type: "INTERVIEW" }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {app.completedInterviewQuestions.length > 0 ? "Continue" : "Start"} <ArrowRight className="w-3 h-3" />
                </Link>
              ) : (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Locked</span>
              )}
            </div>
          </div>
        </div>

        {/* Completion message */}
        {totalProgress >= 5 && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
            <h2 className="mt-3 text-lg font-semibold text-green-800">All Assessments Complete!</h2>
            <p className="mt-1 text-sm text-green-700">
              Thank you, {app.firstName}. Your application is now under review.
              We will contact you at <strong>{app.email}</strong> with the outcome.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            Square 15 Management • Artisan Recruitment Portal
          </p>
        </div>
      </div>
    </div>
  );
}
