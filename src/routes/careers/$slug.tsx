import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useRef, useState } from "react";
import { ArrowLeft, MapPin, Briefcase, Building2, CheckCircle2, Sparkles, Shield, Loader2, Upload, FileText, X } from "lucide-react";
import toast from "react-hot-toast";
import { z } from "zod";
import { uploadToPresignedUrl } from "~/utils/uploadWithRetry";

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
  const jobQ = useQuery({
    ...trpc.getPublicJob.queryOptions({ slug }),
    // Keep the public job posting in near-real-time sync with admin edits.
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });
  const [showApply, setShowApply] = useState(false);
  const [submitted, setSubmitted] = useState<{ portalUrl: string } | null>(null);
  const [autoRejected, setAutoRejected] = useState(false);

  const applyMut = useMutation(
    trpc.createApplication.mutationOptions({
      onSuccess: (res: any) => {
        if (res?.autoRejected) {
          setAutoRejected(true);
          return;
        }
        setSubmitted({ portalUrl: res?.portalUrl ?? `/candidate/${res?.accessToken}` });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const job = jobQ.data;

  if (autoRejected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center text-3xl">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Thank you for your interest</h1>
          <p className="text-sm text-gray-600">
            Unfortunately your responses did not meet the minimum requirements for this specific role. Your details will be retained and considered for future opportunities that better match your profile.
          </p>
        </div>
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Application received</h1>
          <p className="text-sm text-gray-600 mb-5">Thank you for applying. You can use your candidate portal to follow your application.</p>
          <a href={submitted.portalUrl} className="inline-flex rounded-lg bg-teal-600 px-5 py-3 font-semibold text-white hover:bg-teal-700">Open candidate portal</a>
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
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-left">
                <div className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                  ⚠️ Before you apply — how Square 15 pays
                </div>
                <p className="text-xs text-amber-900 mb-2">
                  All roles at Square 15 Facility Solutions are engaged as
                  <b> Independent Contractors</b>. We do <b>not</b> pay monthly salaries.
                </p>
                <ul className="text-xs text-amber-900 space-y-1.5 list-disc list-inside">
                  <li>
                    <b>Commercial Division artisans</b> (Plumbing, Electrical, Carpentry, Painting, etc.):
                    paid on a <b>daily rate</b>, an <b>hourly rate</b>, or <b>both</b> —
                    the model varies per client and per job.
                  </li>
                  <li>
                    <b>Maintenance App artisans</b>: paid <b>per job</b>. The amount is
                    displayed on the Square 15 Maintenance App <b>before you accept</b> —
                    no surprises.
                  </li>
                  <li>
                    <b>Sales Agents</b>: paid on <b>commission per job</b> generated —
                    no basic salary.
                  </li>
                </ul>
                <p className="text-[11px] text-amber-800 mt-2 italic">
                  By continuing you confirm you understand this pay structure.
                </p>
              </div>
              <div className="text-center">
                <button
                  onClick={() => setShowApply(true)}
                  className="px-8 py-3 bg-teal-600 text-white rounded-xl font-semibold shadow-lg hover:bg-teal-700"
                >
                  I understand — Apply now
                </button>
                <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> AI-assisted screening · fair evaluation · POPIA compliant
                </p>
              </div>
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
  type PublicScreeningQuestion = { id: number; questionText: string; questionType: "YES_NO" | "NUMBER" | "SELECT"; required: boolean; options: string[] };
  const screeningQuery = useQuery<PublicScreeningQuestion[]>({
    queryKey: ["getPublicScreeningQuestions", jobSlug],
    queryFn: async () => {
      const response = await fetch("/trpc/getPublicScreeningQuestions?input=" + encodeURIComponent(JSON.stringify({ json: { jobSlug } })));
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.json?.message || "Could not load minimum requirements");
      return result.result?.data?.json ?? [];
    },
    staleTime: 60_000,
  });
  const screeningQuestions = screeningQuery.data ?? [];
  const [screeningAnswers, setScreeningAnswers] = useState<{ questionId: number; answerText?: string | null; answerNumber?: number | null }[]>([]);
  const [f, setF] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    primaryTrade: "", yearsExperience: 0, qualifications: "",
    motivationLetter: "", linkedInUrl: "",
    expectedSalary: "", availability: "", city: "", province: "",
    race: "", gender: "", disability: "",
    consent: false, marketing: false,
  });
  // Uploaded documents
  const [cv, setCv] = useState<UploadedFile | null>(null);
  const [certs, setCerts] = useState<UploadedFile[]>([]);
  const [portfolio, setPortfolio] = useState<UploadedFile[]>([]);

  const hasAllRequiredScreeningAnswers = screeningQuestions.every((question) => {
    if (!question.required) return true;
    const answer = screeningAnswers.find((candidate) => candidate.questionId === question.id);
    if (!answer) return false;
    if (question.questionType === "NUMBER") return answer.answerNumber !== null && answer.answerNumber !== undefined && Number.isFinite(answer.answerNumber);
    return typeof answer.answerText === "string" && answer.answerText.trim().length > 0;
  });
  const canSubmit = f.firstName && f.lastName && f.email && f.phone && f.consent && !screeningQuery.isLoading && !screeningQuery.isError && hasAllRequiredScreeningAnswers;

  return (
    <div className="mt-6 bg-white rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Apply for this role</h2>
      {screeningQuery.isError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">We could not load this role’s minimum screening questions. Please refresh the page before submitting.</p>}
      {screeningQuestions.length > 0 && <section aria-label="Minimum requirement screening questions" className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-blue-900">Minimum requirements</h3>
        <p className="mb-3 text-xs text-blue-800">Please answer each required question honestly. Some answers may mean this role is not the right match.</p>
        <div className="space-y-3">{screeningQuestions.map((question) => {
          const answer = screeningAnswers.find((candidate) => candidate.questionId === question.id);
          const putAnswer = (patch: { answerText?: string | null; answerNumber?: number | null }) => setScreeningAnswers((current) => {
            const existing = current.findIndex((candidate) => candidate.questionId === question.id);
            const nextAnswer = { questionId: question.id, ...(existing >= 0 ? current[existing] : {}), ...patch };
            return existing >= 0 ? current.map((candidate, index) => index === existing ? nextAnswer : candidate) : [...current, nextAnswer];
          });
          return <div key={question.id} className="rounded bg-white p-3">
            <label className="mb-2 block text-sm font-medium text-gray-900">{question.questionText}{question.required && <span className="ml-1 text-red-500">*</span>}</label>
            {question.questionType === "YES_NO" && <div className="flex gap-4">{["YES", "NO"].map((value) => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name={`screening-${question.id}`} value={value} checked={answer?.answerText === value} onChange={() => putAnswer({ answerText: value, answerNumber: null })} />{value === "YES" ? "Yes" : "No"}</label>)}</div>}
            {question.questionType === "NUMBER" && <input type="number" min="0" className="w-full rounded border px-3 py-2 text-sm" value={answer?.answerNumber ?? ""} onChange={(event) => putAnswer({ answerNumber: event.target.value === "" ? null : Number(event.target.value), answerText: null })} />}
            {question.questionType === "SELECT" && <select className="w-full rounded border px-3 py-2 text-sm" value={answer?.answerText ?? ""} onChange={(event) => putAnswer({ answerText: event.target.value, answerNumber: null })}><option value="">Select an option…</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
          </div>;
        })}</div>
      </section>}
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
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <PublicUploadDropzone
          jobSlug={jobSlug}
          multiple={false}
          title="CV / Resume"
          hint="PDF, Word or image. Max 10 MB."
          files={cv ? [cv] : []}
          onChange={(files) => setCv(files[0] ?? null)}
        />
        <PublicUploadDropzone
          jobSlug={jobSlug}
          multiple={true}
          title="Qualifications / certificates"
          hint="Trade certificates, ID copy, references, etc. Multiple files allowed."
          files={certs}
          onChange={setCerts}
        />
        <PublicUploadDropzone
          jobSlug={jobSlug}
          multiple={true}
          title="Portfolio of your best work"
          hint="Photos or PDFs of completed projects — showcase your best work. Multiple files allowed."
          files={portfolio}
          onChange={setPortfolio}
        />
      </div>

      <div className="mt-3">
        <label className="text-xs text-gray-500">Qualifications / certifications (summary)</label>
        <textarea value={f.qualifications} onChange={(e) => setF({ ...f, qualifications: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Optional: list trades, certificates, licenses" />
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
          resumeUrl: cv?.fileUrl || undefined,
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
          attachments: [
            ...(cv ? [{ label: "CV / Resume", fileName: cv.fileName, fileUrl: cv.fileUrl, fileType: cv.fileType }] : []),
            ...certs.map((c) => ({ label: "Qualification", fileName: c.fileName, fileUrl: c.fileUrl, fileType: c.fileType })),
            ...portfolio.map((p) => ({ label: "Portfolio", fileName: p.fileName, fileUrl: p.fileUrl, fileType: p.fileType })),
          ],
          portfolioUrls: portfolio.map((p) => p.fileUrl),
          screeningAnswers,
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

// ─────────────────────────────────────────────────────────────────
// Public (anonymous) upload dropzone used by the "Apply for this role"
// form. Uploads go straight to MinIO via a short-lived presigned URL
// tied to the specific job slug.
// ─────────────────────────────────────────────────────────────────

type UploadedFile = { fileName: string; fileUrl: string; fileType?: string };

const ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function PublicUploadDropzone({
  jobSlug, multiple, title, hint, files, onChange,
}: {
  jobSlug: string;
  multiple: boolean;
  title: string;
  hint: string;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) {
  const trpc = useTRPC();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const presignMut = useMutation(trpc.getPresignedUploadUrlForApplication.mutationOptions());

  const handlePick = () => inputRef.current?.click();

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    // Reset the native input so re-picking the same file works.
    if (inputRef.current) inputRef.current.value = "";

    // Validate up-front.
    for (const file of picked) {
      if (!ACCEPTED_MIME.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: file exceeds 10 MB`);
        return;
      }
    }

    setUploading(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of picked) {
        const { presignedUrl, fileUrl } = await presignMut.mutateAsync({
          jobSlug,
          fileName: file.name,
          fileType: file.type,
        });
        await uploadToPresignedUrl(presignedUrl, file, {
          onRetry: (attempt, max) => {
            toast.loading(`Retrying ${file.name} (${attempt}/${max - 1})…`, {
              id: `retry-${file.name}`,
              duration: 2000,
            });
          },
        });
        toast.dismiss(`retry-${file.name}`);
        uploaded.push({ fileName: file.name, fileUrl, fileType: file.type });
      }
      onChange(multiple ? [...files, ...uploaded] : uploaded.slice(-1));
      toast.success(`${uploaded.length} file(s) uploaded`);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="text-xs text-gray-500">{title}</label>
      <div
        onClick={handlePick}
        className={`mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-6 px-4 cursor-pointer transition-colors ${
          uploading ? "border-gray-300 bg-gray-50 cursor-wait" : "border-gray-300 hover:border-teal-400 bg-gray-50 hover:bg-teal-50"
        }`}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin mb-2" />
        ) : (
          <Upload className="w-6 h-6 text-gray-400 mb-2" />
        )}
        <p className="text-sm text-gray-600">
          <span className="font-medium text-teal-700">Click to upload</span>{multiple ? " (multiple)" : ""}
        </p>
        <p className="text-xs text-gray-400 mt-1">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME.join(",")}
          multiple={multiple}
          className="hidden"
          onChange={handleFiles}
          disabled={uploading}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((file, idx) => (
            <li
              key={`${file.fileUrl}-${idx}`}
              className="flex items-center justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5"
            >
              <span className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="truncate text-gray-800">{file.fileName}</span>
              </span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="text-gray-400 hover:text-red-600 ml-2"
                aria-label={`Remove ${file.fileName}`}
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScreeningStep({
  jobSlug,
  answers,
  setAnswers,
}: {
  jobSlug: string;
  answers: { questionId: number; answerText?: string | null; answerNumber?: number | null }[];
  setAnswers: (a: { questionId: number; answerText?: string | null; answerNumber?: number | null }[]) => void;
}) {
  const trpc = useTRPC();
  const q = useQuery(trpc.getPublicScreeningQuestions.queryOptions({ jobSlug }));
  const items = (q.data ?? []) as any[];
  if (items.length === 0) return null;

  const setAnswer = (questionId: number, patch: { answerText?: string | null; answerNumber?: number | null }) => {
    const idx = answers.findIndex((a) => a.questionId === questionId);
    const merged = { questionId, ...(idx >= 0 ? answers[idx] : {}), ...patch };
    const next = idx >= 0 ? answers.map((a, i) => (i === idx ? merged : a)) : [...answers, merged];
    setAnswers(next);
  };

  const valueFor = (questionId: number) => answers.find((a) => a.questionId === questionId);

  return (
    <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="text-sm font-semibold text-blue-900 mb-2">Minimum requirements</div>
      <div className="text-xs text-blue-800 mb-3">
        Please answer honestly — candidates that do not meet these requirements will not be able to proceed.
      </div>
      <div className="space-y-3">
        {items.map((qq: any) => {
          const v = valueFor(qq.id);
          return (
            <div key={qq.id} className="bg-white rounded p-3">
              <div className="text-sm font-medium text-gray-900 mb-2">
                {qq.questionText}
                {qq.required && <span className="text-red-500 ml-1">*</span>}
              </div>
              {qq.questionType === "YES_NO" && (
                <div className="flex gap-4">
                  {["YES", "NO"].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`q-${qq.id}`}
                        checked={v?.answerText === opt}
                        onChange={() => setAnswer(qq.id, { answerText: opt, answerNumber: null })}
                      />
                      {opt === "YES" ? "Yes" : "No"}
                    </label>
                  ))}
                </div>
              )}
              {qq.questionType === "NUMBER" && (
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={v?.answerNumber ?? ""}
                  onChange={(e) => setAnswer(qq.id, { answerNumber: e.target.value === "" ? null : Number(e.target.value), answerText: null })}
                  placeholder="Enter a number"
                />
              )}
              {qq.questionType === "SELECT" && (
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={v?.answerText ?? ""}
                  onChange={(e) => setAnswer(qq.id, { answerText: e.target.value, answerNumber: null })}
                >
                  <option value="">Select an option…</option>
                  {qq.options.map((o: string) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

