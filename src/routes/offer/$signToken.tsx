import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Award, FileText, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/offer/$signToken")({
  component: OfferSignPage,
});

function formatComp(o: any): string {
  const parts: string[] = [];
  if (o.monthlySalary) parts.push(`${o.currency} ${Number(o.monthlySalary).toLocaleString()} / month`);
  if (o.dailyRate) parts.push(`${o.currency} ${Number(o.dailyRate).toLocaleString()} / day`);
  if (o.hourlyRate) parts.push(`${o.currency} ${Number(o.hourlyRate).toLocaleString()} / hour`);
  if (parts.length === 0 && o.baseSalary) parts.push(`${o.currency} ${Number(o.baseSalary).toLocaleString()} / ${(o.salaryPeriod ?? "").toLowerCase()}`);
  return parts.join("  +  ");
}

function OfferSignPage() {
  const { signToken } = Route.useParams();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(trpc.getOfferByToken.queryOptions({ signToken }));
  const [agreed, setAgreed] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [responded, setResponded] = useState<null | "ACCEPTED" | "DECLINED">(null);

  const acceptMut = useMutation(
    trpc.acceptOffer.mutationOptions({
      onSuccess: () => { setResponded("ACCEPTED"); toast.success("Offer accepted — welcome aboard!"); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const declineMut = useMutation(
    trpc.declineOffer.mutationOptions({
      onSuccess: () => { setResponded("DECLINED"); toast.success("Response recorded"); qc.invalidateQueries({ queryKey: trpc.getOfferByToken.queryKey({ signToken }) }); },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (q.isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>;
  const offer = q.data as any;
  if (!offer) return <div className="min-h-screen flex items-center justify-center text-gray-500">Offer not found.</div>;

  const currentStatus = responded ?? offer.status;

  if (currentStatus === "ACCEPTED") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Offer accepted</h1>
          <p className="text-sm text-gray-600">
            Welcome aboard, {offer.application?.firstName}! Our HR team will be in touch shortly to arrange the official contract signing and onboarding.
          </p>
        </div>
      </div>
    );
  }
  if (currentStatus === "DECLINED" || currentStatus === "WITHDRAWN") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Response recorded</h1>
          <p className="text-sm text-gray-600">Thank you for letting us know. We wish you the very best.</p>
        </div>
      </div>
    );
  }

  const expired = offer.expiresAt && new Date(offer.expiresAt) < new Date();
  if (expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Offer expired</h1>
          <p className="text-sm text-gray-600">Please contact the recruiter for a fresh offer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Award className="w-10 h-10 mb-2" />
          <h1 className="text-2xl font-bold">You have an offer!</h1>
          <p className="text-orange-100 mt-1">{offer.application?.firstName} {offer.application?.lastName} — {offer.application?.job?.title}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Offer details</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-gray-500">Role</div><div className="font-medium">{offer.title}</div></div>
            <div className="col-span-2"><div className="text-xs text-gray-500">Compensation</div><div className="font-medium text-emerald-700">{formatComp(offer)}</div></div>
            <div><div className="text-xs text-gray-500">Start date</div><div className="font-medium">{offer.startDate ? new Date(offer.startDate).toLocaleDateString() : "—"}</div></div>
            <div><div className="text-xs text-gray-500">Offer expires</div><div className="font-medium">{offer.expiresAt ? new Date(offer.expiresAt).toLocaleDateString() : "—"}</div></div>
            {offer.bonus ? (
              <div><div className="text-xs text-gray-500">Bonus</div><div className="font-medium">{offer.currency} {Number(offer.bonus).toLocaleString()}</div></div>
            ) : null}
          </div>
          {offer.benefits && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-1">Benefits</div>
              <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{offer.benefits}</div>
            </div>
          )}
          {offer.otherTerms && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">Terms</div>
              <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{offer.otherTerms}</div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Accept or decline</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
            You are accepting this offer <b>in principle</b>. The <b>official contract signing</b> will happen once you have been onboarded — HR will schedule that with you and share the full employment contract for your signature at that time.
          </div>

          {!showDecline ? (
            <>
              <label className="flex gap-2 text-sm">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>I have read the offer above and wish to accept it. I understand HR will contact me to arrange the official contract signing.</span>
              </label>

              <div className="flex gap-2 mt-5">
                <button
                  disabled={!agreed || acceptMut.isPending}
                  onClick={() => acceptMut.mutate({
                    signToken,
                    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                  })}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {acceptMut.isPending ? "Submitting…" : "Accept offer"}
                </button>
                <button onClick={() => setShowDecline(true)} className="px-4 py-3 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Decline
                </button>
              </div>
            </>
          ) : (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <label className="text-xs font-semibold text-red-900 block mb-1">Reason for declining <span className="text-red-600">*</span></label>
              <p className="text-[11px] text-red-700 mb-2">A reason is required. This helps us improve our recruitment process.</p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full border border-red-300 rounded px-2 py-2 text-sm bg-white"
                rows={4}
                placeholder="Please share your reason (min 10 characters)"
              />
              <div className="text-[11px] text-red-600 mt-1">{declineReason.length}/10 characters min</div>
              <div className="flex gap-2 mt-3">
                <button
                  disabled={declineReason.trim().length < 10 || declineMut.isPending}
                  onClick={() => declineMut.mutate({ signToken, reason: declineReason.trim() })}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold disabled:opacity-50"
                >
                  {declineMut.isPending ? "Submitting…" : "Confirm decline"}
                </button>
                <button onClick={() => { setShowDecline(false); setDeclineReason(""); }} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
