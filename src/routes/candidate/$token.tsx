import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Clock, Calendar, MessageSquare, Briefcase, XCircle, Loader2, Award, Sparkles, ClipboardList, CalendarCheck, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import { CandidateAssessmentJourney } from "~/components/CandidateAssessmentJourney";

export const Route = createFileRoute("/candidate/$token")({
  component: CandidatePortalPage,
});

// Convert an HTML email body to readable plain text for portal display.
// Strips <style>/<script>/<head>, converts <br>/<p>/<div> to newlines, then
// removes any remaining tags and decodes a small set of HTML entities.
function htmlToPlain(input: string): string {
  if (!input) return "";
  let s = String(input);
  if (!/<[^>]+>/.test(s)) return s;
  s = s.replace(/<!DOCTYPE[^>]*>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<head[\s\S]*?<\/head>/gi, "");
  s = s.replace(/<br\s*\/?>(\s*)/gi, "\n");
  s = s.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rarr;/g, "→")
    .replace(/&larr;/g, "←")
    .replace(/&#10003;/g, "✓");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

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

        {/* AI-integrity notice — visible to candidate before any answering */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <div className="font-semibold mb-1">Please answer in your own words</div>
            <p className="mb-1">
              This assessment uses <strong>AI-detection tools</strong> that automatically flag responses
              generated by ChatGPT, Gemini, Claude and similar AI assistants.
            </p>
            <p>
              We want to hear <em>your</em> reasoning and experience. Answers detected as AI-generated
              will be disqualified. Type your answers here — you don't need to be perfect, you just need
              to be yourself.
            </p>
            <p className="mt-2 font-semibold">
              You will need a calculator, pen and paper to complete some of the assessments.
            </p>
          </div>
        </div>

        {!['HIRED', 'WITHDRAWN', 'REJECTED'].includes(d.stageBucket) && (
          <CandidateAssessmentJourney accessToken={token} />
        )}

        {/* Interview self-scheduling */}
        <CandidateSchedulingSection accessToken={token} />

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
                <div className="whitespace-pre-wrap">{htmlToPlain(m.body)}</div>
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

// ═══════════════════════════════════════════════════════════════════════════
// Cheating-defense telemetry (Tier 1 #1 & #2)
//
// Records per-textarea: paste vs typed char counts, blur/focus events,
// tab-switch counts, focus-out seconds, first keystroke time. Sent with the
// submission so the admin can see how "live" the answer was.
// ═══════════════════════════════════════════════════════════════════════════
type TelemetryState = {
  charsTyped: number;
  charsPasted: number;
  pasteCount: number;
  blurCount: number;
  tabSwitchCount: number;
  focusOutSeconds: number;
  firstKeystrokeAt: number | null;
  startedAt: number;
  _blurStartedAt: number | null;
};
function newTelemetryState(): TelemetryState {
  return {
    charsTyped: 0, charsPasted: 0, pasteCount: 0, blurCount: 0,
    tabSwitchCount: 0, focusOutSeconds: 0, firstKeystrokeAt: null,
    startedAt: Date.now(), _blurStartedAt: null,
  };
}
function useTelemetryMap() {
  const mapRef = useRef<Record<string | number, TelemetryState>>({});
  useEffect(() => {
    const onVis = () => {
      const now = Date.now();
      const hidden = document.visibilityState === "hidden";
      for (const k of Object.keys(mapRef.current)) {
        const st = mapRef.current[k];
        if (hidden) {
          st.tabSwitchCount += 1;
          if (st._blurStartedAt == null) st._blurStartedAt = now;
        } else if (st._blurStartedAt != null) {
          st.focusOutSeconds += Math.round((now - st._blurStartedAt) / 1000);
          st._blurStartedAt = null;
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  const getOrInit = (id: string | number) => {
    if (!mapRef.current[id]) mapRef.current[id] = newTelemetryState();
    return mapRef.current[id];
  };
  const handlersFor = (id: string | number) => ({
    onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const st = getOrInit(id);
      const pasted = e.clipboardData?.getData("text") ?? "";
      st.pasteCount += 1;
      st.charsPasted += pasted.length;
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const st = getOrInit(id);
      if (st.firstKeystrokeAt == null) st.firstKeystrokeAt = Date.now();
      if (e.key && e.key.length === 1) st.charsTyped += 1;
    },
    onBlur: () => {
      const st = getOrInit(id);
      st.blurCount += 1;
      if (st._blurStartedAt == null) st._blurStartedAt = Date.now();
    },
    onFocus: () => {
      const st = getOrInit(id);
      if (st._blurStartedAt != null) {
        st.focusOutSeconds += Math.round((Date.now() - st._blurStartedAt) / 1000);
        st._blurStartedAt = null;
      }
    },
  });
  const snapshot = (id: string | number, text: string) => {
    const st = getOrInit(id);
    const totalChars = text.length;
    const pasteRatio = totalChars > 0 ? st.charsPasted / totalChars : 0;
    const composeSeconds = st.firstKeystrokeAt ? Math.round((Date.now() - st.firstKeystrokeAt) / 1000) : null;
    return {
      pasteCount: st.pasteCount,
      charsPasted: st.charsPasted,
      charsTyped: st.charsTyped,
      totalChars,
      pasteRatio: Math.round(pasteRatio * 100) / 100,
      blurCount: st.blurCount,
      tabSwitchCount: st.tabSwitchCount,
      focusOutSeconds: st.focusOutSeconds,
      firstKeystrokeAt: st.firstKeystrokeAt,
      submitAt: Date.now(),
      startedAt: st.startedAt,
      composeSeconds,
    };
  };
  return { handlersFor, snapshot };
}

function CandidateFullAssessmentBanner({ accessToken }: { accessToken: string }) {
  const trpc = useTRPC();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [webcamOk, setWebcamOk] = useState<boolean | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null);
  const [paused, setPaused] = useState(false);
  const [pauseCount, setPauseCount] = useState(0);
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [showDeviceCode, setShowDeviceCode] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [deviceCodeExpiresAt, setDeviceCodeExpiresAt] = useState<Date | null>(null);
  const [claimCodeInput, setClaimCodeInput] = useState("");

  const startMut = useMutation(trpc.candidateStartSession.mutationOptions({
    onSuccess: (s: any) => setSessionId(s.id),
    onError: (e) => toast.error(e.message),
  }));
  const consentMut = useMutation(trpc.logWebcamConsent.mutationOptions({}));
  const pauseMut = useMutation(trpc.candidatePauseSession.mutationOptions({
    onSuccess: () => { setPaused(true); setPauseCount((c) => c + 1); toast("Session paused"); },
    onError: (e) => toast.error(e.message),
  }));
  const resumeMut = useMutation(trpc.candidateResumeSession.mutationOptions({
    onSuccess: () => { setPaused(false); toast.success("Resumed"); },
  }));
  const finishMut = useMutation(trpc.candidateFinishSession.mutationOptions({
    onSuccess: () => toast.success("Session complete — thank you"),
  }));
  const snapMut = useMutation(trpc.candidateCaptureSnapshot.mutationOptions({}));
  const deviceCodeMut = useMutation(trpc.createDeviceTransferCode.mutationOptions({
    onSuccess: (r: any) => {
      setDeviceCode(r.code);
      setDeviceCodeExpiresAt(new Date(r.expiresAt));
      setShowDeviceCode(true);
    },
    onError: (e) => toast.error(e.message),
  }));
  const claimCodeMut = useMutation(trpc.claimDeviceTransferCode.mutationOptions({
    onSuccess: (r: any) => {
      setSessionId(r.sessionId);
      toast.success("Session resumed on this device");
    },
    onError: (e) => toast.error(e.message),
  }));

  // Snapshot capture at random offsets while a session is active + webcam granted.
  // Uses a ref for `paused` so the capture closure always sees the current value
  // instead of the stale snapshot from the effect's initial run.
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    if (!sessionId || !streamRef || !webcamOk) return;
    let cancelled = false;
    const capture = async () => {
      if (cancelled || pausedRef.current) return;
      try {
        const video = document.createElement("video");
        video.srcObject = streamRef;
        await video.play();
        const canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
        video.pause();
        (video as any).srcObject = null;
        snapMut.mutate({ accessToken, sessionId, imageDataUrl: dataUrl });
      } catch (err) {
        console.warn("[snapshot] capture failed", err);
      }
    };
    let nextTimer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (cancelled) return;
      // Every 4-8 minutes, random.
      const delayMs = 4 * 60_000 + Math.floor(Math.random() * 4 * 60_000);
      nextTimer = setTimeout(() => {
        capture();
        schedule();
      }, delayMs);
    };
    // First snapshot 30 s after the session begins so the candidate has time to settle.
    const initial = setTimeout(() => {
      capture();
      schedule();
    }, 30_000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      if (nextTimer) clearTimeout(nextTimer);
    };
  }, [sessionId, streamRef, webcamOk, accessToken]);

  const requestWebcam = async () => {
    setWebcamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStreamRef(stream);
      setWebcamOk(true);
      consentMut.mutate({ accessToken, granted: true });
      startMut.mutate({ accessToken, webcamGranted: true });
    } catch (err: any) {
      setWebcamOk(false);
      setWebcamError(err?.message || "Camera permission denied");
      consentMut.mutate({ accessToken, granted: false, declineReason: err?.message });
      startMut.mutate({ accessToken, webcamGranted: false, webcamDeclineReason: err?.message });
    }
  };

  if (sessionId) {
    const totalSteps = 5;
    const stepOrder = ["BEHAVIOUR", "IQ", "EQ", "MBTI", "BIG_FIVE"] as const;
    const doneSteps = 0;
    const percent = Math.round((doneSteps / totalSteps) * 100);
    return (
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-teal-600" /> Assessment session active
          </h2>
          <div className="flex items-center gap-2">
            {webcamOk === true && (
              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold">
                Camera monitored
              </span>
            )}
            {paused ? (
              <button
                onClick={() => resumeMut.mutate({ accessToken, sessionId })}
                className="text-xs px-2 py-1 bg-teal-600 text-white rounded"
              >
                Resume
              </button>
            ) : pauseCount < 1 ? (
              <button
                onClick={() => pauseMut.mutate({ accessToken, sessionId })}
                className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded"
              >
                Pause once
              </button>
            ) : (
              <span className="text-[11px] text-red-600 font-semibold">Pause limit used</span>
            )}
            <button
              onClick={() => deviceCodeMut.mutate({ accessToken, sessionId })}
              disabled={deviceCodeMut.isPending}
              className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-50"
              title="Continue on another device (phone / tablet)"
            >
              Continue on other device
            </button>
            <button
              onClick={() => {
                finishMut.mutate({ accessToken, sessionId });
                streamRef?.getTracks().forEach((t) => t.stop());
                setSessionId(null);
              }}
              className="text-xs px-2 py-1 bg-teal-600 text-white rounded"
            >
              Finish
            </button>
          </div>
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
            <span>Section 1 of {totalSteps} · {stepOrder[0]}</span>
            <span>~{Math.max(1, 90 - doneSteps * 18)} min remaining</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded overflow-hidden">
            <div className="h-full bg-teal-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {showDeviceCode && deviceCode && (
          <div className="bg-teal-50 border border-teal-200 rounded p-3 mb-2 text-xs">
            <div className="font-semibold text-teal-900">Continue on another device</div>
            <div className="mt-1 text-teal-800">
              Open <code>/candidate/&lt;your-token&gt;</code> on your other device and enter this code within 15 minutes:
            </div>
            <div className="text-3xl font-mono font-bold tracking-widest text-teal-800 my-2 text-center">{deviceCode}</div>
            <div className="text-[10px] text-teal-700 text-center">
              Expires {deviceCodeExpiresAt?.toLocaleTimeString() ?? "soon"}
            </div>
          </div>
        )}
        <p className="text-xs text-gray-600">
          Each assessment is a separate section. Complete them in any order and take breaks between sections; your submitted answers are saved.
        </p>
        {webcamError && (
          <p className="text-[11px] text-amber-700 mt-2">
            Camera access was declined. You can continue using the portal, but cannot start or submit assessment sections until camera verification succeeds.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-teal-800">
        <Sparkles className="w-4 h-4" /> Complete all assessments in one session
      </h2>
      <p className="text-xs text-gray-700 mb-3">
        We invite you to complete all five assessments back-to-back for the fairest evaluation:
        <strong> AI behaviour interview + IQ + EQ + Personality (MBTI) + Big Five</strong>. Total time ≈ 90 minutes.
        You may pause once. Sessions are camera-verified to maintain integrity — random face snapshots are captured.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 text-left">
        <p className="text-xs font-semibold text-gray-900 mb-1">POPIA / privacy disclosure — camera monitoring</p>
        <ul className="text-[11px] text-gray-700 list-disc list-inside space-y-0.5">
          <li>Random face snapshots (roughly one every 4–8 minutes) are captured during the session.</li>
          <li>Only members of the hiring panel see them — they are never shared with third parties.</li>
          <li>Snapshots are automatically deleted 90 days after the final hiring decision.</li>
          <li>A camera is required to sit this assessment — without one you will not be able to start.</li>
          <li>You may withdraw consent at any time by contacting careers@square15.co.za.</li>
        </ul>
        <label className="mt-2 flex items-start gap-2 text-[11px] text-gray-800 cursor-pointer">
          <input
            type="checkbox"
            checked={popiaConsent}
            onChange={(e) => setPopiaConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>I have read and understood the disclosure above. Under POPIA I consent to the processing of my camera snapshots for the purposes of this hiring assessment.</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={requestWebcam}
          disabled={!popiaConsent}
          className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-40"
        >
          Start assessment session
        </button>
        <span className="text-[11px] text-gray-500">A working camera is required to start the assessment.</span>
      </div>

      <div className="mt-4 border-t pt-3 text-left">
        <p className="text-[11px] text-gray-600 mb-1">Already started on another device? Enter the 6-digit code shown there:</p>
        <div className="flex gap-2">
          <input
            value={claimCodeInput}
            onChange={(e) => setClaimCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="px-2 py-1 border rounded text-sm font-mono w-32 text-center"
          />
          <button
            onClick={() => claimCodeMut.mutate({ accessToken, code: claimCodeInput })}
            disabled={claimCodeInput.length !== 6 || claimCodeMut.isPending}
            className="text-xs px-3 py-1 bg-gray-100 border rounded hover:bg-gray-200 disabled:opacity-40"
          >
            Resume here
          </button>
        </div>
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
  const telemetry = useTelemetryMap();
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
            question once. <span className="text-amber-700 font-medium">AI-generated answers are automatically detected — please write your own.</span>
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
                        {...telemetry.handlersFor(`i-${qn.index}`)}
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
                              integritySignals: telemetry.snapshot(`i-${qn.index}`, answers[qn.index] ?? ""),
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

// ═══════════════════════════════════════════════════════════════════════
// Psychometric assessments (IQ / EQ / MBTI / BIG_FIVE)
// ═══════════════════════════════════════════════════════════════════════

function CandidateAssessmentsSection({ accessToken }: { accessToken: string }) {
  const trpc = useTRPC();
  const status = useQuery(
    trpc.candidateGetAssessmentStatus.queryOptions({ accessToken }, { retry: false }),
  );
  const [active, setActive] = useState<"IQ" | "EQ" | "MBTI" | "BIG_FIVE" | null>(null);
  if (status.isLoading || !status.data) return null;
  const required = (status.data.required ?? []) as string[];
  if (required.length === 0) return null;
  const completed = new Set(status.data.completed ?? []);
  const openable = required.filter((r) => ["IQ", "EQ", "MBTI", "BIG_FIVE"].includes(r));

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4 text-teal-600" /> Psychometric assessments
        </h2>
        <span className="text-xs text-gray-500">
          {[...completed].filter((c) => openable.includes(c)).length}/{openable.length}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        These short assessments help us understand your work-style and fit for the role. Take them
        when you have uninterrupted time — you can only submit each once.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {openable.map((t) => {
          const done = completed.has(t);
          const label =
            t === "IQ"
              ? "Cognitive aptitude (~30 min)"
              : t === "EQ"
              ? "Emotional intelligence (~25 min)"
              : t === "MBTI"
              ? "Personality type (~15 min)"
              : "Big Five personality (~15 min)";
          return (
            <button
              key={t}
              disabled={done}
              onClick={() => setActive(t as any)}
              className={`text-left p-3 rounded-lg border text-sm flex items-center justify-between ${
                done
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 cursor-default"
                  : "hover:border-teal-400 hover:bg-teal-50"
              }`}
            >
              <span>{label}</span>
              {done ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <span className="text-xs text-teal-700">Start</span>
              )}
            </button>
          );
        })}
      </div>
      {active && (
        <AssessmentModal
          accessToken={accessToken}
          type={active}
          onClose={() => {
            setActive(null);
            status.refetch();
          }}
        />
      )}
    </div>
  );
}

function AssessmentModal({
  accessToken,
  type,
  onClose,
}: {
  accessToken: string;
  type: "IQ" | "EQ" | "MBTI" | "BIG_FIVE";
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(
    trpc.candidateGetAssessmentQuestions.queryOptions({ accessToken, type }, { retry: false }),
  );
  const [responses, setResponses] = useState<Record<string, any>>({});
  const submitMut = useMutation(
    trpc.candidateSubmitAssessment.mutationOptions({
      onSuccess: () => {
        toast.success(`${type} submitted — thanks!`);
        qc.invalidateQueries({
          queryKey: trpc.candidateGetAssessmentStatus.queryKey({ accessToken }),
        });
        onClose();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (q.isLoading || !q.data)
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6"><Loader2 className="w-6 h-6 animate-spin" /></div>
      </div>
    );

  const d = q.data as any;
  const totalQuestions = d.questions.length;
  const answered = Object.keys(responses).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{d.title}</h3>
            <p className="text-xs text-gray-500">
              {d.description} — {answered}/{totalQuestions} answered
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {d.questions.map((qn: any, idx: number) => {
            const key = String(qn.id);
            const val = responses[key];
            return (
              <div key={key} className="border rounded-lg p-3">
                <div className="text-sm font-medium mb-2">
                  Q{idx + 1}. {qn.question ?? qn.scenario ?? qn.statement}
                </div>
                {type === "IQ" || type === "EQ" ? (
                  <div className="space-y-1.5">
                    {(qn.options ?? []).map((opt: any, oi: number) => {
                      const optId = typeof opt === "object" ? opt.id : oi;
                      const optText = typeof opt === "object" ? opt.text : opt;
                      return (
                        <label
                          key={oi}
                          className={`block text-sm p-2 rounded cursor-pointer border ${
                            val === optId ? "bg-teal-50 border-teal-400" : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="radio"
                            className="mr-2"
                            checked={val === optId}
                            onChange={() => setResponses((p) => ({ ...p, [key]: optId }))}
                          />
                          {optText}
                        </label>
                      );
                    })}
                  </div>
                ) : type === "MBTI" ? (
                  <div className="space-y-1.5">
                    {["A", "B"].map((choice) => (
                      <label
                        key={choice}
                        className={`block text-sm p-2 rounded cursor-pointer border ${
                          val === choice ? "bg-teal-50 border-teal-400" : "hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          className="mr-2"
                          checked={val === choice}
                          onChange={() => setResponses((p) => ({ ...p, [key]: choice }))}
                        />
                        {choice === "A" ? qn.optionA : qn.optionB}
                      </label>
                    ))}
                  </div>
                ) : (
                  // BIG_FIVE — 5-point Likert
                  <div className="grid grid-cols-5 gap-1.5">
                    {["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"].map(
                      (label, i) => (
                        <button
                          key={i}
                          onClick={() => setResponses((p) => ({ ...p, [key]: i }))}
                          className={`text-[10px] p-2 rounded border ${
                            val === i ? "bg-teal-50 border-teal-500" : "hover:bg-gray-50"
                          }`}
                        >
                          {label}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-0 bg-white border-t p-4 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {answered}/{totalQuestions} answered
          </span>
          <button
            disabled={submitMut.isPending || answered < totalQuestions}
            onClick={() =>
              submitMut.mutate({ accessToken, type, responses })
            }
            className="px-4 py-2 bg-teal-600 text-white rounded text-sm disabled:opacity-50"
          >
            {submitMut.isPending ? "Submitting…" : "Submit answers"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Work-sample tasks (Phase 1)
// ═══════════════════════════════════════════════════════════════════════

function CandidateWorkSampleSection({ accessToken }: { accessToken: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(
    trpc.candidateGetWorkSampleTasks.queryOptions({ accessToken }, { retry: false }),
  );
  const startMut = useMutation(
    trpc.candidateStartWorkSample.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.candidateGetWorkSampleTasks.queryKey({ accessToken }),
        }),
    }),
  );
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const telemetry = useTelemetryMap();
  const submitMut = useMutation(
    trpc.candidateSubmitWorkSample.mutationOptions({
      onSuccess: () => {
        toast.success("Work sample submitted — AI is scoring it now.");
        setDrafts({});
        qc.invalidateQueries({
          queryKey: trpc.candidateGetWorkSampleTasks.queryKey({ accessToken }),
        });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  if (q.isLoading || !q.data) return null;
  const tasks = ((q.data as any).tasks ?? []) as Array<{
    id: number;
    title: string;
    instructions: string;
    timeLimitMinutes: number;
    submission: { id: number; submittedAt: string | null; startedAt: string | null; aiScore: number | null; humanScore: number | null } | null;
  }>;
  if (!tasks.length) return null;

  return (
    <div className="bg-white rounded-xl border p-5">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <ClipboardList className="w-4 h-4 text-teal-600" /> Work sample tasks
      </h2>
      <p className="text-xs text-gray-600 mb-3">
        These short realistic tasks show us how you actually work. Complete them
        You can take breaks between tasks; each submitted task can only be submitted once. <span className="text-amber-700 font-medium">Write your own answer; AI-generated responses are automatically detected.</span>
      </p>
      <div className="space-y-4">
        {tasks.map((t) => {
          const done = !!t.submission?.submittedAt;
          const started = !!t.submission?.startedAt;
          return (
            <div key={t.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">{t.title}</div>
                <span className="text-[11px] text-gray-500">Time limit: {t.timeLimitMinutes} min</span>
              </div>
              <div className="text-xs text-gray-600 mb-2 whitespace-pre-wrap">{t.instructions}</div>
              {done ? (
                <div className="text-sm text-emerald-700 bg-emerald-50 rounded p-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Submitted
                  {t.submission?.aiScore != null && (
                    <span className="ml-auto text-xs">AI {Math.round(t.submission.aiScore)}/100</span>
                  )}
                </div>
              ) : (
                <>
                  {!started && (
                    <button
                      onClick={() => startMut.mutate({ accessToken, taskId: t.id })}
                      className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded font-medium mb-2"
                    >
                      Start task
                    </button>
                  )}
                  <textarea
                    value={drafts[t.id] ?? ""}
                    onChange={(e) => setDrafts((p) => ({ ...p, [t.id]: e.target.value }))}
                    rows={5}
                    placeholder="Type your answer here in your own words…"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    {...telemetry.handlersFor(`w-${t.id}`)}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-gray-400">{(drafts[t.id] ?? "").trim().length} chars</span>
                    <button
                      disabled={submitMut.isPending || (drafts[t.id] ?? "").trim().length < 20}
                      onClick={() =>
                        submitMut.mutate({
                          accessToken,
                          taskId: t.id,
                          answerText: drafts[t.id] ?? "",
                          attachments: [],
                          integritySignals: telemetry.snapshot(`w-${t.id}`, drafts[t.id] ?? ""),
                        })
                      }
                      className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs font-medium disabled:opacity-50"
                    >
                      Submit work sample
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Interview self-scheduling
// ═══════════════════════════════════════════════════════════════════════

function CandidateSchedulingSection({ accessToken }: { accessToken: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(
    trpc.candidateListInterviewSlots.queryOptions({ accessToken }, { retry: false }),
  );
  const bookMut = useMutation(
    trpc.candidateBookInterviewSlot.mutationOptions({
      onSuccess: () => {
        toast.success("Interview booked — check your email for confirmation.");
        qc.invalidateQueries({
          queryKey: trpc.candidateDashboard.queryKey({ accessToken }),
        });
        qc.invalidateQueries({
          queryKey: trpc.candidateListInterviewSlots.queryKey({ accessToken }),
        });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  if (q.isLoading || !q.data) return null;
  const data = q.data as any;
  const slots = (data.slots ?? []) as { id: string; start: string; end: string; label: string }[];
  const available = data.available;

  if (!available && data.reason === "stage") return null;

  return (
    <div className="bg-white rounded-xl border p-5">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <CalendarCheck className="w-4 h-4 text-teal-600" /> Choose an interview time
      </h2>
      {slots.length === 0 ? (
        <div className="text-sm text-gray-600 bg-teal-50 border border-teal-200 rounded-lg p-3">
          Your recruiter is preparing interview times for you. You will receive an email
          notification as soon as slots are available to book. In the meantime, check your
          email for any messages from the team.
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-600 mb-3">
            Pick a slot that works for you — we'll follow up with location or video-call details.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {slots.slice(0, 12).map((s) => (
              <button
                key={s.id}
                disabled={bookMut.isPending}
                onClick={() => {
                  if (confirm(`Book interview slot: ${s.label}?`))
                    bookMut.mutate({
                      accessToken,
                      startISO: new Date(s.start).toISOString(),
                      endISO: new Date(s.end).toISOString(),
                    });
                }}
                className="text-xs p-2 border rounded hover:border-teal-400 hover:bg-teal-50 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
