import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { CheckCircle2, Clock, Calendar, MessageSquare, Briefcase, XCircle, Loader2, Award, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/candidate/$token")({
  component: CandidatePortalPage,
});

const STAGE_LABELS: Record<string, string> = {
  APPLIED: "Application received",
  SCREENING: "Under review",
  ASSESSMENT: "Assessment stage",
  INTERVIEW: "Interview stage",
  OFFER: "Offer being prepared",
  BACKGROUND_CHECK: "Background check",
  HIRED: "Hired",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
};

function CandidatePortalPage() {
  const { token } = Route.useParams();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(trpc.candidateDashboard.queryOptions({ accessToken: token }));
  const msgMut = useMutation(
    trpc.candidateSendMessage.mutationOptions({
      onSuccess: () => {
        toast.success("Message sent");
        qc.invalidateQueries({ queryKey: trpc.candidateDashboard.queryKey({ accessToken: token }) });
      },
    }),
  );
  const wdMut = useMutation(
    trpc.candidateWithdraw.mutationOptions({
      onSuccess: () => {
        toast.success("Application withdrawn");
        qc.invalidateQueries({ queryKey: trpc.candidateDashboard.queryKey({ accessToken: token }) });
      },
    }),
  );
  const [msg, setMsg] = useState("");

  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>;
  }
  const d = q.data as any;
  if (!d) return <div className="min-h-screen flex items-center justify-center text-gray-500">Portal link invalid or expired.</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-teal-700 to-cyan-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold">Hi {d.firstName}</h1>
          <p className="text-teal-100 mt-1">
            Application for <span className="font-semibold">{d.job?.title ?? "role"}</span>
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Status card */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Current status</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              d.stageBucket === "HIRED" ? "bg-emerald-100 text-emerald-700" :
              d.stageBucket === "REJECTED" ? "bg-red-100 text-red-700" :
              "bg-blue-100 text-blue-700"
            }`}>{STAGE_LABELS[d.stageBucket] ?? d.stageBucket}</span>
          </div>
          {/* Timeline */}
          <div className="space-y-2">
            {(d.timeline ?? []).map((t: any) => (
              <div key={t.id} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-teal-500 mt-0.5" />
                <div>
                  <div className="font-medium">{STAGE_LABELS[t.bucket] ?? t.bucket}</div>
                  <div className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {d.timeline?.length === 0 && <div className="text-sm text-gray-400">No updates yet</div>}
          </div>
        </div>

        {/* AI behaviour interview */}
        <CandidateInterviewSection accessToken={token} />

        {/* Upcoming interviews */}
        {d.upcomingInterviews?.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Upcoming interviews</h2>
            <div className="space-y-2">
              {d.upcomingInterviews.map((b: any) => (
                <div key={b.id} className="border rounded-lg p-3 text-sm">
                  <div className="font-medium">{new Date(b.scheduledStart).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Status: {b.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offers */}
        {d.offers?.length > 0 && (
          <div className="bg-white rounded-xl border p-5 bg-gradient-to-br from-amber-50 to-white">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Award className="w-4 h-4 text-amber-600" /> Offers</h2>
            {d.offers.map((o: any) => (
              <div key={o.id} className="border rounded-lg p-4 bg-white">
                <div className="font-semibold">{o.title}</div>
                <div className="text-xs text-gray-500">Status: {o.status}</div>
                {o.signToken && ["SENT", "VIEWED"].includes(o.status) && (
                  <a href={`/offer/${o.signToken}`} className="mt-2 inline-block px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">
                    Review & sign offer
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Messages</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
            {(d.messages ?? []).map((m: any) => (
              <div key={m.id} className={`text-sm p-2 rounded-lg ${m.direction === "INBOUND" ? "bg-gray-100 ml-6" : "bg-teal-50 mr-6"}`}>
                <div className="text-xs text-gray-500 mb-0.5">{m.direction === "INBOUND" ? "You" : "Recruiter"} · {new Date(m.createdAt).toLocaleString()}</div>
                {m.subject && <div className="font-medium">{m.subject}</div>}
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
            {!d.messages?.length && <div className="text-sm text-gray-400">No messages yet</div>}
          </div>
          <div className="flex gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Send a message to the recruiter…" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <button
              disabled={!msg.trim() || msgMut.isPending}
              onClick={() => { msgMut.mutate({ accessToken: token, body: msg }); setMsg(""); }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm disabled:opacity-50"
            >Send</button>
          </div>
        </div>

        {d.stageBucket !== "HIRED" && d.stageBucket !== "WITHDRAWN" && d.stageBucket !== "REJECTED" && (
          <div className="text-center">
            <button
              onClick={() => {
                if (confirm("Withdraw your application?")) {
                  wdMut.mutate({ accessToken: token });
                }
              }}
              className="text-sm text-red-600 hover:underline"
            >
              Withdraw application
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateInterviewSection({ accessToken }: { accessToken: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(
    trpc.candidateGetInterviewQuestions.queryOptions({ accessToken }, { retry: false }),
  );
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, { score: number; analysis: string }>>({});
  const submitMut = useMutation(
    trpc.candidateSubmitInterviewAnswer.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Answer submitted — AI score ${res.score.toFixed(1)}/10`);
        setFeedback((prev) => ({
          ...prev,
          [res.questionIndex]: { score: res.score, analysis: res.analysis },
        }));
        qc.invalidateQueries({
          queryKey: trpc.candidateGetInterviewQuestions.queryKey({ accessToken }),
        });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (q.isLoading || !q.data) return null;
  const d = q.data;
  if (!d.required) return null;

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-teal-600" /> AI behaviour interview
        </h2>
        <span className="text-xs text-gray-500">
          {d.answeredCount}/{d.total} answered
        </span>
      </div>

      {d.complete ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          You've completed all behaviour questions. Thank you — our team is reviewing your responses.
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-600 mb-3">
            Answer each question in your own words (at least 20 characters). Your answers are scored
            by AI to help our hiring team understand your approach. You can only answer each
            question once.
          </p>
          <div className="space-y-4">
            {d.questions.map((qn) => {
              const fb = feedback[qn.index];
              return (
                <div key={qn.index} className="border rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-800 mb-1">
                    Q{qn.index + 1}. {qn.question}
                  </div>
                  <div className="text-[11px] text-gray-400 mb-2 uppercase tracking-wide">
                    Dimension: {qn.dimension}
                  </div>
                  {qn.answered ? (
                    <div className="text-sm text-emerald-700 bg-emerald-50 rounded p-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Answer submitted
                      {fb && (
                        <span className="ml-auto text-xs">AI {fb.score.toFixed(1)}/10</span>
                      )}
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={answers[qn.index] ?? ""}
                        onChange={(e) =>
                          setAnswers((p) => ({ ...p, [qn.index]: e.target.value }))
                        }
                        rows={4}
                        placeholder="Type your answer here..."
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        disabled={submitMut.isPending}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-gray-400">
                          {(answers[qn.index] ?? "").trim().length} chars (min 20)
                        </span>
                        <button
                          disabled={
                            submitMut.isPending ||
                            (answers[qn.index] ?? "").trim().length < 20
                          }
                          onClick={() =>
                            submitMut.mutate({
                              accessToken,
                              questionIndex: qn.index,
                              answer: answers[qn.index] ?? "",
                            })
                          }
                          className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs font-medium disabled:opacity-50"
                        >
                          {submitMut.isPending ? "Submitting..." : "Submit answer"}
                        </button>
                      </div>
                      {fb && (
                        <div className="mt-2 text-xs text-gray-600 italic">
                          <span className="font-semibold not-italic text-gray-700">
                            AI feedback:
                          </span>{" "}
                          {fb.analysis}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
