import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useEffect, useCallback } from "react";
import {
  Brain, Heart, User, BarChart3, MessageSquare,
  ChevronLeft, ChevronRight, Loader2, CheckCircle2,
  Clock, ArrowLeft, Send, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/apply/assessments/$token/$type")({
  component: AssessmentPage,
});

const TYPE_META: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  IQ: { icon: Brain, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  EQ: { icon: Heart, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  MBTI: { icon: User, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  BIG_FIVE: { icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  INTERVIEW: { icon: MessageSquare, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" },
};

function AssessmentPage() {
  const { token, type } = useParams({ from: "/apply/assessments/$token/$type" });
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const questionsQuery = useQuery(
    trpc.getAssessmentQuestions.queryOptions(
      { token, type: type as any },
      { enabled: !!token && !!type, retry: false }
    )
  );

  const appQuery = useQuery(
    trpc.getApplicationByToken.queryOptions({ token }, { enabled: !!token })
  );

  const submitAssessment = useMutation(
    trpc.submitAssessment.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: trpc.getApplicationByToken.queryKey({ token }) });
        setResult(data);
        setPhase("results");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const submitInterview = useMutation(
    trpc.submitInterviewAnswer.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: trpc.getApplicationByToken.queryKey({ token }) });
        setInterviewFeedback((prev) => ({ ...prev, [data.questionIndex]: data }));
        if (data.questionsRemaining <= 0) {
          setPhase("interview-complete");
        }
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const [phase, setPhase] = useState<"test" | "results" | "interview-complete">("test");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [interviewAnswers, setInterviewAnswers] = useState<Record<number, string>>({});
  const [interviewFeedback, setInterviewFeedback] = useState<Record<number, any>>({});
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [started, setStarted] = useState(false);

  const data = questionsQuery.data;
  const questions = data?.questions ?? [];
  const totalQ = questions.length;

  // Timer
  useEffect(() => {
    if (!started || !data?.timeLimit || type === "INTERVIEW") return;
    setTimeLeft(data.timeLimit * 60);
  }, [started, data?.timeLimit, type]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  // Auto-submit on time up
  useEffect(() => {
    if (timeLeft === 0 && type !== "INTERVIEW" && phase === "test") {
      handleSubmitTest();
    }
  }, [timeLeft]);

  const handleSubmitTest = useCallback(() => {
    if (type === "INTERVIEW") return;
    submitAssessment.mutate({
      token,
      type: type as any,
      responses: answers,
    });
  }, [token, type, answers]);

  const meta = (TYPE_META[type] || TYPE_META.IQ)!;
  const Icon = meta.icon;

  const answeredCount = type === "INTERVIEW"
    ? Object.keys(interviewFeedback).length + (appQuery.data?.completedInterviewQuestions?.length ?? 0)
    : Object.keys(answers).length;

  // Loading
  if (questionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (questionsQuery.isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Cannot Load Assessment</h1>
          <p className="mt-2 text-sm text-gray-600">{(questionsQuery.error as any)?.message || "This assessment may already be completed."}</p>
          <button onClick={() => navigate({ to: "/apply/assessments/$token", params: { token } })}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700">
            <ArrowLeft className="w-4 h-4" /> Back to Hub
          </button>
        </div>
      </div>
    );
  }

  // ─── Results Screen ───
  if (phase === "results" && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl shadow-md p-8 text-center">
          <div className={`w-16 h-16 mx-auto rounded-full ${meta.bg} flex items-center justify-center`}>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{data?.title} Complete!</h1>
          <div className="mt-4 text-5xl font-bold text-gray-900">{Math.round(result.score)}%</div>
          <p className="text-sm text-gray-500 mt-1">Score</p>

          {result.results?.classification && (
            <span className="mt-3 inline-block px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm font-medium">
              {result.results.classification}
            </span>
          )}
          {result.results?.mbtiType && (
            <div className="mt-3">
              <span className="inline-block px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-lg font-bold">
                {result.results.mbtiType}
              </span>
              {result.results.description && (
                <p className="mt-2 text-sm text-gray-600">{result.results.description}</p>
              )}
            </div>
          )}
          {result.results?.factors && type === "BIG_FIVE" && (
            <div className="mt-4 text-left">
              {Object.entries(result.results.factors as Record<string, { score: number; label: string }>).map(([key, f]) => (
                <div key={key} className="flex items-center gap-3 py-1">
                  <span className="text-xs font-medium text-gray-500 w-32">{f.label}</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${f.score}%` }} />
                  </div>
                  <span className="text-xs font-semibold w-10 text-right">{Math.round(f.score)}%</span>
                </div>
              ))}
            </div>
          )}

          {result.assessmentsRemaining > 0 ? (
            <p className="mt-4 text-sm text-gray-500">{result.assessmentsRemaining} assessment(s) remaining</p>
          ) : (
            <p className="mt-4 text-sm text-green-600 font-medium">All assessments complete! AI Interview unlocked.</p>
          )}

          <button onClick={() => navigate({ to: "/apply/assessments/$token", params: { token } })}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Hub
          </button>
        </div>
      </div>
    );
  }

  // ─── Interview Complete ───
  if (phase === "interview-complete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl shadow-md p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Interview Complete!</h1>
          <p className="mt-2 text-gray-600">All assessments and the interview have been submitted. Our AI is now scoring your application.</p>
          <p className="mt-1 text-sm text-gray-500">You'll be contacted via email with next steps.</p>
          <button onClick={() => navigate({ to: "/apply/assessments/$token", params: { token } })}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Hub
          </button>
        </div>
      </div>
    );
  }

  // ─── Pre-start Screen ───
  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl shadow-md p-8">
          <div className={`w-14 h-14 rounded-xl ${meta.bg} flex items-center justify-center mx-auto`}>
            <Icon className={`w-7 h-7 ${meta.color}`} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900 text-center">{data?.title}</h1>
          <p className="mt-2 text-sm text-gray-600 text-center">{data?.description}</p>

          <div className="mt-6 bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
            <div className="flex justify-between"><span>Questions:</span><span className="font-semibold">{totalQ}</span></div>
            <div className="flex justify-between"><span>Time Limit:</span><span className="font-semibold">{data?.timeLimit} minutes</span></div>
            {type !== "INTERVIEW" && (
              <div className="flex justify-between"><span>Type:</span><span className="font-semibold">
                {type === "IQ" ? "Multiple Choice" : type === "EQ" ? "Scenario-Based" : type === "MBTI" ? "Forced Choice (A/B)" : "Likert Scale"}
              </span></div>
            )}
          </div>

          {type !== "INTERVIEW" && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              <strong>Note:</strong> Once started, a timer begins. Answers auto-submit when time runs out.
              You cannot redo this assessment.
            </div>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button onClick={() => navigate({ to: "/apply/assessments/$token", params: { token } })}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors text-center">
              Cancel
            </button>
            <button onClick={() => setStarted(true)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors text-center">
              {type === "INTERVIEW" ? "Begin Interview" : "Start Assessment"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── INTERVIEW UI ───
  if (type === "INTERVIEW") {
    const completedQs = appQuery.data?.completedInterviewQuestions ?? [];
    const nextUnanswered = questions.findIndex(
      (q: any) => !completedQs.includes(q.index) && !interviewFeedback[q.index]
    );
    const activeIdx = nextUnanswered >= 0 ? nextUnanswered : 0;
    const activeQ = questions[activeIdx] as any;
    const isAnswered = completedQs.includes(activeQ?.index) || !!interviewFeedback[activeQ?.index];
    const feedback = interviewFeedback[activeQ?.index];
    const allDone = questions.every((q: any) => completedQs.includes(q.index) || interviewFeedback[q.index]);

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${meta.color}`} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">AI Behavioural Interview</h2>
                <p className="text-xs text-gray-500">
                  {Object.keys(interviewFeedback).length + completedQs.length}/{totalQ} answered
                </p>
              </div>
            </div>
          </div>

          {/* Question navigation */}
          <div className="flex gap-2 mb-4">
            {questions.map((q: any, i: number) => {
              const done = completedQs.includes(q.index) || !!interviewFeedback[q.index];
              return (
                <button key={i} onClick={() => setCurrentQ(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                    done ? "bg-green-100 text-green-700 border border-green-300"
                      : i === activeIdx ? "bg-teal-600 text-white"
                      : "bg-gray-100 text-gray-500 border border-gray-200"
                  }`}>
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Active question */}
          {activeQ && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded-full">
                {activeQ.dimension}
              </span>
              <p className="mt-3 text-gray-900 font-medium leading-relaxed">{activeQ.question}</p>

              {isAnswered && feedback ? (
                <div className="mt-4 space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-green-800">AI Score</span>
                      <span className="text-lg font-bold text-green-700">{feedback.score}/10</span>
                    </div>
                    <p className="text-sm text-green-700">{feedback.feedback}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <textarea
                    value={interviewAnswers[activeQ.index] ?? ""}
                    onChange={(e) => setInterviewAnswers((p) => ({ ...p, [activeQ.index]: e.target.value }))}
                    rows={6}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500"
                    placeholder="Take your time — provide a detailed, thoughtful response. Minimum 20 characters."
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => {
                        const answer = interviewAnswers[activeQ.index] ?? "";
                        if (answer.length < 20) { toast.error("Please provide a more detailed answer (at least 20 characters)"); return; }
                        submitInterview.mutate({ token, questionIndex: activeQ.index, answer });
                      }}
                      disabled={submitInterview.isPending}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                    >
                      {submitInterview.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Scoring...</> : <><Send className="w-4 h-4" /> Submit Answer</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {allDone && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-green-800">All interview questions answered!</p>
              <button onClick={() => navigate({ to: "/apply/assessments/$token", params: { token } })}
                className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Hub
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── STANDARD ASSESSMENT UI (IQ, EQ, MBTI, BIG_FIVE) ───
  const q: any = questions[currentQ];
  if (!q) return null;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{data?.title}</h2>
              <p className="text-xs text-gray-500">Question {currentQ + 1} of {totalQ}</p>
            </div>
          </div>
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold ${
              timeLeft < 120 ? "bg-red-100 text-red-700" : timeLeft < 300 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"
            }`}>
              <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="w-full h-1.5 bg-gray-200 rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-teal-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentQ + 1) / totalQ) * 100}%` }} />
        </div>

        {/* Question card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          {/* Category / difficulty badge */}
          <div className="flex items-center gap-2 mb-3">
            {q.category && (
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{q.category}</span>
            )}
            {q.difficulty && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                q.difficulty === "easy" ? "bg-green-100 text-green-700"
                  : q.difficulty === "medium" ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
              }`}>{q.difficulty}</span>
            )}
          </div>

          {/* IQ question */}
          {type === "IQ" && (
            <>
              <p className="text-gray-900 font-medium leading-relaxed">{q.question}</p>
              <div className="mt-4 space-y-2">
                {(q.options as string[]).map((opt: string, i: number) => (
                  <button key={i} onClick={() => setAnswers((p) => ({ ...p, [q.id]: i }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                      answers[q.id] === i
                        ? "bg-blue-50 border-blue-400 text-blue-900 font-medium"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}>
                    <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* EQ question */}
          {type === "EQ" && (
            <>
              {q.scenario && <p className="text-sm text-gray-500 italic mb-2">{q.scenario}</p>}
              <p className="text-gray-900 font-medium leading-relaxed">{q.question}</p>
              <div className="mt-4 space-y-2">
                {(q.options as { id: number; text: string }[]).map((opt: { id: number; text: string }, i: number) => (
                  <button key={`${q.id}-${opt.id}`} onClick={() => setAnswers((p) => ({ ...p, [q.id]: opt.id }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                      answers[q.id] === opt.id
                        ? "bg-rose-50 border-rose-400 text-rose-900 font-medium"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}>
                    {opt.text}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* MBTI question */}
          {type === "MBTI" && (
            <>
              <p className="text-gray-900 font-medium leading-relaxed mb-4">{q.question}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "A" }))}
                  className={`p-4 rounded-xl border text-sm text-left transition-colors ${
                    answers[q.id] === "A"
                      ? "bg-purple-50 border-purple-400 text-purple-900 font-medium"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}>
                  <span className="block text-xs font-semibold text-purple-500 mb-1">Option A</span>
                  {q.optionA}
                </button>
                <button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "B" }))}
                  className={`p-4 rounded-xl border text-sm text-left transition-colors ${
                    answers[q.id] === "B"
                      ? "bg-purple-50 border-purple-400 text-purple-900 font-medium"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}>
                  <span className="block text-xs font-semibold text-purple-500 mb-1">Option B</span>
                  {q.optionB}
                </button>
              </div>
            </>
          )}

          {/* BIG_FIVE Likert */}
          {type === "BIG_FIVE" && (
            <>
              <p className="text-gray-900 font-medium leading-relaxed mb-4">{q.statement}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                {["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"].map((label, i) => (
                  <button key={i} onClick={() => setAnswers((p) => ({ ...p, [q.id]: i }))}
                    className={`flex-1 px-3 py-3 rounded-xl border text-xs font-medium transition-colors ${
                      answers[q.id] === i
                        ? "bg-amber-50 border-amber-400 text-amber-900"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>

          <div className="flex gap-1">
            {questions.map((_: any, i: number) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === currentQ ? "bg-teal-600" : answers[(questions[i] as any).id ?? i] !== undefined ? "bg-teal-300" : "bg-gray-300"
                }`} />
            ))}
          </div>

          {currentQ < totalQ - 1 ? (
            <button onClick={() => setCurrentQ(currentQ + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmitTest} disabled={submitAssessment.isPending || answeredCount < totalQ}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {submitAssessment.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Scoring...</> : <><Send className="w-4 h-4" /> Submit</>}
            </button>
          )}
        </div>

        {/* Answered count */}
        <p className="mt-3 text-center text-xs text-gray-400">
          {answeredCount}/{totalQ} questions answered
          {answeredCount < totalQ && " — answer all to submit"}
        </p>
      </div>
    </div>
  );
}
