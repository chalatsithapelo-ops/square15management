import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import { PhotoUpload } from "~/components/PhotoUpload";
import { SiteLeadPicker } from "~/components/SiteLeadPicker";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ClipboardCheck,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  FileText,
  Sparkles,
  Camera,
} from "lucide-react";

export const Route = createFileRoute("/artisan/jobs/start/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const { user } = useAuthStore.getState();
    if (!user || (user.role !== "ARTISAN" && user.role !== "CONTRACTOR")) {
      throw redirect({ to: "/" });
    }
  },
  component: StartJobWizard,
});

type Step = 1 | 2 | 3 | 4 | 5;

function StartJobWizard() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();

  if (!token || !user) return null;

  const [step, setStep] = useState<Step>(1);
  const [buildingSearch, setBuildingSearch] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  // "Building not listed" inline add-flow state
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingAddress, setNewBuildingAddress] = useState("");
  const [addBuildingClientMode, setAddBuildingClientMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [addBuildingClientId, setAddBuildingClientId] = useState<number | "">("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  // Once confirmed, the wizard treats this as the "selected building" and sends
  // it as `quickAddBuilding` in the final createOrder call.
  const [pendingNewBuilding, setPendingNewBuilding] = useState<{
    name: string;
    address: string;
    clientId?: number;
    newClient?: { name: string; phone: string; email?: string };
    displayClientName: string;
  } | null>(null);
  const [orderNumberStatus, setOrderNumberStatus] = useState<"HAS_NUMBER" | "PENDING_FROM_CLIENT" | "NO_ORDER_REQUIRED">("PENDING_FROM_CLIENT");
  const [clientOrderNumber, setClientOrderNumber] = useState("");
  const [noOrderReason, setNoOrderReason] = useState("");
  const [serviceType, setServiceType] = useState("");
  // When serviceType === "OTHER" the artisan must describe what "other" means.
  const [serviceTypeOther, setServiceTypeOther] = useState("");
  const [description, setDescription] = useState("");
  const [ssraAnswers, setSsraAnswers] = useState<Record<string, "yes" | "no">>({});
  // AI-generated SSRA question set (job-specific). Loaded when the artisan
  // enters step 4 after order creation. Falls back to a static template
  // server-side if the AI generator is unavailable — flag `aiGenerated`
  // tells us which path produced the set.
  const [aiSsra, setAiSsra] = useState<{
    aiGenerated: boolean;
    jobSummary: string;
    overallRiskProfile: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    questions: Array<{
      id: string;
      prompt: string;
      category?: string;
      safeAnswer: "yes" | "no";
      criticality: "BLOCK" | "WARN";
      rationale?: string;
      onUnsafe: {
        hazard: string;
        potentialHarm: string;
        inherentLikelihood: number;
        inherentSeverity: number;
        controls: string;
        residualLikelihood: number;
        residualSeverity: number;
        ppeRequired: string[];
        trainingRequired: string[];
        legalReferences: string[];
      };
    }>;
  } | null>(null);
  const [ssraBlockers, setSsraBlockers] = useState<Array<{ id: string; prompt: string; required: string; rationale?: string }>>([]);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  // PR-8 F — Unified "Site Lead / Technical Manager / Ops Manager" pick.
  // Whoever the artisan picks here becomes the supervisor of record for
  // this job. No separate TM / OM step and no admin re-confirmation.
  const [selectedSiteLeadId, setSelectedSiteLeadId] = useState<number | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string>("");
  const [createdJoinCode, setCreatedJoinCode] = useState<string>("");
  const [conflict, setConflict] = useState<{ orderId: number; orderNumber: string; joinCode?: string | null } | null>(null);

  const ctx = useQuery(trpc.artisanGetStartJobContext.queryOptions({ token }));
  const ssraTemplate = useQuery({
    ...trpc.artisanGetSsraTemplate.queryOptions({ token, serviceType: serviceType || "GENERAL" }),
    enabled: step >= 4 && !!serviceType,
  });

  const createOrder = useMutation(trpc.artisanCreateOrder.mutationOptions({
    onSuccess: (res: any) => {
      setCreatedOrderId(res.orderId);
      setCreatedOrderNumber(res.orderNumber);
      setCreatedJoinCode(res.joinCode ?? "");
      setStep(4);
      toast.success(`Order ${res.orderNumber} created — now complete SSRA`);
    },
    onError: (e: any) => {
      // PR-6 — if another artisan already started this job, offer to join instead
      const cause = e?.data?.cause ?? e?.cause;
      if (cause?.existingOrderId) {
        setConflict({ orderId: cause.existingOrderId, orderNumber: cause.orderNumber, joinCode: cause.joinCode });
      }
      toast.error(e.message);
    },
  }));

  const submitSsra = useMutation(trpc.artisanSubmitSsra.mutationOptions({
    onSuccess: (res: any) => {
      toast.success(`SSRA submitted (${res.itemCount} risk items)`);
      setStep(5);
      setSsraBlockers([]);
    },
    onError: (e: any) => {
      // The server throws a structured BAD_REQUEST with `cause.blockers` when
      // essential-safety (BLOCK) questions are answered unsafely. Surface
      // those inline so the artisan sees exactly which items to fix.
      const cause = (e as any)?.data?.cause ?? (e as any)?.cause;
      if (cause?.blockers && Array.isArray(cause.blockers)) {
        setSsraBlockers(cause.blockers);
        toast.error("Cannot proceed \u2014 fix the flagged safety items first");
      } else {
        toast.error(e.message);
      }
    },
  }));

  // Generate the AI SSRA question set when the artisan lands on step 4 with
  // a created order. Runs once per createdOrderId.
  const generateAiSsra = useMutation(trpc.artisanGenerateSsraForOrder.mutationOptions({
    onSuccess: (res: any) => {
      setAiSsra(res);
      // Pre-seed answers with the safe answer so the artisan actively
      // confirms each one rather than relying on defaults.
      const seed: Record<string, "yes" | "no"> = {};
      for (const q of res.questions) seed[q.id] = q.safeAnswer;
      setSsraAnswers(seed);
      setSsraBlockers([]);
    },
    onError: (e) => toast.error(e.message),
  }));

  // Trigger AI generation on step-4 entry (once per order).
  useEffect(() => {
    if (step === 4 && createdOrderId && !aiSsra && !generateAiSsra.isPending) {
      generateAiSsra.mutate({ token, orderId: createdOrderId });
    }
  }, [step, createdOrderId, aiSsra, generateAiSsra.isPending, token]);

  const filteredBuildings = useMemo(() => {
    if (!ctx.data) return [];
    const all = [...(ctx.data.recentBuildings || []), ...(ctx.data.allBuildings || [])];
    const seen = new Set<number>();
    const unique = all.filter((b: any) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
    if (!buildingSearch) return unique.slice(0, 30);
    const s = buildingSearch.toLowerCase();
    return unique.filter((b: any) =>
      b.name?.toLowerCase().includes(s) ||
      b.address?.toLowerCase().includes(s) ||
      b.client?.name?.toLowerCase().includes(s)
    ).slice(0, 50);
  }, [ctx.data, buildingSearch]);

  const selectedBuilding = useMemo(() => {
    if (!ctx.data || !selectedBuildingId) return null;
    const all = [...(ctx.data.recentBuildings || []), ...(ctx.data.allBuildings || [])];
    return all.find((b: any) => b.id === selectedBuildingId);
  }, [ctx.data, selectedBuildingId]);

  const canNextFromStep1 = !!selectedBuildingId || !!pendingNewBuilding;
  const canNextFromStep2 = orderNumberStatus === "HAS_NUMBER"
    ? clientOrderNumber.trim().length > 0
    : noOrderReason.trim().length > 0;
  const canNextFromStep3 =
    serviceType.length > 0 &&
    (serviceType !== "OTHER" || serviceTypeOther.trim().length >= 2) &&
    description.trim().length >= 3 &&
    beforePhotos.length >= 3 &&
    selectedSiteLeadId != null;

  const canSaveNewBuilding =
    newBuildingName.trim().length > 0 &&
    newBuildingAddress.trim().length > 0 &&
    (addBuildingClientMode === "EXISTING"
      ? typeof addBuildingClientId === "number"
      : newClientName.trim().length > 0 && newClientPhone.trim().length > 0);

  const confirmNewBuilding = () => {
    if (!canSaveNewBuilding) return;
    const displayClientName =
      addBuildingClientMode === "EXISTING"
        ? (ctx.data?.clients ?? []).find((c: any) => c.id === addBuildingClientId)?.name ?? "Client"
        : newClientName.trim();
    setPendingNewBuilding({
      name: newBuildingName.trim(),
      address: newBuildingAddress.trim(),
      clientId: addBuildingClientMode === "EXISTING" && typeof addBuildingClientId === "number" ? addBuildingClientId : undefined,
      newClient:
        addBuildingClientMode === "NEW"
          ? {
              name: newClientName.trim(),
              phone: newClientPhone.trim(),
              email: newClientEmail.trim() || undefined,
            }
          : undefined,
      displayClientName,
    });
    setSelectedBuildingId(null);
    setShowAddBuilding(false);
    toast.success("Building details saved — continue to next step");
  };

  const handleCreate = () => {
    if (!selectedBuildingId && !pendingNewBuilding) return;
    if (beforePhotos.length < 3) {
      toast.error("Please upload at least 3 before-photos");
      return;
    }
    const finalDescription =
      serviceType === "OTHER" && serviceTypeOther.trim().length > 0
        ? `[Other: ${serviceTypeOther.trim()}]\n${description}`
        : description;
    createOrder.mutate({
      token,
      clientBuildingId: selectedBuildingId ?? undefined,
      quickAddBuilding: pendingNewBuilding
        ? {
            name: pendingNewBuilding.name,
            address: pendingNewBuilding.address,
            clientId: pendingNewBuilding.clientId,
            newClient: pendingNewBuilding.newClient,
          }
        : undefined,
      orderNumberStatus,
      clientOrderNumber: orderNumberStatus === "HAS_NUMBER" ? clientOrderNumber : undefined,
      noOrderReason: orderNumberStatus !== "HAS_NUMBER" ? noOrderReason : undefined,
      serviceType,
      description: finalDescription,
      beforePhotos,
      // Unified pick: the picked Site Lead / Technical Manager / Ops Manager
      // becomes the supervisor of record. The server mirrors this id into
      // `technicalManagerId` **and** `opsManagerId` when the caller didn't
      // supply those separately, so the job appears on that person's
      // statement regardless of which role they hold.
      siteLeadId: selectedSiteLeadId ?? undefined,
    });
  };

  const handleSubmitSsra = () => {
    if (!createdOrderId) return;
    // Prefer the AI-generated set (with BLOCK-criticality gating). Fall back
    // to the static template only if AI generation failed completely.
    if (aiSsra && aiSsra.questions.length > 0) {
      const answers = aiSsra.questions.map((q) => ({
        questionId: q.id,
        answer: (ssraAnswers[q.id] ?? "no") as "yes" | "no",
      }));
      submitSsra.mutate({
        token,
        orderId: createdOrderId,
        answers,
        questions: aiSsra.questions,
        aiGenerated: aiSsra.aiGenerated,
      });
      return;
    }
    if (!ssraTemplate.data) return;
    const answers = ssraTemplate.data.questions.map((q: any) => ({
      questionId: q.id,
      answer: (ssraAnswers[q.id] ?? "no") as "yes" | "no",
    }));
    submitSsra.mutate({ token, orderId: createdOrderId, answers });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/artisan/dashboard" className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Sparkles className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Start a Job</h1>
            <p className="text-xs text-gray-500">Self-initiate a job and complete your SSRA</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Progress */}
        <div className="flex items-center justify-between mb-6 text-xs">
          {([
            { n: 1, label: "Building", icon: Building2 },
            { n: 2, label: "Order #", icon: FileText },
            { n: 3, label: "Job details", icon: ClipboardCheck },
            { n: 4, label: "SSRA", icon: Shield },
            { n: 5, label: "Done", icon: CheckCircle2 },
          ] as const).map((s, i, arr) => {
            const Icon = s.icon;
            const active = step === s.n;
            const done = step > s.n;
            return (
              <div key={s.n} className="flex items-center flex-1">
                <div className={`flex items-center gap-1.5 ${active ? "text-indigo-700" : done ? "text-green-700" : "text-gray-400"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${active ? "bg-indigo-600 text-white" : done ? "bg-green-600 text-white" : "bg-gray-200"}`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="font-medium hidden sm:inline">{s.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${done ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>

        {/* PR-6 — duplicate-job conflict banner */}
        {conflict && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="text-sm font-semibold text-amber-900">A job is already running here</div>
              <p className="text-sm text-amber-800">Order <b>{conflict.orderNumber}</b> was started at this building for the same service in the last 24h.</p>
              {conflict.joinCode && (
                <p className="text-sm text-amber-800">Join it with code <span className="font-mono font-bold tracking-widest bg-white px-2 py-0.5 rounded">{conflict.joinCode}</span></p>
              )}
              <div className="flex gap-2 pt-1">
                <Link to="/artisan/jobs/join" className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded">Join existing job</Link>
                <button onClick={() => setConflict(null)} className="px-3 py-1.5 text-sm border border-amber-400 text-amber-900 rounded">Dismiss</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 — Building */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow border p-5 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Building2 className="w-5 h-5" />Where are you?</h2>

            <div className="relative">
              <Search className="absolute top-3 left-3 w-4 h-4 text-gray-400" />
              <input
                placeholder="Search building, address or client..."
                value={buildingSearch}
                onChange={(e) => setBuildingSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded"
              />
            </div>

            {ctx.isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto my-4" /> : null}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredBuildings.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBuildingId(b.id)}
                  className={`w-full text-left p-3 rounded border ${
                    selectedBuildingId === b.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-gray-600">{b.address}</div>
                  {b.client && <div className="text-xs text-gray-400">{b.client.name}</div>}
                </button>
              ))}
              {filteredBuildings.length === 0 && !ctx.isLoading && (
                <div className="text-sm text-gray-500 text-center py-4">No matches. Try another search.</div>
              )}
            </div>

            {/* Pending new-building banner */}
            {pendingNewBuilding && !showAddBuilding && (
              <div className="p-3 rounded border border-emerald-300 bg-emerald-50 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium text-emerald-900">Using new building: {pendingNewBuilding.name}</div>
                  <div className="text-emerald-700 text-xs">{pendingNewBuilding.address}</div>
                  <div className="text-emerald-700 text-xs">Client: {pendingNewBuilding.displayClientName}</div>
                </div>
                <button
                  onClick={() => { setPendingNewBuilding(null); }}
                  className="text-xs text-emerald-800 underline shrink-0"
                >Clear</button>
              </div>
            )}

            {/* Add-new-building trigger */}
            {!showAddBuilding && !pendingNewBuilding && (
              <button
                onClick={() => { setShowAddBuilding(true); setSelectedBuildingId(null); }}
                className="w-full text-sm px-3 py-2 border-2 border-dashed border-indigo-300 rounded text-indigo-700 hover:bg-indigo-50"
              >+ Building not listed? Add new</button>
            )}

            {/* Add-new-building form */}
            {showAddBuilding && (
              <div className="p-4 border border-indigo-300 rounded bg-indigo-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-indigo-900">Add a new building</h3>
                  <button onClick={() => setShowAddBuilding(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Client</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setAddBuildingClientMode("EXISTING")}
                      className={`flex-1 text-xs px-2 py-1 rounded border ${addBuildingClientMode === "EXISTING" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-gray-300"}`}
                    >Existing client</button>
                    <button
                      onClick={() => setAddBuildingClientMode("NEW")}
                      className={`flex-1 text-xs px-2 py-1 rounded border ${addBuildingClientMode === "NEW" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-gray-300"}`}
                    >New client</button>
                  </div>

                  {addBuildingClientMode === "EXISTING" ? (
                    <select
                      value={addBuildingClientId}
                      onChange={(e) => setAddBuildingClientId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 border rounded text-sm"
                    >
                      <option value="">Select client...</option>
                      {(ctx.data?.clients ?? []).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}{c.companyName ? ` — ${c.companyName}` : ""}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Client name *"
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      <input
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        placeholder="Client phone *"
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      <input
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        placeholder="Client email (optional)"
                        type="email"
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Building name *</label>
                  <input
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    placeholder="e.g. Rosebank Towers"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Building address *</label>
                  <input
                    value={newBuildingAddress}
                    onChange={(e) => setNewBuildingAddress(e.target.value)}
                    placeholder="Street, suburb, city"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>

                <button
                  disabled={!canSaveNewBuilding}
                  onClick={confirmNewBuilding}
                  className="w-full px-3 py-2 bg-indigo-600 text-white rounded text-sm disabled:opacity-50"
                >Use this building</button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={!canNextFromStep1}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
              >Next <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* STEP 2 — Order number */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow border p-5 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5" />Client order number</h2>

            <div className="grid grid-cols-1 gap-2">
              {[
                { v: "HAS_NUMBER", t: "I have the client's official PO/order number" },
                { v: "PENDING_FROM_CLIENT", t: "Client will send it later" },
                { v: "NO_ORDER_REQUIRED", t: "No order number required for this client" },
              ].map((o) => (
                <label key={o.v} className={`flex items-center gap-2 p-3 border rounded cursor-pointer ${orderNumberStatus === o.v ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <input
                    type="radio"
                    name="ons"
                    value={o.v}
                    checked={orderNumberStatus === o.v}
                    onChange={() => setOrderNumberStatus(o.v as any)}
                  />
                  <span className="text-sm">{o.t}</span>
                </label>
              ))}
            </div>

            {orderNumberStatus === "HAS_NUMBER" ? (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Client order number</label>
                <input
                  value={clientOrderNumber}
                  onChange={(e) => setClientOrderNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g. PO-2025-1234"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  {orderNumberStatus === "PENDING_FROM_CLIENT" ? "Who promised the number & when?" : "Why is no order number needed?"}
                </label>
                <textarea
                  value={noOrderReason}
                  onChange={(e) => setNoOrderReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded h-20"
                  placeholder="Briefly explain..."
                />
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-4 py-2 border rounded">Back</button>
              <button
                disabled={!canNextFromStep2}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
              >Next <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* STEP 3 — Job details */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow border p-5 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardCheck className="w-5 h-5" />Job details</h2>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Service type</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">— select —</option>
                {(ctx.data?.serviceTypes ?? ["PLUMBING","ELECTRICAL","HVAC","PAINTING","CARPENTRY","GENERAL","OTHER"]).map((t: string) => (
                  <option key={t} value={t}>{t === "OTHER" ? "OTHER (specify)" : t}</option>
                ))}
              </select>
              {serviceType === "OTHER" && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Please specify what work <span className="text-red-600">*</span></label>
                  <input
                    value={serviceTypeOther}
                    onChange={(e) => setServiceTypeOther(e.target.value)}
                    placeholder="e.g. Roof waterproofing, Aircon regas..."
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Describe the job</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded h-24"
                placeholder="e.g. Replace leaking geyser in unit 5B"
              />
            </div>

            {selectedBuilding ? (
              <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                Building: <strong>{selectedBuilding.name}</strong> — {selectedBuilding.address}
              </div>
            ) : pendingNewBuilding ? (
              <div className="text-xs text-emerald-700 p-2 bg-emerald-50 rounded">
                New building: <strong>{pendingNewBuilding.name}</strong> — {pendingNewBuilding.address}
              </div>
            ) : null}

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-gray-900">Before-photos <span className="text-red-600">*</span></h3>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Capture at least <b>3 clear photos</b> of the site <b>before</b> you start any work.
                This protects you and the client if there’s a dispute later.
              </p>
              <PhotoUpload
                onPhotosUploaded={setBeforePhotos}
                minimumPhotos={3}
                title="Before-photos"
                description="Upload at least 3 photos of the site before work starts"
                isPublic={true}
                initialUrls={beforePhotos}
              />
              <div className="text-xs mt-2">
                {beforePhotos.length >= 3 ? (
                  <span className="text-green-700">✓ {beforePhotos.length} photo{beforePhotos.length === 1 ? "" : "s"} uploaded</span>
                ) : (
                  <span className="text-amber-700">{beforePhotos.length} / 3 uploaded — upload more to continue</span>
                )}
              </div>
            </div>

            {/* PR-8 F — Unified "Site Lead / Technical Manager / Ops Manager"
                pick. Whoever the artisan picks here becomes the supervisor of
                record and the job lands on their statement automatically. */}
            <div className="border-t pt-4">
              <SiteLeadPicker
                token={token}
                value={selectedSiteLeadId}
                onChange={setSelectedSiteLeadId}
                label="Site Lead / Technical Manager / Ops Manager"
                helpText="Pick your supervisor for this job. This job will land on their statement automatically — no admin approval needed."
              />
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-4 py-2 border rounded">Back</button>
              <button
                disabled={!canNextFromStep3 || createOrder.isPending}
                onClick={handleCreate}
                className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
              >
                {createOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create order & continue to SSRA
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — SSRA */}
        {step === 4 && (
          <div className="bg-white rounded-lg shadow border p-5 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-5 h-5" />Site-Specific Risk Assessment</h2>

            {generateAiSsra.isPending && !aiSsra && (
              <div className="text-sm text-gray-600 flex items-center gap-2 bg-indigo-50 border border-indigo-200 p-3 rounded">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating job-specific safety questions with AI\u2026 (a few seconds)
              </div>
            )}

            {aiSsra && (
              <div className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 p-3 rounded">
                <div className="font-semibold flex items-center gap-1">
                  {aiSsra.aiGenerated ? "AI-generated SSRA" : "Static SSRA fallback"} \u00b7 Job risk profile: {aiSsra.overallRiskProfile}
                </div>
                <div className="mt-1">{aiSsra.jobSummary}</div>
              </div>
            )}

            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                Answer honestly. Questions marked <b>BLOCK</b> are essential safety controls (e.g. PPE, permits, competencies) \u2014
                you cannot start the job until they are satisfied. Questions marked <b>WARN</b> automatically add a risk item to
                your SSRA record for compliance.
              </span>
            </div>

            {ssraBlockers.length > 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded p-3 text-sm">
                <div className="font-semibold text-red-800 flex items-center gap-1 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Cannot start job \u2014 fix these critical safety items first:
                </div>
                <ul className="list-disc pl-5 space-y-1 text-red-900">
                  {ssraBlockers.map((b) => (
                    <li key={b.id}>
                      <b>{b.prompt}</b> \u2014 required answer: <b>{b.required.toUpperCase()}</b>
                      {b.rationale ? <div className="text-xs text-red-700">{b.rationale}</div> : null}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-xs text-red-700">
                  Put on required PPE / obtain the required permit / bring a competent person on site, then update your answers below.
                </div>
              </div>
            )}

            {(!aiSsra && ssraTemplate.isLoading) && <Loader2 className="w-6 h-6 animate-spin mx-auto my-4" />}

            {/* AI-generated question set (preferred) */}
            {aiSsra && (
              <div className="space-y-3">
                {aiSsra.questions.map((q) => {
                  const answered = ssraAnswers[q.id];
                  const isSafe = answered && answered === q.safeAnswer;
                  const isUnsafe = answered && answered !== q.safeAnswer;
                  const isBlocker = ssraBlockers.some((b) => b.id === q.id);
                  return (
                    <div
                      key={q.id}
                      className={`border rounded p-3 ${isBlocker ? "border-red-400 bg-red-50" : isUnsafe ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium">{q.prompt}</p>
                        <div className="flex gap-1 flex-shrink-0">
                          {q.category ? (
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                              {q.category}
                            </span>
                          ) : null}
                          <span
                            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                              q.criticality === "BLOCK"
                                ? "bg-red-100 border-red-300 text-red-800"
                                : "bg-yellow-100 border-yellow-300 text-yellow-800"
                            }`}
                            title={q.criticality === "BLOCK" ? "Essential safety control \u2014 must be satisfied to start" : "Good practice \u2014 auto-logged as a risk item if unsafe"}
                          >
                            {q.criticality}
                          </span>
                        </div>
                      </div>
                      {q.rationale ? (
                        <p className="text-xs text-gray-600 mb-2">{q.rationale}</p>
                      ) : null}
                      <div className="flex gap-2 items-center">
                        {(["yes", "no"] as const).map((v) => {
                          const isSelected = answered === v;
                          const isSafeChoice = v === q.safeAnswer;
                          return (
                            <button
                              key={v}
                              onClick={() => setSsraAnswers((a) => ({ ...a, [q.id]: v }))}
                              className={`px-4 py-1.5 text-sm rounded border font-medium ${
                                isSelected
                                  ? isSafeChoice
                                    ? "bg-green-100 border-green-500 text-green-800"
                                    : "bg-red-100 border-red-500 text-red-800"
                                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {v.toUpperCase()}
                            </button>
                          );
                        })}
                        <span className="text-xs text-gray-400 ml-1">
                          safe: <b>{q.safeAnswer.toUpperCase()}</b>
                        </span>
                        {isSafe ? <span className="text-xs text-green-700">\u2713 safe</span> : null}
                        {isUnsafe ? (
                          <span className={`text-xs ${q.criticality === "BLOCK" ? "text-red-700 font-semibold" : "text-amber-700"}`}>
                            {q.criticality === "BLOCK" ? "\u26a0 will block start" : "\u26a0 will add a risk item"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legacy static template fallback (rendered only when AI generation is unavailable AND aiSsra is null) */}
            {!aiSsra && !generateAiSsra.isPending && ssraTemplate.data && (
              <div className="space-y-3">
                {ssraTemplate.data.questions.map((q: any) => (
                  <div key={q.id} className="border rounded p-3">
                    <p className="text-sm font-medium mb-2">{q.prompt}</p>
                    <div className="flex gap-2">
                      {(["yes", "no"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setSsraAnswers((a) => ({ ...a, [q.id]: v }))}
                          className={`px-4 py-1.5 text-sm rounded border ${
                            ssraAnswers[q.id] === v
                              ? v === "yes" ? "bg-red-100 border-red-400 text-red-800" : "bg-green-100 border-green-400 text-green-800"
                              : "bg-white border-gray-300"
                          }`}
                        >{v.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={submitSsra.isPending || (!aiSsra && !ssraTemplate.data)}
                onClick={handleSubmitSsra}
                className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
              >
                {submitSsra.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit SSRA & finish
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 — Done */}
        {step === 5 && (
          <div className="bg-white rounded-lg shadow border p-8 space-y-4 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <h2 className="text-xl font-bold">Order {createdOrderNumber} is live — you can start working now</h2>
            <p className="text-sm text-gray-600">Your SSRA is submitted and the job is <b>In Progress</b>. Do the work, then complete the job from your dashboard. Admin & TM review happens <b>after</b> you complete — you don’t need to wait for approval to start.</p>
            {createdJoinCode && (
              <div className="mx-auto max-w-xs p-4 border-2 border-dashed border-indigo-300 rounded-lg bg-indigo-50">
                <div className="text-xs uppercase tracking-wider text-indigo-700 mb-1">Crew join code</div>
                <div className="text-3xl font-mono font-bold tracking-widest text-indigo-900">{createdJoinCode}</div>
                <p className="text-xs text-gray-600 mt-2">Share with crew members so they can join this job from their phones.</p>
              </div>
            )}
            <div className="flex justify-center gap-2">
              <Link to="/artisan/dashboard" className="px-4 py-2 bg-indigo-600 text-white rounded">Back to dashboard</Link>
              <button onClick={() => { setStep(1); setSelectedBuildingId(null); setOrderNumberStatus("PENDING_FROM_CLIENT"); setClientOrderNumber(""); setNoOrderReason(""); setServiceType(""); setDescription(""); setSsraAnswers({}); setCreatedOrderId(null); setCreatedOrderNumber(""); setCreatedJoinCode(""); }} className="px-4 py-2 border rounded">Start another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
