import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import { ClipboardList, Loader2, Pen, Check, AlertTriangle, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/tenant/inspection/$token")({
  component: TenantInspectionSignPage,
});

const COND_COLOR: Record<string, string> = {
  EXCELLENT: "bg-green-100 text-green-800",
  GOOD: "bg-emerald-100 text-emerald-800",
  FAIR: "bg-yellow-100 text-yellow-800",
  POOR: "bg-orange-100 text-orange-800",
  DAMAGED: "bg-red-100 text-red-800",
  MISSING: "bg-red-200 text-red-900",
};

function TenantInspectionSignPage() {
  const { token: signToken } = Route.useParams();
  const trpc = useTRPC();
  const detail = useQuery(trpc.getInspectionByToken.queryOptions({ token: signToken }));
  const insp: any = detail.data;

  const [decision, setDecision] = useState<"accept" | "dispute">("accept");
  const [disputeNotes, setDisputeNotes] = useState("");
  const [signerName, setSignerName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const submit = useMutation(trpc.submitTenantSignature.mutationOptions({
    onSuccess: () => {
      toast.success("Thank you — your response has been recorded.");
      setSubmitted(true);
    },
    onError: (e) => toast.error(e.message),
  }));

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1f2937";
    ctx.lineCap = "round";
  }, []);

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getCanvasPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = () => { drawing.current = false; };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const onSubmit = () => {
    if (!signerName.trim()) return toast.error("Please type your full name");
    if (decision === "dispute" && !disputeNotes.trim()) return toast.error("Please describe the dispute");
    const canvas = canvasRef.current!;
    // detect blank canvas
    const ctx = canvas.getContext("2d")!;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasInk = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) { hasInk = true; break; }
    }
    if (!hasInk) return toast.error("Please sign in the box");
    const signatureDataUrl = canvas.toDataURL("image/png");
    submit.mutate({
      token: signToken,
      signerName: signerName.trim(),
      signatureDataUrl,
      decision,
      disputeNotes: decision === "dispute" ? disputeNotes : undefined,
    });
  };

  if (detail.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  if (detail.error || !insp) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border rounded-lg max-w-md w-full p-6 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-red-600 mb-2" />
          <h1 className="text-lg font-semibold">Link invalid or expired</h1>
          <p className="text-sm text-gray-600 mt-1">Please contact your property manager for a new link.</p>
        </div>
      </div>
    );
  }

  if (submitted || insp.tenantSignedAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border rounded-lg max-w-md w-full p-6 text-center">
          <Check className="w-10 h-10 mx-auto text-green-600 mb-2" />
          <h1 className="text-lg font-semibold">Thank you</h1>
          <p className="text-sm text-gray-600 mt-1">Your signature was recorded. Your property manager will be in touch.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold font-mono">{insp.inspectionNumber}</h1>
            <p className="text-xs text-gray-500">{insp.type} inspection · {insp.building?.name}{insp.unitNumber ? ` · Unit ${insp.unitNumber}` : ""}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          Please review the inspection findings below. If you agree, sign and submit. If you dispute any finding, choose <strong>Dispute</strong> and describe the issue — the property manager will follow up.
        </div>

        {insp.rooms?.map((r: any) => (
          <div key={r.id} className="bg-white rounded-lg border p-3">
            <div className="font-semibold text-sm mb-2">{r.name}</div>
            {r.notes && <div className="text-xs italic text-gray-600 mb-2">{r.notes}</div>}
            <div className="space-y-1">
              {r.items?.map((it: any) => (
                <div key={it.id} className="flex items-center justify-between text-xs border-b last:border-0 py-1">
                  <div className="flex-1">
                    <div className="font-medium">{it.name}</div>
                    {it.notes && <div className="text-gray-600">{it.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {it.damageCost && <span className="text-red-700">R{Number(it.damageCost).toLocaleString()}</span>}
                    {it.condition && (
                      <span className={`px-1.5 py-0.5 rounded ${COND_COLOR[it.condition] ?? "bg-gray-100"}`}>{it.condition}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {insp.totalDamageCost && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <div className="text-xs uppercase text-red-700 mb-1">Estimated damage</div>
            <div className="text-xl font-bold text-red-900">R {Number(insp.totalDamageCost).toLocaleString()}</div>
          </div>
        )}

        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Pen className="w-4 h-4" /> Sign-off</h2>
          <div className="flex gap-2">
            <button onClick={() => setDecision("accept")} className={`flex-1 px-3 py-2 rounded border ${decision === "accept" ? "bg-green-600 text-white border-green-600" : "bg-white"}`}>I accept</button>
            <button onClick={() => setDecision("dispute")} className={`flex-1 px-3 py-2 rounded border ${decision === "dispute" ? "bg-red-600 text-white border-red-600" : "bg-white"}`}>I dispute</button>
          </div>
          {decision === "dispute" && (
            <textarea
              value={disputeNotes}
              onChange={(e) => setDisputeNotes(e.target.value)}
              placeholder="Describe what you dispute…"
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          )}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Your full name</label>
            <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Sign below</label>
            <div className="border rounded bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={180}
                className="w-full touch-none"
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
              />
            </div>
            <button onClick={clearCanvas} className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600"><RefreshCcw className="w-3 h-3" /> Clear</button>
          </div>
          <button
            onClick={onSubmit}
            disabled={submit.isPending}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded font-medium disabled:opacity-50"
          >
            {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
            Submit signature
          </button>
        </div>
      </div>
    </div>
  );
}
