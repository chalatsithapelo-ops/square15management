import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, KeyRound, Users, CheckCircle2, Loader2, AlertTriangle, PauseCircle } from "lucide-react";

type ActiveJob = { orderId: number; orderNumber: string; status: string; role: string };

export const Route = createFileRoute("/artisan/jobs/join/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const { user } = useAuthStore.getState();
    if (!user || (user.role !== "ARTISAN" && user.role !== "CONTRACTOR")) {
      throw redirect({ to: "/" });
    }
  },
  component: JoinJobPage,
});

function JoinJobPage() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  if (!token || !user) return null;

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  // When the server rejects the join because the artisan already has active jobs,
  // we open a modal offering to pause them and retry — much friendlier than a hard block.
  const [activeJobsModal, setActiveJobsModal] = useState<null | { jobs: ActiveJob[]; pendingCode: string }>(null);
  const [pauseAllPending, setPauseAllPending] = useState(false);

  const myCrew = useQuery(trpc.artisanGetMyCrewOrders.queryOptions({ token }));

  // Request GPS as soon as the page loads. We need coords for geofence + audit.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const captureGeoAndJoin = (code: string) => {
    // If we already have coords, use them. Otherwise try once more (may be quicker now).
    if (coords) {
      join.mutate({ token, joinCode: code, lat: coords.lat, lng: coords.lng });
      return;
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatus("granted");
          join.mutate({ token, joinCode: code, lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Fail-open at the client (server will reject when site coords require geofence)
          join.mutate({ token, joinCode: code });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      join.mutate({ token, joinCode: code });
    }
  };

  const join = useMutation(trpc.artisanJoinByCode.mutationOptions({
    onSuccess: (res: any) => {
      const dist = typeof res.distanceMeters === "number" ? ` · ${Math.round(res.distanceMeters)}m from site` : "";
      toast.success(res.alreadyOnCrew ? `Welcome back to ${res.orderNumber}${dist}` : `Joined ${res.orderNumber}${dist}`);
      navigate({ to: `/artisan/jobs/${res.orderId}` as any });
    },
    onError: (e: any) => {
      // Server surfaces "active jobs" via cause so we can offer pause-and-retry.
      const cause = e?.data?.cause ?? e?.shape?.data?.cause;
      const activeJobs: ActiveJob[] | undefined = cause?.activeJobs;
      if (Array.isArray(activeJobs) && activeJobs.length > 0) {
        const pendingCode = digits.join("");
        setActiveJobsModal({ jobs: activeJobs, pendingCode });
        return;
      }
      toast.error(e.message);
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    },
  }));

  const pauseMutation = useMutation(trpc.pauseJob.mutationOptions());

  const handlePauseAllAndJoin = async () => {
    if (!activeJobsModal) return;
    setPauseAllPending(true);
    try {
      await Promise.all(
        activeJobsModal.jobs.map((j) => pauseMutation.mutateAsync({ token, orderId: j.orderId })),
      );
      toast.success(`Paused ${activeJobsModal.jobs.length} active job${activeJobsModal.jobs.length === 1 ? "" : "s"}`);
      const code = activeJobsModal.pendingCode;
      setActiveJobsModal(null);
      // Rehydrate the digit inputs so the user sees the retry in progress
      setDigits(code.split(""));
      captureGeoAndJoin(code);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not pause one of the active jobs");
    } finally {
      setPauseAllPending(false);
    }
  };

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const handleChange = (idx: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 1);
    const next = [...digits];
    next[idx] = v;
    setDigits(next);
    if (v && idx < 5) inputs.current[idx + 1]?.focus();
    if (next.every((d) => d.length === 1)) {
      captureGeoAndJoin(next.join(""));
    }
  };

  const handleKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      e.preventDefault();
      setDigits(text.split(""));
      captureGeoAndJoin(text);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/artisan/dashboard" className="text-gray-600 hover:text-gray-900"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-lg font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5" />Join a job</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow border p-6 text-center space-y-4">
          <p className="text-sm text-gray-600">Enter the 6-digit code the lead artisan shared with you.</p>
          <div className={`text-xs inline-flex items-center gap-1.5 px-2 py-1 rounded ${geoStatus === "granted" ? "bg-green-50 text-green-700" : geoStatus === "denied" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${geoStatus === "granted" ? "bg-green-600" : geoStatus === "denied" ? "bg-red-600" : "bg-amber-600 animate-pulse"}`} />
            {geoStatus === "granted" ? "Location verified" : geoStatus === "denied" ? "Location required — enable GPS and reload" : "Requesting your location…"}
          </div>
          <div className="flex justify-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKey(i, e)}
                onPaste={handlePaste}
                inputMode="numeric"
                pattern="\d*"
                maxLength={1}
                className="w-12 h-14 text-2xl font-mono font-bold text-center border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                disabled={join.isPending}
              />
            ))}
          </div>
          {join.isPending && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />Joining...
            </div>
          )}
        </div>

        {/* Your active crew memberships */}
        <div className="bg-white rounded-lg shadow border p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" />Your active jobs</h2>
          {myCrew.isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : !myCrew.data?.length ? (
            <p className="text-sm text-gray-500">You aren't on any active job crews. Join one with a code above, or start your own.</p>
          ) : (
            <ul className="divide-y">
              {myCrew.data.map((m) => (
                <li key={m.orderId} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/artisan/jobs/${m.orderId}` as any} className="font-medium text-indigo-700 hover:underline">{m.orderNumber}</Link>
                    <div className="text-xs text-gray-600">{m.serviceType} · {m.building?.name ?? m.address}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded mr-2 ${m.role === "LEAD" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700"}`}>{m.role}</span>
                      {m.ssraAckedAt ? <span className="text-green-600">SSRA acknowledged</span> : <span className="text-amber-600">SSRA pending</span>}
                    </div>
                  </div>
                  {m.role === "LEAD" && (
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Join code</div>
                      {m.joinCode ? (
                        <>
                          <div className="font-mono font-bold tracking-widest text-sm">{m.joinCode}</div>
                          {m.joinCodeExpiresAt && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              expires {new Date(m.joinCodeExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          )}
                        </>
                      ) : (
                        <RegenerateCodeButton orderId={m.orderId} />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Active-jobs modal: offer to pause active jobs and retry the join */}
      {activeJobsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl">
            <div className="p-5 border-b flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">You have active job{activeJobsModal.jobs.length === 1 ? "" : "s"}</h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  Pause the job{activeJobsModal.jobs.length === 1 ? "" : "s"} below to join the new one. You can resume later from your dashboard.
                </p>
              </div>
            </div>

            <ul className="max-h-64 overflow-y-auto divide-y">
              {activeJobsModal.jobs.map((j) => (
                <li key={j.orderId} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{j.orderNumber}</div>
                    <div className="text-xs text-gray-500">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 mr-1.5">{j.role}</span>
                      <span>{j.status}</span>
                    </div>
                  </div>
                  <Link
                    to={`/artisan/jobs/${j.orderId}` as any}
                    className="text-xs text-indigo-600 hover:underline"
                  >Open</Link>
                </li>
              ))}
            </ul>

            <div className="p-4 border-t flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => {
                  setActiveJobsModal(null);
                  setDigits(["", "", "", "", "", ""]);
                  inputs.current[0]?.focus();
                }}
                className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
              >Cancel</button>
              <button
                onClick={handlePauseAllAndJoin}
                disabled={pauseAllPending}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-60"
              >
                {pauseAllPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
                Pause & join new job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RegenerateCodeButton({ orderId }: { orderId: number }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const mutate = useMutation(trpc.artisanRegenerateJoinCode.mutationOptions({
    onSuccess: (res: any) => {
      setCode(res.joinCode);
      setExpiresAt(res.expiresAt ? new Date(res.expiresAt) : null);
      toast.success("New code generated");
    },
    onError: (e) => toast.error(e.message),
  }));
  if (code) {
    return (
      <div>
        <div className="font-mono font-bold tracking-widest text-sm">{code}</div>
        {expiresAt && (
          <div className="text-[10px] text-gray-500 mt-0.5">
            expires {expiresAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => token && mutate.mutate({ token, orderId })}
      disabled={mutate.isPending}
      className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
    >
      {mutate.isPending ? "…" : "Generate new"}
    </button>
  );
}
