import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { ArrowLeft, MapPin, Briefcase, Building2, CheckCircle2, Sparkles, Shield, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { z } from "zod";

export const Route = createFileRoute("/careers/$slug")({
  component: JobPublicPage,
  validateSearch: z.object({
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_content: z.string().optional(),
    utm_term: z.string().optional(),
    ref: z.string().optional(),
  }),
});

function JobPublicPage() {
  const { slug } = Route.useParams();
  const s = Route.useSearch();
  const trpc = useTRPC();
  const nav = useNavigate();
  const jobQ = useQuery(trpc.getPublicJob.queryOptions({ slug }));
  const [showApply, setShowApply] = useState(false);
  const [submitted, setSubmitted] = useState<{ portalUrl: string } | null>(null);

  const applyMut = useMutation(
    trpc.createApplication.mutationOptions({
      onSuccess: (res) => setSubmitted(res),
      onError: (e) => toast.error(e.message),
    }),
  );

  const job = jobQ.data;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Application received</h1>
          <p className="text-sm text-gray-600 mb-5">
            Thanks for applying. We've emailed you a link to track your progress. You can also bookmark your candidate portal:
          </p>
          <a
            href={submitted.portalUrl}
            className="inline-block px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium"
          >
            Open candidate portal
          </a>
          <div className="mt-5">
            <Link to="/careers" className="text-sm text-teal-600 hover:underline">← Browse more jobs</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/careers" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> All jobs
          </Link>
        </div>
      </div>

      {jobQ.isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
      ) : !job ? (
        <div className="text-center py-20 text-gray-400">Job not found</div>
      ) : (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6">
            {job.department && <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{job.department}</span>}
            {job.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>}
            {job.employmentType && <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{job.employmentType}</span>}
            {job.experienceLevel && <span>{job.experienceLevel}</span>}
          </div>

          <div className="bg-white rounded-xl border p-6 space-y-5">
            {job.description && (
              <Section title="About the role">
                <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">{job.description}</p>
              </Section>
            )}
            {job.responsibilities && (
              <Section title="Responsibilities">
                <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">{job.responsibilities}</p>
              </Section>
            )}
            {job.requirements && (
              <Section title="Requirements">
                <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">{job.requirements}</p>
              </Section>
            )}
            {job.niceToHaves && (
              <Section title="Nice to have">
                <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">{job.niceToHaves}</p>
              </Section>
            )}
          </div>

          {!showApply ? (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowApply(true)}
                className="px-8 py-3 bg-teal-600 text-white rounded-xl font-semibold shadow-lg hover:bg-teal-700"
              >
                Apply now
              </button>
              <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> AI-assisted screening · fair evaluation · POPIA compliant
              </p>
            </div>
          ) : (
            <ApplyForm
              jobSlug={slug}
              utm={s}
              referrerEmail={s.ref}
              onSubmit={(payload: any) => applyMut.mutate(payload)}
              pending={applyMut.isPending}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-800 mb-2">{title}</h2>
      {children}
    </div>
  );
}

function ApplyForm({ jobSlug, utm, referrerEmail, onSubmit, pending }: any) {
  const [f, setF] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    primaryTrade: "", yearsExperience: 0, qualifications: "",
    motivationLetter: "", linkedInUrl: "", resumeUrl: "",
    expectedSalary: "", availability: "", city: "", province: "",
    race: "", gender: "", disability: "",
    consent: false, marketing: false,
  });

  const canSubmit = f.firstName && f.lastName && f.email && f.phone && f.consent;

  return (
    <div className="mt-6 bg-white rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Apply for this role</h2>
      <div className="grid grid-cols-2 gap-3">
        <Input label="First name*" value={f.firstName} on={(v: string) => setF({ ...f, firstName: v })} />
        <Input label="Last name*" value={f.lastName} on={(v: string) => setF({ ...f, lastName: v })} />
        <Input label="Email*" value={f.email} on={(v: string) => setF({ ...f, email: v })} />
        <Input label="Phone*" value={f.phone} on={(v: string) => setF({ ...f, phone: v })} />
        <Input label="City" value={f.city} on={(v: string) => setF({ ...f, city: v })} />
        <Input label="Province" value={f.province} on={(v: string) => setF({ ...f, province: v })} />
        <Input label="Primary trade / skill" value={f.primaryTrade} on={(v: string) => setF({ ...f, primaryTrade: v })} />
        <Input label="Years of experience" type="number" value={String(f.yearsExperience)} on={(v: string) => setF({ ...f, yearsExperience: Number(v) || 0 })} />
        <Input label="Expected salary (R/month)" value={f.expectedSalary} on={(v: string) => setF({ ...f, expectedSalary: v })} />
        <Input label="Availability (e.g. Immediate)" value={f.availability} on={(v: string) => setF({ ...f, availability: v })} />
        <Input label="LinkedIn URL" value={f.linkedInUrl} on={(v: string) => setF({ ...f, linkedInUrl: v })} />
        <Input label="CV / Resume URL" value={f.resumeUrl} on={(v: string) => setF({ ...f, resumeUrl: v })} />
      </div>
      <div className="mt-3">
        <label className="text-xs text-gray-500">Qualifications / certifications</label>
        <textarea value={f.qualifications} onChange={(e) => setF({ ...f, qualifications: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
      </div>
      <div className="mt-3">
        <label className="text-xs text-gray-500">Motivation letter</label>
        <textarea value={f.motivationLetter} onChange={(e) => setF({ ...f, motivationLetter: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={4} placeholder="Why are you a great fit?" />
      </div>

      <details className="mt-4 border-t pt-4">
        <summary className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
          <Shield className="w-4 h-4" /> Voluntary equity & demographic information (POPIA)
        </summary>
        <p className="text-xs text-gray-500 mt-2">
          Voluntary. Used only for EEA reporting and adverse impact analysis. Not visible to hiring panel by default.
        </p>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <Select label="Race" value={f.race} on={(v: string) => setF({ ...f, race: v })} options={["", "BLACK_AFRICAN", "COLOURED", "INDIAN_ASIAN", "WHITE", "OTHER"]} />
          <Select label="Gender" value={f.gender} on={(v: string) => setF({ ...f, gender: v })} options={["", "FEMALE", "MALE", "OTHER"]} />
          <Select label="Disability" value={f.disability} on={(v: string) => setF({ ...f, disability: v })} options={["", "YES", "NO"]} />
        </div>
      </details>

      <div className="mt-5 space-y-2 text-sm">
        <label className="flex gap-2">
          <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
          <span className="text-gray-700">
            I consent to the processing of my personal information for recruitment purposes in line with POPIA. Data retained for up to 24 months.*
          </span>
        </label>
        <label className="flex gap-2">
          <input type="checkbox" checked={f.marketing} onChange={(e) => setF({ ...f, marketing: e.target.checked })} />
          <span className="text-gray-700">I'd like to hear about future opportunities (optional)</span>
        </label>
      </div>

      <button
        disabled={!canSubmit || pending}
        onClick={() => onSubmit({
          jobSlug,
          firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone,
          primaryTrade: f.primaryTrade || undefined,
          yearsExperience: f.yearsExperience || undefined,
          qualifications: f.qualifications || undefined,
          motivationLetter: f.motivationLetter || undefined,
          linkedInUrl: f.linkedInUrl || undefined,
          resumeUrl: f.resumeUrl || undefined,
          expectedSalary: f.expectedSalary || undefined,
          availability: f.availability || undefined,
          city: f.city || undefined, province: f.province || undefined,
          sourceChannel: referrerEmail ? "REFERRAL" : "CAREER_SITE",
          referrerEmail: referrerEmail || undefined,
          utm: {
            source: utm.utm_source, medium: utm.utm_medium, campaign: utm.utm_campaign,
            content: utm.utm_content, term: utm.utm_term,
          },
          landingUrl: typeof window !== "undefined" ? window.location.href : undefined,
          consent: {
            granted: true,
            version: "1.0",
            privacyPolicyVersion: "1.0",
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          },
          demographic: (f.race || f.gender || f.disability) ? {
            race: f.race || undefined, gender: f.gender || undefined, disability: f.disability || undefined,
          } : undefined,
        })}
        className="mt-5 w-full py-3 bg-teal-600 text-white rounded-lg font-semibold disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </div>
  );
}

function Input({ label, value, on, type = "text" }: any) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input type={type} value={value} onChange={(e) => on(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}

function Select({ label, value, on, options }: any) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <select value={value} onChange={(e) => on(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
        {options.map((o: string) => <option key={o} value={o}>{o || "Prefer not to say"}</option>)}
      </select>
    </div>
  );
}
