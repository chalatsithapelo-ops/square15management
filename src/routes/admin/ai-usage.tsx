import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Activity, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { AccessDenied } from "~/components/AccessDenied";
import type { AIUsageSummary } from "~/server/trpc/procedures/aiUsageControls";

export const Route = createFileRoute("/admin/ai-usage")({ component: AIUsagePage });

type BudgetValues = AIUsageSummary["controls"];
const usd = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6,
}).format(value);
const count = (value: number) => value.toLocaleString("en-US");

function AIUsagePage() {
  const { token, user } = useAuthStore();
  // Auth store exposes token/user, not an auth status field. Backend remains authoritative.
  if (!token || !user) return <AccessDenied message="Sign in with an administrator account to view AI usage." />;
  if (!["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN"].includes(user.role)) {
    return <AccessDenied message="Only administrators can view AI usage." />;
  }
  // Mount queries only after the local auth gate; do not display another session's cached data.
  return <AIUsageDashboard key={`${user.id}:${token}`} token={token} />;
}

function AIUsageDashboard({ token }: { token: string }) {
  const trpc = useTRPC();
  const summary = useQuery({
    ...trpc.getAIUsageSummary.queryOptions({ token }),
    staleTime: 15_000, refetchInterval: 60_000, retry: false,
  });
  const mutation = useMutation(trpc.updateAIBudgetControls.mutationOptions());
  const [draft, setDraft] = useState<Record<keyof BudgetValues, string> | null>(null);
  const [period, setPeriod] = useState<"month" | "day">("month");
  const data = summary.data;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !data?.canEdit || mutation.isPending) return;
    const values = {
      monthlyBudgetUsd: Number(draft.monthlyBudgetUsd), dailyBudgetUsd: Number(draft.dailyBudgetUsd),
      dailyRequestLimit: Number(draft.dailyRequestLimit),
    };
    if (Object.values(draft).some(value => !value.trim()) || Object.values(values).some(value => !Number.isFinite(value)) ||
      values.monthlyBudgetUsd < 0 || values.monthlyBudgetUsd > 100 || values.dailyBudgetUsd < 0 ||
      values.dailyBudgetUsd > values.monthlyBudgetUsd || !Number.isInteger(values.dailyRequestLimit) ||
      values.dailyRequestLimit < 1 || values.dailyRequestLimit > 10_000) {
      toast.error("Use monthly USD 0–100, daily USD 0–monthly, and 1–10,000 whole requests.");
      return;
    }
    try {
      await mutation.mutateAsync({ token, ...values });
      toast.success("AI budget controls saved");
      setDraft(null);
      await summary.refetch();
    } catch { toast.error("Could not save AI budget controls. Check your permissions and try again."); }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4" /> ADMIN CONTROLS</div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI usage & budgets</h1>
            <p className="mt-2 text-sm text-slate-600">Global usage, conservative reservations, and spending guardrails. All periods are UTC.</p></div>
          <button type="button" disabled={summary.isFetching} onClick={() => void summary.refetch()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${summary.isFetching ? "animate-spin" : ""}`} /> Refresh</button>
        </header>

        {summary.isPending && <p role="status" className="rounded-xl border bg-white p-6">Loading AI usage…</p>}
        {summary.isError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">AI usage could not be loaded. Check your access or try refreshing.</p>}
        {data && !summary.isError && <>
          <div className={`rounded-xl border p-4 text-sm ${data.cooldown.active ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            <strong>{data.cooldown.active ? "Billing cooldown: AI requests paused" : "No active billing cooldown"}</strong>
            {data.cooldown.invalid ? " — invalid cooldown setting; contact an administrator." : data.cooldown.untilUtc ? ` · Cooldown until ${data.cooldown.untilUtc} (UTC)` : ""}
            <span className="mt-1 block">Saving budgets does not reset cooldowns or release outstanding reservations.</span>
          </div>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="AI usage overview">
            {([
              ["Month · " + data.utcMonth + " UTC", usd(data.month.spendAndReservedUsd), `${usd(data.month.remainingBudgetUsd)} remaining of ${usd(data.controls.monthlyBudgetUsd)}`],
              ["Day · " + data.utcDay + " UTC", usd(data.day.spendAndReservedUsd), `${usd(data.day.remainingBudgetUsd)} remaining of ${usd(data.controls.dailyBudgetUsd)}`],
              ["Requests today", count(data.day.requests), `${count(data.day.remainingRequests)} remaining of ${count(data.controls.dailyRequestLimit)}`],
              ["Outstanding · all time", count(data.outstanding.count), `${usd(data.outstanding.reservedUsd)} still reserved`],
            ] as const).map(([label, value, detail]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">{label}<Activity className="h-4 w-4 text-emerald-600" /></div><p className="mt-3 text-2xl font-bold text-slate-900">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></article>)}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-semibold text-slate-900">Usage by feature / provider / model</h2><p className="mt-1 text-xs text-slate-500">Settled {usd(data[period].actualSettledUsd)} · outstanding {usd(data[period].outstandingReservedUsd)} · {count(data[period].carriedOutstandingCount)} carried reservations</p></div>
              <div className="flex rounded-lg bg-slate-100 p-1">{(["month", "day"] as const).map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-md px-4 py-2 text-sm capitalize ${period === value ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}>{value} UTC</button>)}</div></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Feature / provider / model", "Requests", "Spend + reserved", "Settled", "Outstanding", "Input tokens", "Output tokens", "Reasoning", "Cached / writes"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{data[period].byFeatureProviderModel.map(row => <tr key={JSON.stringify([row.feature, row.provider, row.model])} className="hover:bg-slate-50"><td className="px-4 py-4"><div className="font-medium text-slate-900">{row.feature}</div><div className="text-xs text-slate-500">{row.provider} / {row.model}</div></td><td className="px-4 py-4">{count(row.requests)}</td><td className="whitespace-nowrap px-4 py-4 font-semibold">{usd(row.spendAndReservedUsd)}</td><td className="px-4 py-4">{usd(row.actualSettledUsd)}</td><td className="px-4 py-4">{count(row.outstandingCount)}<div className="text-xs text-slate-500">{usd(row.outstandingReservedUsd)}</div></td><td className="px-4 py-4">{count(row.inputTokens)}</td><td className="px-4 py-4">{count(row.outputTokens)}</td><td className="px-4 py-4">{count(row.reasoningTokens)}</td><td className="whitespace-nowrap px-4 py-4">{count(row.cachedTokens)} / {count(row.cacheWriteTokens)}</td></tr>)}
                {!data[period].byFeatureProviderModel.length && <tr><td colSpan={9} className="p-8 text-center text-slate-500">No usage or outstanding reservations for this period.</td></tr>}</tbody></table></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Wallet className="h-5 w-5 text-emerald-700" /> Budget settings</h2>
            <p className="mt-2 text-sm text-slate-600">Defaults: {usd(data.defaults.monthlyBudgetUsd)}/month, {usd(data.defaults.dailyBudgetUsd)}/day, {count(data.defaults.dailyRequestLimit)} requests/day. Zero budget pauses new paid AI calls.</p>
            {!data.canEdit && <p className="mt-3 text-sm text-amber-700">View only. Budget changes require ADMIN or SENIOR_ADMIN.</p>}
            <form onSubmit={save} className="mt-5 space-y-4"><fieldset disabled={!data.canEdit || mutation.isPending} className="grid gap-4 sm:grid-cols-3 disabled:opacity-60">
              {([
                ["monthlyBudgetUsd", "Monthly budget (USD)", 0, 100, "any"],
                ["dailyBudgetUsd", "Daily budget (USD)", 0, Number(draft?.monthlyBudgetUsd ?? data.controls.monthlyBudgetUsd), "any"],
                ["dailyRequestLimit", "Daily request limit", 1, 10_000, "1"],
              ] as const).map(([key, label, min, max, step]) => <label key={key} className="text-sm font-medium text-slate-700">{label}<input type="number" required min={min} max={max} step={step} value={draft?.[key] ?? data.controls[key]} onChange={event => setDraft(previous => ({ monthlyBudgetUsd: String(data.controls.monthlyBudgetUsd), dailyBudgetUsd: String(data.controls.dailyBudgetUsd), dailyRequestLimit: String(data.controls.dailyRequestLimit), ...previous, [key]: event.target.value }))} className="mt-2 block w-full rounded-lg border-slate-300 focus:border-emerald-600 focus:ring-emerald-600" /></label>)}
            </fieldset><button type="submit" disabled={!data.canEdit || !draft || mutation.isPending} className="rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{mutation.isPending ? "Saving…" : "Save budget controls"}</button></form>
          </section>
          <footer className="text-xs leading-relaxed text-slate-500">As of {data.asOfUtc} (UTC). Spend + reserved uses settled cost when available, otherwise the conservative reservation. Unresolved calls from earlier UTC periods continue to reduce both caps. Costs are ledger estimates, not provider invoices; token subtotals may overlap (reasoning/output and cached/input). No prompts or user-level data are shown.</footer>
        </>}
      </div>
    </main>
  );
}