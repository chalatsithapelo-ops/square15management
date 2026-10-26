import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import {
  UserPlus, Users, CheckCircle2, Clock, ExternalLink, Copy, X,
  Mail, Phone, MapPin, Briefcase, Award, FileText, Wrench,
  Sparkles, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

const ROLE_OPTIONS = [
  "ARTISAN",
  "STAFF",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "JUNIOR_ADMIN",
  "SENIOR_ADMIN",
  "HR",
  "RECRUITER",
  "PROPERTY_MANAGER",
  "CONTRACTOR",
  "CONTRACTOR_JUNIOR_MANAGER",
  "CONTRACTOR_SENIOR_MANAGER",
];

export function OnboardingTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "AWAITING_APP_APPROVAL" | "USER_CREATED">("PENDING");
  const [modalFor, setModalFor] = useState<any | null>(null);

  const q = useQuery(trpc.getPendingOnboarding.queryOptions({ token: token! }));
  const rows = (q.data?.rows ?? []) as any[];
  const summary = q.data?.summary;

  const filtered = useMemo(
    () => (statusFilter === "ALL" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Awaiting onboarding" value={summary?.pending ?? 0} icon={<UserPlus className="w-4 h-4" />} tone="amber" />
        <StatCard label="Awaiting App approval" value={summary?.awaitingAppApproval ?? 0} icon={<Wrench className="w-4 h-4" />} tone="blue" />
        <StatCard label="Onboarded (login created)" value={summary?.onboarded ?? 0} icon={<CheckCircle2 className="w-4 h-4" />} tone="emerald" />
        <StatCard label="Total hired" value={summary?.total ?? 0} icon={<Users className="w-4 h-4" />} tone="gray" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Hired candidates</h2>
            <p className="text-xs text-gray-500">
              Candidates who reached the HIRED stage. Provision a login here so they appear under the correct role tile in Employees.
            </p>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["PENDING", "AWAITING_APP_APPROVAL", "USER_CREATED", "ALL"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  statusFilter === s ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {s === "AWAITING_APP_APPROVAL" ? "Awaiting App Approval" : s === "USER_CREATED" ? "Onboarded" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {q.isLoading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <UserPlus className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="mt-3 text-sm text-gray-600">No hired candidates in this bucket.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">Candidate</th>
                <th className="text-left px-4 py-2">Role hired for</th>
                <th className="text-left px-4 py-2">Suggested login role</th>
                <th className="text-left px-4 py-2">Documents</th>
                <th className="text-left px-4 py-2">Hired</th>
                <th className="text-right px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.application.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {r.application.firstName} {r.application.lastName}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{r.application.email}</span>
                      {r.application.phone && (
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{r.application.phone}</span>
                      )}
                      {r.application.city && (
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{r.application.city}, {r.application.province}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800 font-medium">{r.job?.title ?? "—"}</div>
                    <div className="text-xs text-gray-500">
                      {r.job?.category ?? ""}{r.job?.department ? ` · ${r.job.department}` : ""}
                      {r.job?.jobType === "MAINTENANCE_APP" && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">Maintenance App</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold">
                      {r.suggestedRole.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-col gap-0.5">
                      {r.application.resumeUrl && (
                        <a href={r.application.resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                          <FileText className="w-3 h-3" /> Resume <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {(r.attachments ?? []).map((a: any) => (
                        <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                          <FileText className="w-3 h-3" /> {a.label}: {a.fileName} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                      {(r.application.portfolioUrls ?? []).map((u: string, i: number) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                          <FileText className="w-3 h-3" /> Portfolio {i + 1} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                      {!r.application.resumeUrl && (r.attachments ?? []).length === 0 && (r.application.portfolioUrls ?? []).length === 0 && (
                        <span className="text-gray-400 italic">No documents attached</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {r.application.hiredAt ? new Date(r.application.hiredAt).toLocaleDateString("en-ZA") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "USER_CREATED" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" /> User #{r.existingUser.id} · {r.existingUser.role.replace(/_/g, " ")}
                      </span>
                    ) : r.status === "AWAITING_APP_APPROVAL" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-700">
                        <Clock className="w-4 h-4" /> Awaiting Maintenance App admin
                      </span>
                    ) : (
                      <button
                        onClick={() => setModalFor(r)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700"
                      >
                        <UserPlus className="w-4 h-4" /> Create login
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalFor && (
        <OnboardModal row={modalFor} onClose={() => setModalFor(null)} onDone={() => { setModalFor(null); qc.invalidateQueries({ queryKey: trpc.getPendingOnboarding.queryKey() }); }} />
      )}
    </div>
  );
}

function OnboardModal({ row, onClose, onDone }: { row: any; onClose: () => void; onDone: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [role, setRole] = useState<string>(row.suggestedRole);
  const [rateType, setRateType] = useState<"NONE" | "HOURLY" | "DAILY" | "BOTH" | "MONTHLY">("NONE");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [dailyRate, setDailyRate] = useState<string>("");
  const [monthlySalary, setMonthlySalary] = useState<string>("");
  const [customPw, setCustomPw] = useState<string>("");
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState<boolean>(false);

  // Prefill rates from the candidate's accepted offer (if any)
  const offerQ = useQuery(trpc.getAcceptedOfferForApplication.queryOptions({ token: token!, applicationId: row.application.id }));
  useEffect(() => {
    const o = offerQ.data as any;
    if (!o || prefilled) return;
    const hasHourly = o.hourlyRate && o.hourlyRate > 0;
    const hasDaily = o.dailyRate && o.dailyRate > 0;
    const hasMonthly = (o.monthlySalary && o.monthlySalary > 0) || (o.salaryPeriod === "MONTHLY" && o.baseSalary > 0);
    if (hasHourly && hasDaily) setRateType("BOTH");
    else if (hasHourly) setRateType("HOURLY");
    else if (hasDaily) setRateType("DAILY");
    else if (hasMonthly) setRateType("MONTHLY");
    if (hasHourly) setHourlyRate(String(o.hourlyRate));
    if (hasDaily) setDailyRate(String(o.dailyRate));
    if (hasMonthly) setMonthlySalary(String(o.monthlySalary ?? o.baseSalary));
    setPrefilled(true);
  }, [offerQ.data, prefilled]);

  const mut = useMutation({
    ...trpc.onboardHiredCandidate.mutationOptions(),
    onSuccess: (res: any) => {
      if (res.temporaryPassword) setTempPw(res.temporaryPassword);
      else {
        toast.success(`User #${res.userId} created`);
        onDone();
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    const payload: any = { token: token!, applicationId: row.application.id, role, sendWelcomeEmail: sendEmail };
    if (rateType === "HOURLY" || rateType === "BOTH") payload.hourlyRate = Number(hourlyRate) || undefined;
    if (rateType === "DAILY" || rateType === "BOTH") payload.dailyRate = Number(dailyRate) || undefined;
    if (rateType === "MONTHLY") payload.monthlySalary = Number(monthlySalary) || undefined;
    if (customPw.trim().length >= 6) payload.customPassword = customPw.trim();
    mut.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Create login for {row.application.firstName} {row.application.lastName}</h3>
            <p className="text-xs text-gray-500">Hired for {row.job?.title ?? "—"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        {tempPw ? (
          <div className="p-6 space-y-4 text-center">
          {offerQ.data ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
              <b>Prefilled from accepted offer</b> · role & rates were taken from offer #{(offerQ.data as any).id}. You can edit them below.
            </div>
          ) : null}

            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <div className="font-semibold text-gray-900">Login provisioned</div>
            <div className="text-sm text-gray-600">Temporary password (copy now — it will not be shown again):</div>
            <div className="bg-gray-100 rounded-lg p-3 font-mono text-sm flex items-center justify-between gap-2">
              <code className="text-gray-800">{tempPw}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(tempPw); toast.success("Copied"); }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white border rounded text-xs hover:bg-gray-50"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <p className="text-xs text-gray-500">A welcome email {sendEmail ? "was" : "was NOT"} sent to {row.application.email}.</p>
            <button onClick={onDone} className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700">Done</button>
          </div>
        ) : (
          <div className="p-4 space-y-3 text-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Login role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Auto-suggested from the job title. Change if the actual role is different.
                {row.job?.jobType === "MAINTENANCE_APP" && (
                  <span className="text-emerald-700"> · Maintenance App hire — usually ARTISAN.</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Pay structure</label>
              <select value={rateType} onChange={(e) => setRateType(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="NONE">Not now / commission only</option>
                <option value="HOURLY">Hourly rate</option>
                <option value="DAILY">Daily rate</option>
                <option value="BOTH">Both hourly + daily (client dependent)</option>
                <option value="MONTHLY">Monthly salary</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Independent-contractor engagement. Rates can be edited later on the employee profile.
              </p>
            </div>
            {(rateType === "HOURLY" || rateType === "BOTH") && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Hourly rate (R)</label>
                <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="150" />
              </div>
            )}
            {(rateType === "DAILY" || rateType === "BOTH") && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Daily rate (R)</label>
                <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="400" />
              </div>
            )}
            {rateType === "MONTHLY" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Monthly salary (R)</label>
                <input type="number" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
              <input value={customPw} onChange={(e) => setCustomPw(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Leave blank to generate a random one" />
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              Send welcome email with login details
            </label>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={submit}
                disabled={mut.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
              >
                {mut.isPending ? "Creating…" : "Create login & onboard"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "amber" | "blue" | "emerald" | "gray" }) {
  const cls: Record<string, string> = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    gray: "bg-gray-50 border-gray-200 text-gray-800",
  };
  return (
    <div className={`rounded-xl border p-4 ${cls[tone]}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
