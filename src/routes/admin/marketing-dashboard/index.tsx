import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  Star,
  Target,
  BarChart3,
  Megaphone,
  Clock,
  AlertCircle,
  CheckCircle,
  Send,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CalendarDays,
  Globe,
  Phone,
  UserPlus,
  Share2,
  Bot,
  Zap,
  MapPin,
} from "lucide-react";
import { ROLES } from "~/utils/roles";

const ADMIN_ROLES = new Set([
  ROLES.ADMIN,
  ROLES.SENIOR_ADMIN,
  ROLES.JUNIOR_ADMIN,
  ROLES.MANAGER,
]);

export const Route = createFileRoute("/admin/marketing-dashboard/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    const { user } = useAuthStore.getState();
    if (!user || !ADMIN_ROLES.has(user.role as any)) {
      throw redirect({ to: "/", search: { redirect: location.href } });
    }
  },
  component: MarketingDashboardPage,
});

// Source icon mapping
const sourceIcons: Record<string, any> = {
  WEBSITE: Globe,
  REFERRAL: Share2,
  CAMPAIGN: Megaphone,
  PHONE: Phone,
  WALK_IN: MapPin,
  AI_AGENT: Bot,
  SOCIAL_MEDIA: Share2,
  OTHER: Zap,
};

// Status color mapping
const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  QUALIFIED: "bg-indigo-100 text-indigo-800",
  PROPOSAL_SENT: "bg-purple-100 text-purple-800",
  NEGOTIATION: "bg-orange-100 text-orange-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
};

const campaignStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
  SENDING: "bg-yellow-100 text-yellow-800",
  SENT: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

function MarketingDashboardPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const dashboardQuery = useQuery(
    trpc.getMarketingDashboard.queryOptions({ token: token! })
  );

  const data = dashboardQuery.data;

  if (dashboardQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading marketing dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Unable to load dashboard data.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/admin/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-2 rounded-xl shadow-md">
                <Megaphone className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Marketing & Sales Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  Campaign performance, lead analytics & sales intelligence
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                to="/admin/crm"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                CRM →
              </Link>
              <Link
                to="/admin/crm/campaigns"
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 rounded-lg transition-colors shadow-sm"
              >
                Campaigns →
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ─── KPI Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Leads */}
          <KPICard
            title="Total Leads"
            value={data.leads.total}
            subtitle={`${data.leads.new30d} new this month`}
            icon={<Users className="h-6 w-6" />}
            color="blue"
            trend={data.leads.leadGrowth}
          />
          {/* Conversion Rate */}
          <KPICard
            title="Conversion Rate"
            value={`${data.leads.conversionRate}%`}
            subtitle={`${data.leads.won} won / ${data.leads.lost} lost`}
            icon={<Target className="h-6 w-6" />}
            color="green"
          />
          {/* Pipeline Value */}
          <KPICard
            title="Pipeline Value"
            value={`R${data.leads.pipelineValue.toLocaleString()}`}
            subtitle={`${data.leads.active} active leads`}
            icon={<TrendingUp className="h-6 w-6" />}
            color="purple"
          />
          {/* Emails Sent */}
          <KPICard
            title="Emails Sent"
            value={data.campaigns.totalEmailsSent}
            subtitle={`${data.campaigns.deliveryRate}% delivery rate`}
            icon={<Mail className="h-6 w-6" />}
            color="pink"
          />
        </div>

        {/* ─── Second Row: Revenue & Reviews ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Won Revenue"
            value={`R${data.leads.wonValue.toLocaleString()}`}
            subtitle="Lifetime deal value"
            icon={<CheckCircle className="h-6 w-6" />}
            color="emerald"
          />
          <KPICard
            title="Campaigns"
            value={data.campaigns.total}
            subtitle={`${data.campaigns.sent} sent · ${data.campaigns.draft} draft · ${data.campaigns.scheduled} scheduled`}
            icon={<Megaphone className="h-6 w-6" />}
            color="orange"
          />
          <KPICard
            title="Rating"
            value={data.reviews.avgRating ? `${data.reviews.avgRating}/5` : "N/A"}
            subtitle={`${data.reviews.totalCount} reviews`}
            icon={<Star className="h-6 w-6" />}
            color="yellow"
          />
          <KPICard
            title="Follow-ups"
            value={data.followUps.overdue}
            subtitle={`${data.followUps.upcoming7d} due this week`}
            icon={<Clock className="h-6 w-6" />}
            color={data.followUps.overdue > 0 ? "red" : "teal"}
            alert={data.followUps.overdue > 0}
          />
        </div>

        {/* ─── Charts Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Sources */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Lead Sources
            </h3>
            {data.sourceStats.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">
                No lead source data yet. Leads will be tracked by source as they come in.
              </p>
            ) : (
              <div className="space-y-3">
                {data.sourceStats.map((s) => {
                  const max = Math.max(...data.sourceStats.map((x) => x.total));
                  const pct = max > 0 ? (s.total / max) * 100 : 0;
                  const Icon = sourceIcons[s.source] || Zap;
                  return (
                    <div key={s.source} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-gray-700">
                          <Icon className="h-4 w-4 text-gray-500" />
                          {s.source.replace(/_/g, " ")}
                        </span>
                        <span className="text-gray-500">
                          {s.total} leads · {s.won} won · {s.conversionRate}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pipeline by Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Sales Pipeline
            </h3>
            {data.leadsByStatus.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">
                No leads in the pipeline yet.
              </p>
            ) : (
              <div className="space-y-3">
                {data.leadsByStatus.map((s) => {
                  const max = Math.max(...data.leadsByStatus.map((x) => x.count));
                  const pct = max > 0 ? (s.count / max) * 100 : 0;
                  return (
                    <div key={s.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] || "bg-gray-100 text-gray-800"}`}
                        >
                          {s.status.replace(/_/g, " ")}
                        </span>
                        <span className="font-medium text-gray-700">{s.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-green-400 to-emerald-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Campaigns & Top Services ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Campaigns */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Send className="h-5 w-5 text-pink-600" />
                Recent Campaigns
              </h3>
              <Link
                to="/admin/crm/campaigns"
                className="text-sm text-pink-600 hover:text-pink-700 font-medium"
              >
                View all →
              </Link>
            </div>
            {data.recentCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No campaigns yet</p>
                <Link
                  to="/admin/crm/campaigns"
                  className="text-sm text-pink-600 hover:underline mt-1 inline-block"
                >
                  Create your first campaign →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentCampaigns.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.sentAt
                          ? `Sent ${new Date(c.sentAt).toLocaleDateString()}`
                          : c.scheduledFor
                            ? `Scheduled ${new Date(c.scheduledFor).toLocaleDateString()}`
                            : `Created ${new Date(c.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-xs text-gray-600">
                        {c.totalSent}/{c.totalRecipients}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${campaignStatusColors[c.status] || "bg-gray-100"}`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Services in Demand */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-600" />
              Top Services in Demand
            </h3>
            {data.topServices.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">
                No service data yet.
              </p>
            ) : (
              <div className="space-y-3">
                {data.topServices.map((s, i) => {
                  const max = Math.max(...data.topServices.map((x) => x.count));
                  const pct = max > 0 ? (s.count / max) * 100 : 0;
                  return (
                    <div key={s.service} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">
                          {i + 1}. {s.service}
                        </span>
                        <span className="text-gray-500">{s.count} inquiries</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-orange-400 to-amber-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Reviews ─── */}
        {data.recentReviews.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Recent Customer Reviews
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.recentReviews.map((r, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm">
                      {r.customerName}
                    </span>
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={`h-4 w-4 ${idx < Math.round(r.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-gray-600 line-clamp-3">{r.comment}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Alerts & Recommendations ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Insights & Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.followUps.overdue > 0 && (
              <InsightCard
                type="warning"
                title={`${data.followUps.overdue} Overdue Follow-ups`}
                description="These leads need immediate attention. Go to CRM to follow up."
                action="View in CRM →"
                href="/admin/crm"
              />
            )}
            {data.leads.new30d === 0 && (
              <InsightCard
                type="alert"
                title="No New Leads This Month"
                description="Create and send a marketing campaign to generate new leads."
                action="Create Campaign →"
                href="/admin/crm/campaigns"
              />
            )}
            {data.campaigns.total === 0 && (
              <InsightCard
                type="info"
                title="No Campaigns Created Yet"
                description="Email campaigns are a great way to engage leads. Create your first campaign now."
                action="Create Campaign →"
                href="/admin/crm/campaigns"
              />
            )}
            {data.reviews.totalCount === 0 && (
              <InsightCard
                type="info"
                title="No Reviews Collected"
                description="Ask your AI Agent to send review requests to recent customers to build your reputation."
                action="Open AI Agent →"
                href="/admin/ai-agent"
              />
            )}
            {data.leads.active > 5 && data.campaigns.sent === 0 && (
              <InsightCard
                type="opportunity"
                title={`${data.leads.active} Active Leads Waiting`}
                description="You have active leads but haven't sent any campaigns. Engage them with a marketing email."
                action="Create Campaign →"
                href="/admin/crm/campaigns"
              />
            )}
            {!data.sourceStats.find((s) => s.source === "WEBSITE") && (
              <InsightCard
                type="info"
                title="No Website Leads"
                description="Add the contact form integration on www.square15.co.za to capture leads from your website."
              />
            )}
            {data.leads.conversionRate > 0 && (
              <InsightCard
                type="success"
                title={`${data.leads.conversionRate}% Conversion Rate`}
                description={`You've converted ${data.leads.won} leads to customers worth R${data.leads.wonValue.toLocaleString()}.`}
              />
            )}
            {data.leads.leadGrowth !== null && data.leads.leadGrowth > 0 && (
              <InsightCard
                type="success"
                title={`Lead Growth: +${data.leads.leadGrowth}%`}
                description="Your lead generation is trending upward compared to the previous period."
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── KPICard Component ───
function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  alert,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  trend?: number | null;
  alert?: boolean;
}) {
  const colorMap: Record<string, { bg: string; icon: string; ring: string }> = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600", ring: "ring-blue-200" },
    green: { bg: "bg-green-50", icon: "text-green-600", ring: "ring-green-200" },
    purple: { bg: "bg-purple-50", icon: "text-purple-600", ring: "ring-purple-200" },
    pink: { bg: "bg-pink-50", icon: "text-pink-600", ring: "ring-pink-200" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", ring: "ring-emerald-200" },
    orange: { bg: "bg-orange-50", icon: "text-orange-600", ring: "ring-orange-200" },
    yellow: { bg: "bg-yellow-50", icon: "text-yellow-600", ring: "ring-yellow-200" },
    red: { bg: "bg-red-50", icon: "text-red-600", ring: "ring-red-200" },
    teal: { bg: "bg-teal-50", icon: "text-teal-600", ring: "ring-teal-200" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow ${alert ? "ring-2 ring-red-300" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <span className={c.icon}>{icon}</span>
        </div>
        {trend !== undefined && trend !== null && (
          <span
            className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend > 0
                ? "bg-green-100 text-green-700"
                : trend < 0
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {trend > 0 ? (
              <ArrowUpRight className="h-3 w-3 mr-0.5" />
            ) : trend < 0 ? (
              <ArrowDownRight className="h-3 w-3 mr-0.5" />
            ) : (
              <Minus className="h-3 w-3 mr-0.5" />
            )}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{title}</p>
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── InsightCard Component ───
function InsightCard({
  type,
  title,
  description,
  action,
  href,
}: {
  type: "warning" | "alert" | "info" | "opportunity" | "success";
  title: string;
  description: string;
  action?: string;
  href?: string;
}) {
  const typeStyles: Record<string, { bg: string; border: string; icon: any; iconColor: string }> = {
    warning: { bg: "bg-yellow-50", border: "border-yellow-200", icon: AlertCircle, iconColor: "text-yellow-600" },
    alert: { bg: "bg-red-50", border: "border-red-200", icon: AlertCircle, iconColor: "text-red-600" },
    info: { bg: "bg-blue-50", border: "border-blue-200", icon: Zap, iconColor: "text-blue-600" },
    opportunity: { bg: "bg-purple-50", border: "border-purple-200", icon: Target, iconColor: "text-purple-600" },
    success: { bg: "bg-green-50", border: "border-green-200", icon: CheckCircle, iconColor: "text-green-600" },
  };
  const s = typeStyles[type];
  const Icon = s.icon;

  return (
    <div className={`${s.bg} border ${s.border} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${s.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="min-w-0">
          <p className="font-medium text-gray-900 text-sm">{title}</p>
          <p className="text-xs text-gray-600 mt-1">{description}</p>
          {action && href && (
            <Link
              to={href}
              className={`text-xs font-medium mt-2 inline-block ${s.iconColor} hover:underline`}
            >
              {action}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
