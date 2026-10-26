import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import {
  Users, ArrowLeft, Search, Filter, Briefcase, Mail, Phone,
  Star, Shield, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/admin/recruitment/candidates")({
  component: CandidatesGlobal,
});

const BUCKETS = [
  { key: "APPLIED", label: "Applied", bg: "bg-blue-100", color: "text-blue-700" },
  { key: "SCREENING", label: "Screening", bg: "bg-indigo-100", color: "text-indigo-700" },
  { key: "ASSESSMENT", label: "Assessment", bg: "bg-purple-100", color: "text-purple-700" },
  { key: "INTERVIEW", label: "Interview", bg: "bg-orange-100", color: "text-orange-700" },
  { key: "OFFER", label: "Offer", bg: "bg-amber-100", color: "text-amber-700" },
  { key: "BACKGROUND_CHECK", label: "Background", bg: "bg-cyan-100", color: "text-cyan-700" },
  { key: "HIRED", label: "Hired", bg: "bg-emerald-100", color: "text-emerald-700" },
  { key: "REJECTED", label: "Rejected", bg: "bg-red-100", color: "text-red-700" },
  { key: "WITHDRAWN", label: "Withdrawn", bg: "bg-gray-100", color: "text-gray-700" },
];

function CandidatesGlobal() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const [bucket, setBucket] = useState<string>("");
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState<number | undefined>(undefined);
  const [jobType, setJobType] = useState<"" | "COMMERCIAL" | "MAINTENANCE_APP">("");

  if (!token || !user || !["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "HR", "RECRUITER", "TECHNICAL_MANAGER"].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200 max-w-md">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-sm text-gray-600">You do not have permission to view this page.</p>
          <Link to="/admin/dashboard" className="mt-4 inline-block text-sm text-teal-600 hover:text-teal-700 font-medium">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const listQuery = useQuery(
    trpc.getApplications.queryOptions({
      token,
      bucket: bucket || undefined,
      jobId: jobFilter,
      jobType: jobType || undefined,
      search: search || undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
      take: 500,
    })
  );

  const jobsQuery = useQuery(
    trpc.getJobs.queryOptions({ token, mineOnly: false })
  );

  const apps = (listQuery.data ?? []) as any[];
  const jobs = (jobsQuery.data ?? []) as any[];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of apps) c[a.stageBucket] = (c[a.stageBucket] ?? 0) + 1;
    return c;
  }, [apps]);

  const total = apps.length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/admin/recruitment" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-teal-600" /> Candidates
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {total} total {total === 1 ? "application" : "applications"} across all jobs (new ATS)
            </p>
          </div>
          <button
            onClick={() => listQuery.refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${listQuery.isRefetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Division filter pills â€” Commercial vs Maintenance App */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 self-center mr-1">Division:</span>
          {([
            { key: "", label: "All divisions", bg: "bg-white", color: "text-gray-700", border: "border-gray-200" },
            { key: "COMMERCIAL", label: "Commercial", bg: "bg-indigo-50", color: "text-indigo-700", border: "border-indigo-200" },
            { key: "MAINTENANCE_APP", label: "Maintenance App", bg: "bg-emerald-50", color: "text-emerald-700", border: "border-emerald-200" },
          ] as const).map((d) => (
            <button
              key={d.key || "ALL"}
              onClick={() => setJobType(d.key as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                jobType === d.key ? "bg-teal-600 text-white border-teal-600" : `${d.bg} ${d.color} ${d.border} hover:opacity-80`
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Bucket filter pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setBucket("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${bucket === "" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
          >
            All ({total})
          </button>
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBucket(b.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                bucket === b.key ? "bg-teal-600 text-white border-teal-600" : `${b.bg} ${b.color} border-transparent hover:opacity-80`
              }`}
            >
              {b.label} ({counts[b.key] ?? 0})
            </button>
          ))}
        </div>

        {/* Search + job filter */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or trade..."
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <select
            value={jobFilter ?? ""}
            onChange={(e) => setJobFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                #{j.id} — {j.title}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        {listQuery.isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">Loading...</div>
        ) : apps.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="mt-3 text-sm text-gray-600">No applications match the current filters.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {apps.map((a) => {
              const bucketCfg = BUCKETS.find((b) => b.key === a.stageBucket);
              return (
                <Link
                  key={a.id}
                  to="/admin/recruitment/applications/$appId"
                  params={{ appId: String(a.id) }}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                        <span className="text-teal-700 font-bold text-sm">
                          {a.firstName?.[0]}{a.lastName?.[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {a.firstName} {a.lastName}
                          </h3>
                          {bucketCfg && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${bucketCfg.bg} ${bucketCfg.color}`}>
                              {bucketCfg.label}
                            </span>
                          )}
                          {(a as any).blinded && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-700 uppercase" title="Blind mode active — PII hidden at SCREENING to reduce bias">
                              Blind mode ON
                            </span>
                          )}
                          {a.currentStage?.name && (
                            <span className="text-xs text-gray-500">/ {a.currentStage.name}</span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1 truncate">
                            <Briefcase className="w-3 h-3" />
                            {a.job?.title ? `Job #${a.job.id} — ${a.job.title}` : "No job link"}
                          </span>
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" />
                            {a.email}
                          </span>
                          {a.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {a.phone}
                            </span>
                          )}
                          {a.primaryTrade && (
                            <span className="text-gray-600">{a.primaryTrade}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {typeof a.overallScore === "number" && (
                        <div className="flex items-center gap-1 text-sm font-bold text-gray-900 justify-end">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                          {Math.round(a.overallScore)}%
                        </div>
                      )}
                      {typeof a.aiMatchScore === "number" && (
                        <div className="text-[11px] text-gray-500 mt-0.5">AI match {Math.round(a.aiMatchScore)}%</div>
                      )}
                      {a.assignedRecruiter && (
                        <div className="text-[11px] text-gray-500 mt-1">
                          Owner: {a.assignedRecruiter.firstName} {a.assignedRecruiter.lastName}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
