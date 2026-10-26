import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";

const labels: Record<string, string> = { BEHAVIOUR: "Behaviour interview", IQ: "Cognitive aptitude", EQ: "Emotional intelligence", MBTI: "Personality type", BIG_FIVE: "Big Five personality", WORK_SAMPLE: "Work samples / quotations" };
type Section = { type: string; questions: { id: string; text: string; options?: { id: string | number; text: string }[] }[]; answered: string[]; complete: boolean; responses: unknown; revision: number; legacy: boolean };

function useServerDraft(accessToken: string, section: Section) {
  const trpc = useTRPC();
  const save = useMutation(trpc.candidateSaveAssessmentDraft.mutationOptions());
  const storageKey = `assessment-draft:${accessToken}:${section.type}`;
  const initial = () => {
    try {
      const backup = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (backup?.revision === section.revision) return backup.answers;
    } catch { /* Server draft remains authoritative. */ }
    return section.responses as Record<string, string | number>;
  };
  const [answers, setAnswers] = useState<Record<string, string | number>>(initial);
  const latest = useRef(answers);
  const revision = useRef(section.revision);
  const queue = useRef<Promise<number>>(Promise.resolve(section.revision));
  const [status, setStatus] = useState(() => JSON.stringify(answers) === JSON.stringify(section.responses) ? "Saved draft restored" : "Unsaved recovered changes");
  const submitting = useRef(false);
  const flush = () => {
    const snapshot = { ...latest.current };
    setStatus("Saving…");
    const next = queue.current.catch(() => revision.current).then(async () => {
      const result = await save.mutateAsync({ accessToken, type: section.type as any, revision: revision.current, legacy: section.legacy, responses: snapshot });
      revision.current = result.revision;
      if (JSON.stringify(snapshot) === JSON.stringify(latest.current)) {
        setStatus("Saved to server");
        try { localStorage.removeItem(storageKey); } catch { /* Saving succeeded even when local storage is unavailable. */ }
      } else {
        setStatus("Unsaved changes");
        try { localStorage.setItem(storageKey, JSON.stringify({ revision: result.revision, answers: latest.current })); } catch { /* Next server save remains available. */ }
      }
      return result.revision;
    });
    queue.current = next;
    return next.catch(error => { setStatus(`Not saved: ${error.message}`); throw error; });
  };
  const change = (id: string, value: string | number) => {
    latest.current = { ...latest.current, [id]: value };
    setAnswers(latest.current);
    setStatus("Unsaved changes");
    try { localStorage.setItem(storageKey, JSON.stringify({ revision: revision.current, answers: latest.current })); } catch { /* Server save still available. */ }
  };
  useEffect(() => {
    if (submitting.current || JSON.stringify(answers) === JSON.stringify(section.responses)) return;
    const timer = setTimeout(() => { if (!submitting.current) void flush().catch(() => {}); }, 600);
    return () => clearTimeout(timer);
  }, [answers]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (status !== "Saved to server" && status !== "Saved draft restored") { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  return { answers, change, flush, status, submitting };
}

function SectionPage({ accessToken, section, sectionIndex, sectionCount, onDone, onBack }: { accessToken: string; section: Section; sectionIndex: number; sectionCount: number; onDone: (sectionComplete: boolean) => Promise<void>; onBack: () => Promise<void> }) {
  const trpc = useTRPC();
  const draft = useServerDraft(accessToken, section);
  const psych = useMutation(trpc.candidateSubmitPortalAssessment.mutationOptions());
  const interview = useMutation(trpc.candidateSubmitInterviewAnswer.mutationOptions());
  const startWork = useMutation(trpc.candidateStartWorkSample.mutationOptions());
  const work = useMutation(trpc.candidateSubmitWorkSample.mutationOptions());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const telemetry = useRef<Record<string, { pasteCount: number; charsPasted: number; charsTyped: number; startedAt: number }>>({});
  const signal = (id: string) => telemetry.current[id] ?? (telemetry.current[id] = { pasteCount: 0, charsPasted: 0, charsTyped: 0, startedAt: Date.now() });
  const ready = section.questions.every(q => section.answered.includes(q.id) || (q.options ? draft.answers[q.id] !== undefined : String(draft.answers[q.id] ?? "").trim().length >= (section.type === "BEHAVIOUR" ? 20 : 1)));
  const answeredCount = section.questions.filter(q => section.answered.includes(q.id) || draft.answers[q.id] !== undefined).length;
  const submit = async (questionId?: string) => {
    if (busy) return;
    setBusy(true); setError(""); draft.submitting.current = true;
    try {
      const revision = await draft.flush();
      if (["IQ", "EQ", "MBTI", "BIG_FIVE"].includes(section.type)) {
        await psych.mutateAsync({ accessToken, type: section.type as any, revision });
      } else {
        const ids = questionId ? [questionId] : section.questions.filter(q => !section.answered.includes(q.id)).map(q => q.id);
        for (const id of ids) {
          const answer = String(draft.answers[id] ?? "");
          const signals = { ...signal(id), submitAt: Date.now(), totalChars: answer.length };
          if (section.type === "BEHAVIOUR") await interview.mutateAsync({ accessToken, questionIndex: Number(id), answer, integritySignals: signals });
          else {
            await startWork.mutateAsync({ accessToken, taskId: Number(id) });
            await work.mutateAsync({ accessToken, taskId: Number(id), answerText: answer, integritySignals: signals });
          }
        }
      }
      const sectionComplete = !questionId || section.questions.every(q => section.answered.includes(q.id) || q.id === questionId);
      await onDone(sectionComplete);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); draft.submitting.current = false; }
  };
  return <section className="bg-white rounded-xl border p-5 space-y-4">
    <div className="space-y-2">
      <div className="flex justify-between gap-3 items-start"><div><p className="text-xs font-medium uppercase tracking-wide text-teal-700">Section {sectionIndex + 1} of {sectionCount}</p><h2 className="text-xl font-semibold">{labels[section.type]}</h2></div><button disabled={busy} onClick={async () => { try { await draft.flush(); await onBack(); } catch (e: any) { setError(e.message); } }} className="text-sm font-medium text-teal-700">Save & take a break</button></div>
      <p className="text-xs text-gray-500">{answeredCount} of {section.questions.length} questions answered in this section.</p>
      <progress aria-label={`${labels[section.type]} progress`} className="w-full accent-teal-700" value={answeredCount} max={section.questions.length || 1} />
    </div>
    <p role="status" className={draft.status.startsWith("Not saved") ? "text-red-700" : "text-sm text-gray-600"}>{draft.status}</p>
    <p className="text-sm text-gray-600">Complete this section at your own pace. Drafts save automatically and can be resumed after a break or reload. Submitted answers cannot be changed.</p>
    {section.questions.map((q, index) => <div key={q.id} className="border rounded-lg p-4 space-y-3">
      <h3 className="font-medium whitespace-pre-wrap">{index + 1}. {q.text}</h3>
      {section.answered.includes(q.id) ? <p className="text-emerald-700">Answer submitted ✓</p> : q.options ? <div className="space-y-2">{q.options.map(option => <label key={option.id} className="flex gap-3 border rounded p-3 cursor-pointer"><input type="radio" name={q.id} checked={draft.answers[q.id] === option.id} disabled={busy} onChange={() => draft.change(q.id, option.id)} />{option.text}</label>)}</div> : <>
        <textarea className="w-full border rounded-lg p-3" rows={6} maxLength={section.type === "BEHAVIOUR" ? 4000 : 20000} value={draft.answers[q.id] ?? ""} disabled={busy} onChange={e => draft.change(q.id, e.target.value)} onPaste={e => { signal(q.id).pasteCount++; signal(q.id).charsPasted += e.clipboardData.getData("text").length; }} onKeyDown={e => { if (e.key.length === 1) signal(q.id).charsTyped++; }} />
        <button disabled={busy || String(draft.answers[q.id] ?? "").trim().length < (section.type === "BEHAVIOUR" ? 20 : 1)} onClick={() => void submit(q.id)} className="border rounded px-3 py-2 text-teal-700 disabled:opacity-50">Submit this answer</button>
      </>}
    </div>)}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button disabled={busy || !ready} onClick={() => void submit()} className="bg-teal-700 text-white rounded-lg px-5 py-3 disabled:opacity-50">{busy ? "Saving and submitting…" : "Complete section"}</button>
  </section>;
}

export function CandidateAssessmentJourney({ accessToken }: { accessToken: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const query = useQuery(trpc.candidateAssessmentPortal.queryOptions({ accessToken }, { retry: false }));
  const start = useMutation(trpc.candidateStartSession.mutationOptions());
  const pause = useMutation(trpc.candidatePauseSession.mutationOptions());
  const resume = useMutation(trpc.candidateResumeSession.mutationOptions());
  const finish = useMutation(trpc.candidateFinishSession.mutationOptions());
  const snapshot = useMutation(trpc.candidateCaptureSnapshot.mutationOptions());
  const failure = useMutation(trpc.candidateSnapshotFailure.mutationOptions());
  const startWork = useMutation(trpc.candidateStartWorkSample.mutationOptions());
  const [active, setActive] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return sessionStorage.getItem(`assessment-section:${accessToken}`) ?? new URLSearchParams(window.location.search).get("section") ?? ""; }
    catch { return ""; }
  });
  const [consent, setConsent] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [breakMessage, setBreakMessage] = useState("");
  const session = query.data?.session;
  const sections = (query.data?.sections ?? []) as Section[];
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.candidateAssessmentPortal.queryKey({ accessToken }) });
  const select = (type: string) => {
    setActive(type);
    // Router history changes remount the page and release its camera stream.
    try { sessionStorage.setItem(`assessment-section:${accessToken}`, type); } catch { /* The active page still works without storage. */ }
  };
  const stopCamera = () => { setCameraReady(false); stream?.getTracks().forEach(track => track.stop()); setStream(null); };
  useEffect(() => () => { stream?.getTracks().forEach(track => track.stop()); }, [stream]);
  useEffect(() => {
    if (!stream || !session || !session.webcamGranted || session.pausedAt) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const ended = () => { setCameraReady(false); setCameraError("Camera disconnected. Reconnect to continue; your draft is preserved."); void failure.mutateAsync({ accessToken, sessionId: session.id, reason: "Camera disconnected" }).then(refresh).catch(() => {}); };
    stream.getVideoTracks().forEach(track => track.addEventListener("ended", ended));
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.srcObject = stream;
    const capture = async () => {
      try {
        await video.play();
        if (!video.videoWidth || !video.videoHeight || video.readyState < 2) await new Promise<void>((resolve, reject) => {
          const ready = () => { if (video.videoWidth && video.videoHeight && video.readyState >= 2) { clearTimeout(timeout); video.removeEventListener("loadeddata", ready); resolve(); } };
          const timeout = setTimeout(() => { video.removeEventListener("loadeddata", ready); reject(new Error("Camera did not provide a usable frame")); }, 10000);
          video.addEventListener("loadeddata", ready); ready();
        });
        if (cancelled) return;
        const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = Math.round(320 * video.videoHeight / video.videoWidth);
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Camera frame could not be processed");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        await snapshot.mutateAsync({ accessToken, sessionId: session.id, step: active || "PORTAL_OVERVIEW", imageDataUrl: canvas.toDataURL("image/jpeg", 0.6) });
        if (!cancelled) { setCameraReady(true); setCameraError(""); }
      } catch (e: any) {
        if (!cancelled) {
          setCameraReady(false);
          setCameraError(`Snapshot not captured: ${e.message}`);
          await failure.mutateAsync({ accessToken, sessionId: session.id, reason: e.message }).catch(() => { toast.error("Camera failure could not be recorded; please retry"); });
        }
      } finally {
        if (!cancelled) timer = setTimeout(() => void capture(), 240000 + Math.random() * 240000);
      }
    };
    void capture(); // Early frame after readiness, followed by disclosed random face snapshots.
    return () => { cancelled = true; clearTimeout(timer); stream.getVideoTracks().forEach(track => track.removeEventListener("ended", ended)); video.pause(); video.srcObject = null; };
  }, [stream, session?.id, session?.webcamGranted, session?.pausedAt, active, accessToken]);

  const enter = async (type: string) => {
    if (!cameraReady || !stream?.getVideoTracks().some(track => track.readyState === "live")) { toast.error("Enable your camera and wait for verification before continuing."); return; }
    setTransitioning(true);
    try {
      const s = session ?? await start.mutateAsync({ accessToken, webcamGranted: true, portal: true });
      if (type === "WORK_SAMPLE") {
        // Start task clocks at entry, not immediately before submission.
        for (const q of sections.find(section => section.type === type)?.questions ?? []) {
          await startWork.mutateAsync({ accessToken, taskId: Number(q.id) });
        }
      }
      if (s.pausedAt) await resume.mutateAsync({ accessToken, sessionId: s.id });
      await refresh(); select(type); setBreakMessage("");
    } catch (e: any) { toast.error(e.message); }
    finally { setTransitioning(false); }
  };
  const takeBreak = async (completed = false) => {
    if (session) await pause.mutateAsync({ accessToken, sessionId: session.id });
    stopCamera();
    setConsent(false);
    await refresh(); select("");
    setBreakMessage(completed ? "Section submitted. Take a break before the next section." : "Draft saved. You can return whenever you are ready.");
  };
  const requestCamera = async () => {
    let nextStream: MediaStream | undefined;
    try {
      setCameraError("");
      setCameraReady(false);
      nextStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const s = await start.mutateAsync({ accessToken, webcamGranted: true, portal: true });
      if (s.pausedAt) await resume.mutateAsync({ accessToken, sessionId: s.id });
      stopCamera(); setStream(nextStream); await refresh();
    } catch (e: any) {
      nextStream?.getTracks().forEach(t => t.stop()); setCameraError(e.message);
      try {
        const s = session ?? await start.mutateAsync({ accessToken, webcamGranted: false, webcamDeclineReason: e.message, portal: true });
        await failure.mutateAsync({ accessToken, sessionId: s.id, reason: e.message }); await refresh();
      } catch { toast.error("Camera failure could not be recorded; you can retry"); }
    }
  };
  if (query.isLoading) return <p role="status">Loading assessment progress…</p>;
  if (query.error) return <p role="alert" className="text-red-700">{query.error.message}</p>;
  const completed = sections.filter(s => s.complete).length;
  const current = sections.find(s => s.type === active && !s.complete);
  const next = sections.find(s => !s.complete);
  return <div className="space-y-4">
    <section className="bg-white border rounded-xl p-5 space-y-3">
      <h2 className="text-xl font-semibold">Your assessment journey</h2>
      <p className="text-sm text-gray-600">Each assessment has its own section. Complete one section, then choose “Next section” when you’re ready. Your drafts save automatically, and you can take breaks between sections.</p>
      <p>{completed}/{sections.length} required sections completed</p>
      <progress aria-label="Required sections completed" className="w-full accent-teal-700" value={completed} max={sections.length || 1} />
      <details><summary className="text-sm cursor-pointer">Required camera verification & privacy</summary><p className="text-sm mt-2">A working camera is mandatory to start or resume assessments and submit answers. Camera snapshots are captured once ready, on section entry and randomly every 4–8 minutes while connected. No desktop screenshots, screen sharing or audio recording. Authorized hiring staff can review them. You may stop the camera or withdraw consent, but assessments cannot continue until verification is restored. Drafts remain saved.</p></details>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); if (!e.target.checked) { stopCamera(); if (session) void start.mutateAsync({ accessToken, webcamGranted: false, webcamDeclineReason: "Consent withdrawn", portal: true }).then(refresh).catch((error: any) => toast.error(error.message)); } }} />I understand camera verification is required and consent to camera snapshots.</label>
      {!cameraReady && <p role="status" className="text-sm text-amber-800">{stream ? "Verifying camera capture…" : "Enable your camera to continue. Camera verification is mandatory."}</p>}
      {cameraReady && <p role="status" className="text-sm text-emerald-700">Camera verified — ready to continue.</p>}
      {cameraError && <p role="alert" className="text-amber-800">{cameraError}. Check camera permissions and reconnect to continue.</p>}
      <div className="flex gap-3"><button disabled={!consent || start.isPending} onClick={() => void requestCamera()} className="border rounded px-3 py-2 disabled:opacity-50">{stream ? "Reconnect camera" : "Enable camera explicitly"}</button>{stream && <button className="border rounded px-3 py-2" onClick={async () => { stopCamera(); setConsent(false); try { await start.mutateAsync({ accessToken, webcamGranted: false, webcamDeclineReason: "Consent withdrawn", portal: true }); await refresh(); } catch (e: any) { toast.error(e.message); } }}>Stop camera / withdraw consent</button>}</div>
    </section>
    {current && session && !session.pausedAt && cameraReady ? <SectionPage key={`${current.type}:${current.answered.join(",")}`} accessToken={accessToken} section={current} sectionIndex={sections.findIndex(s => s.type === current.type)} sectionCount={sections.length} onBack={() => takeBreak()} onDone={async (sectionComplete) => { setTransitioning(true); try { await refresh(); if (sectionComplete) await takeBreak(true); } finally { setTransitioning(false); } }} /> : <section className="bg-white border rounded-xl p-5 space-y-4">
      {breakMessage && <p role="status" className="rounded bg-emerald-50 p-3 text-emerald-800">{breakMessage}</p>}
      {sections.map((s, index) => <div key={s.type} className="flex justify-between border rounded p-3"><span><span className="mr-2 text-xs text-gray-400">{index + 1}.</span>{labels[s.type]}</span><span>{s.complete ? "Complete ✓" : Object.keys((s.responses ?? {}) as Record<string, unknown>).length ? "Draft saved" : "Not started"}</span></div>)}
      {next ? <button disabled={transitioning || !cameraReady} onClick={() => void enter(next.type)} className="bg-teal-700 text-white px-5 py-3 rounded-lg disabled:opacity-50">{transitioning ? "Restoring…" : `Next section: ${labels[next.type]}`}</button> : <><p className="text-emerald-700">All required sections are complete. Thank you.</p>{session && <button onClick={async () => { try { await finish.mutateAsync({ accessToken, sessionId: session.id }); stopCamera(); await refresh(); } catch (e: any) { toast.error(e.message); } }}>Finish session</button>}</>}
    </section>}
  </div>;
}