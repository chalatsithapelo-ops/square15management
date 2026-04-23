import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import {
  Briefcase, Plus, Users, Eye, Search, Filter, BarChart3,
  Loader2, Shield, ArrowLeft, FileText, Building, MapPin,
  Clock, CheckCircle2, PauseCircle, XCircle, Send,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/recruitment/jobs/")({
  component: JobsListPage,
});

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  OPEN: "bg-emerald-100 text-emerald-700",
  ON_HOLD: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function JobsListPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  if (!token || !user || !["ADMIN", "SENIOR_ADMIN", "MANAGER", "JUNIOR_ADMIN", "HR", "RECRUITER"].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center border max-w-md">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Access Denied</h1>
          <Link to="/admin/dashboard" className="mt-4 inline-block text-teal-600">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const jobsQuery = useQuery(
    trpc.getJobs.queryOptions({
      token,
      status: statusFilter || undefined,
      search: search || undefined,
    }),
  );

  const createJobMut = useMutation(
    trpc.createJob.mutationOptions({
      onSuccess: (job) => {
        toast.success("Job created");
        setShowCreate(false);
        queryClient.invalidateQueries({ queryKey: trpc.getJobs.queryKey({ token }) });
        navigate({ to: "/admin/recruitment/jobs/$jobId", params: { jobId: String(job.id) } });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const jobs = jobsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Briefcase className="w-6 h-6 text-teal-600" />
            <h1 className="text-xl font-semibold">Jobs & Requisitions</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/recruitment/analytics"
              className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50 flex items-center gap-1.5"
            >
              <BarChart3 className="w-4 h-4" /> Analytics
            </Link>
            <Link
              to="/admin/recruitment"
              className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" /> All Candidates
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Job
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="pl-9 pr-3 py-2 w-full rounded-lg border bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-white text-sm"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="OPEN">Open</option>
            <option value="ON_HOLD">On hold</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        {jobsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Briefcase className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="mt-3 text-gray-600">No jobs yet. Create your first requisition.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {jobs.map((j: any) => (
              <Link
                key={j.id}
                to="/admin/recruitment/jobs/$jobId"
                params={{ jobId: String(j.id) }}
                className="bg-white rounded-xl border p-4 hover:border-teal-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{j.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[j.status] ?? "bg-gray-100"}`}>
                        {j.status.replace(/_/g, " ")}
                      </span>
                      {j.visibility === "INTERNAL" && (
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Internal only</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-600 flex items-center gap-3 flex-wrap">
                      {j.department && <span className="flex items-center gap-1"><Building className="w-3 h-3" />{j.department}</span>}
                      {j.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{j.location}</span>}
                      {j.category && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{j.category}</span>}
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{j._count.applications} applicants</span>
                    </div>
                  </div>
                  <Eye className="w-5 h-5 text-gray-300 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateJobModal
          onClose={() => setShowCreate(false)}
          onCreate={(data) => createJobMut.mutate({ token, ...data })}
          submitting={createJobMut.isPending}
        />
      )}
    </div>
  );
}

function CreateJobModal({ onClose, onCreate, submitting }: { onClose: () => void; onCreate: (data: any) => void; submitting: boolean }) {
  const [form, setForm] = useState({
    title: "",
    department: "",
    location: "",
    province: "",
    employmentType: "FULL_TIME" as const,
    description: "",
    requirements: "",
    minSalary: "",
    maxSalary: "",
    category: "",
    headcount: 1,
    visibility: "PUBLIC" as "PUBLIC" | "INTERNAL" | "PRIVATE",
    requireIQ: false,
    requireEQ: false,
    requireBigFive: false,
    requireSJT: true,
    requireWorkSample: false,
    requireInterview: true,
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-2xl my-8 shadow-xl">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Create Job Requisition</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Input label="Job title *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
            <Input label="Category (trade)" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
            <Input label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <Input label="Province" value={form.province} onChange={(v) => setForm({ ...form, province: v })} />
            <Input label="Min salary (ZAR)" value={form.minSalary} onChange={(v) => setForm({ ...form, minSalary: v })} type="number" />
            <Input label="Max salary (ZAR)" value={form.maxSalary} onChange={(v) => setForm({ ...form, maxSalary: v })} type="number" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Requirements</label>
            <textarea
              value={form.requirements}
              onChange={(e) => setForm({ ...form, requirements: e.target.value })}
              rows={3}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value as any })}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="PUBLIC">Public (career site)</option>
                <option value="INTERNAL">Internal only</option>
                <option value="PRIVATE">Private (invite)</option>
              </select>
            </div>
            <Input label="Headcount" value={String(form.headcount)} onChange={(v) => setForm({ ...form, headcount: Number(v) || 1 })} type="number" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Assessment requirements</label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {([
                ["requireIQ", "IQ test"],
                ["requireEQ", "EQ test"],
                ["requireBigFive", "Big Five"],
                ["requireSJT", "Situational Judgement"],
                ["requireWorkSample", "Work sample"],
                ["requireInterview", "AI interview"],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(form as any)[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.checked } as any)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">Cancel</button>
          <button
            disabled={!form.title || !form.description || submitting}
            onClick={() =>
              onCreate({
                ...form,
                minSalary: form.minSalary ? Number(form.minSalary) : undefined,
                maxSalary: form.maxSalary ? Number(form.maxSalary) : undefined,
              })
            }
            className="px-4 py-2 rounded-lg bg-teal-600 text-white disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create job
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2"
      />
    </div>
  );
}
