import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, ClipboardList, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/recruitment/jobs/$jobId/setup")({
  component: JobSetupPage,
});

function JobSetupPage() {
  const { jobId: rawId } = useParams({ from: "/admin/recruitment/jobs/$jobId/setup" });
  const jobId = Number(rawId);
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const [tab, setTab] = useState<"work" | "interview">("work");

  if (!token || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/admin/recruitment/jobs/$jobId"
          params={{ jobId: String(jobId) }}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to job
        </Link>
        <h1 className="text-2xl font-bold mb-4">Recruitment setup — Job #{jobId}</h1>

        <div className="flex gap-1 border-b mb-4">
          {(["work", "interview"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                tab === k ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {k === "work" ? "Work-sample tasks" : "Interview question bank"}
            </button>
          ))}
        </div>

        {tab === "work" ? (
          <WorkSampleEditor token={token} jobId={jobId} />
        ) : (
          <InterviewBankEditor token={token} jobId={jobId} />
        )}
      </div>
    </div>
  );
}

function WorkSampleEditor({ token, jobId }: { token: string; jobId: number }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.listWorkSampleTasks.queryOptions({ token, jobId }));
  const sourcesQ = useQuery(trpc.listJobsWithWorkSamples.queryOptions({ token }));
  const createMut = useMutation(
    trpc.createWorkSampleTask.mutationOptions({
      onSuccess: () => { toast.success("Task created"); q.refetch(); reset(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const deleteMut = useMutation(
    trpc.deleteWorkSampleTask.mutationOptions({
      onSuccess: () => { toast.success("Deleted"); q.refetch(); },
    }),
  );
  const copyMut = useMutation(
    trpc.copyWorkSamplesFromJob.mutationOptions({
      onSuccess: (r: any) => { toast.success(`Copied ${r.copied} task(s)`); q.refetch(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const [copyFromJobId, setCopyFromJobId] = useState<number | "">("");

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [timeMin, setTimeMin] = useState(60);
  const [passing, setPassing] = useState(60);
  const [dims, setDims] = useState([
    { code: "TECHNICAL", label: "Technical accuracy", weight: 2 },
    { code: "STRUCTURE", label: "Structure & clarity", weight: 1.5 },
    { code: "COMMUNICATION", label: "Written communication", weight: 1.5 },
    { code: "COMMERCIAL", label: "Commercial awareness", weight: 1 },
  ]);

  const reset = () => {
    setTitle("");
    setInstructions("");
    setTimeMin(60);
    setPassing(60);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4 text-teal-600" /> Existing tasks
        </h3>
        {q.isLoading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="text-sm text-gray-400">No work-sample tasks defined yet.</div>
        ) : (
          <div className="space-y-2">
            {(q.data as any[]).map((t) => (
              <div key={t.id} className="border rounded-lg p-3 flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t.timeLimitMinutes}min · pass ≥ {t.passingScore} · {t.active ? "active" : "inactive"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${t.title}"?`))
                      deleteMut.mutate({ token, taskId: t.id });
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-3 border-t flex items-center gap-2">
          <span className="text-xs text-gray-500">Copy from another job:</span>
          <select
            value={copyFromJobId}
            onChange={(e) => setCopyFromJobId(e.target.value ? Number(e.target.value) : "")}
            className="text-xs px-2 py-1 border rounded"
          >
            <option value="">Select job…</option>
            {(sourcesQ.data as any[] ?? []).filter((j) => j.id !== jobId).map((j) => (
              <option key={j.id} value={j.id}>{j.title} ({j._count.workSampleTasks} tasks)</option>
            ))}
          </select>
          <button
            onClick={() => copyFromJobId && copyMut.mutate({ token, toJobId: jobId, fromJobId: copyFromJobId })}
            disabled={!copyFromJobId || copyMut.isPending}
            className="text-xs px-3 py-1 bg-teal-600 text-white rounded disabled:opacity-40"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-teal-600" /> Create new task
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Data-capture + customer email"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Instructions (candidate sees this)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Time limit (minutes)</label>
              <input
                type="number"
                value={timeMin}
                onChange={(e) => setTimeMin(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Passing score</label>
              <input
                type="number"
                value={passing}
                onChange={(e) => setPassing(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Rubric dimensions</label>
            <div className="space-y-2">
              {dims.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={d.label}
                    onChange={(e) => {
                      const c = [...dims];
                      c[i] = { ...c[i], label: e.target.value } as any;
                      setDims(c);
                    }}
                    className="flex-1 border rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={d.weight}
                    onChange={(e) => {
                      const c = [...dims];
                      c[i] = { ...c[i], weight: Number(e.target.value) } as any;
                      setDims(c);
                    }}
                    className="w-20 border rounded px-2 py-1 text-sm"
                    placeholder="weight"
                  />
                </div>
              ))}
            </div>
          </div>
          <button
            disabled={createMut.isPending || title.length < 3 || instructions.length < 20}
            onClick={() =>
              createMut.mutate({
                token,
                jobId,
                title,
                instructions,
                timeLimitMinutes: timeMin,
                passingScore: passing,
                rubric: { scale: 5, dimensions: dims },
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Create task
          </button>
        </div>
      </div>
    </div>
  );
}

function InterviewBankEditor({ token, jobId }: { token: string; jobId: number }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.getInterviewQuestionBank.queryOptions({ token, jobId }));
  const sourcesQ = useQuery(trpc.listJobsWithInterviewBank.queryOptions({ token }));
  const saveMut = useMutation(
    trpc.upsertInterviewQuestionBank.mutationOptions({
      onSuccess: () => { toast.success("Bank saved"); q.refetch(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const copyMut = useMutation(
    trpc.copyInterviewBankFromJob.mutationOptions({
      onSuccess: (r: any) => { toast.success(`${r.mode} · ${r.copied} question(s)`); q.refetch(); setQuestions([]); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const aiMut = useMutation(
    trpc.aiSuggestInterviewQuestions.mutationOptions({
      onSuccess: (r: any) => {
        const drafts = (r.suggestions ?? []).map((s: any, i: number) => ({
          order: questions.length + i + 1,
          competency: s.competency ?? "",
          question: s.question ?? "",
          weight: Number(s.weight) || 1,
          requireEvidence: true,
          rubric: s.rubric ?? {},
        }));
        setQuestions([...questions, ...drafts]);
        toast.success(`Added ${drafts.length} AI-drafted questions — review before saving`);
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const [copyFromJobId, setCopyFromJobId] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const bank = q.data as any;
  const [questions, setQuestions] = useState<Array<{ order: number; competency: string; question: string; weight: number; requireEvidence: boolean; rubric: Record<string, string> }>>([]);

  // Sync loaded bank into local state.
  useState(() => {
    if (bank?.questions?.length && questions.length === 0) {
      setDescription(bank.description || "");
      setQuestions(
        bank.questions.map((q: any) => ({
          order: q.order,
          competency: q.competency,
          question: q.question,
          weight: q.weight,
          requireEvidence: q.requireEvidence,
          rubric: q.rubric || {},
        })),
      );
    }
    return null;
  });

  const addQ = () => {
    setQuestions([...questions, {
      order: questions.length + 1,
      competency: "",
      question: "",
      weight: 1,
      requireEvidence: true,
      rubric: {
        "1": "Vague, generic or fabricated.",
        "2": "Superficial, limited depth.",
        "3": "Solid concrete example.",
        "4": "Strong, specific, credible.",
        "5": "Exemplary, nuanced.",
      },
    }]);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-teal-600" /> Interview questions
        </h3>
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Copy from another job:</span>
          <select
            value={copyFromJobId}
            onChange={(e) => setCopyFromJobId(e.target.value ? Number(e.target.value) : "")}
            className="text-xs px-2 py-1 border rounded"
          >
            <option value="">Select job…</option>
            {(sourcesQ.data as any[] ?? []).filter((j) => j.id !== jobId).map((j) => (
              <option key={j.id} value={j.id}>{j.title} ({j.interviewQuestionBank?._count?.questions ?? 0} qs)</option>
            ))}
          </select>
          <button
            onClick={() => copyFromJobId && copyMut.mutate({ token, toJobId: jobId, fromJobId: copyFromJobId })}
            disabled={!copyFromJobId || copyMut.isPending}
            className="text-xs px-3 py-1 bg-teal-600 text-white rounded disabled:opacity-40"
          >
            Copy bank
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => aiMut.mutate({ token, jobId })}
            disabled={aiMut.isPending}
            className="text-xs px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded disabled:opacity-40"
          >
            {aiMut.isPending ? "AI thinking…" : "✨ AI-suggest 5 questions"}
          </button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-semibold mb-1">Description (internal)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {questions.length === 0 && bank?.questions?.length > 0 && (
          <button
            onClick={() =>
              setQuestions(
                (bank.questions as any[]).map((q) => ({
                  order: q.order,
                  competency: q.competency,
                  question: q.question,
                  weight: q.weight,
                  requireEvidence: q.requireEvidence,
                  rubric: q.rubric || {},
                })),
              )
            }
            className="text-xs px-3 py-1.5 mb-3 rounded bg-gray-100 hover:bg-gray-200"
          >
            Load current bank
          </button>
        )}
        <div className="space-y-3">
          {questions.map((qn, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Q{i + 1}</span>
                <input
                  value={qn.competency}
                  onChange={(e) => {
                    const c = [...questions];
                    c[i] = { ...c[i]!, competency: e.target.value };
                    setQuestions(c);
                  }}
                  placeholder="Competency (e.g. Integrity)"
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  step="0.5"
                  value={qn.weight}
                  onChange={(e) => {
                    const c = [...questions];
                    c[i] = { ...c[i]!, weight: Number(e.target.value) };
                    setQuestions(c);
                  }}
                  className="w-20 border rounded px-2 py-1 text-sm"
                  placeholder="weight"
                />
                <button
                  onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={qn.question}
                onChange={(e) => {
                  const c = [...questions];
                  c[i] = { ...c[i]!, question: e.target.value };
                  setQuestions(c);
                }}
                rows={2}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Question text"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={addQ}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm"
          >
            <Plus className="w-4 h-4" /> Add question
          </button>
          <button
            disabled={saveMut.isPending || questions.length === 0}
            onClick={() =>
              saveMut.mutate({
                token,
                jobId,
                description,
                questions,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save bank
          </button>
        </div>
      </div>
    </div>
  );
}
