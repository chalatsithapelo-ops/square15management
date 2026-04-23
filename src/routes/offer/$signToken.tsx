import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Award, FileText, Shield } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/offer/$signToken")({
  component: OfferSignPage,
});

function OfferSignPage() {
  const { signToken } = Route.useParams();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(trpc.getOfferByToken.queryOptions({ signToken }));
  const [signatureName, setSignatureName] = useState("");
  const [initials, setInitials] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [signed, setSigned] = useState(false);

  const acceptMut = useMutation(
    trpc.acceptOffer.mutationOptions({
      onSuccess: () => { setSigned(true); toast.success("Offer accepted — welcome aboard!"); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const declineMut = useMutation(
    trpc.declineOffer.mutationOptions({
      onSuccess: () => { toast.success("Offer declined"); qc.invalidateQueries({ queryKey: trpc.getOfferByToken.queryKey({ signToken }) }); },
    }),
  );

  if (q.isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>;
  const offer = q.data as any;
  if (!offer) return <div className="min-h-screen flex items-center justify-center text-gray-500">Offer not found.</div>;

  if (signed || offer.status === "ACCEPTED") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Offer accepted</h1>
          <p className="text-sm text-gray-600">Congratulations, {offer.application?.firstName}! We'll be in touch with onboarding details shortly.</p>
        </div>
      </div>
    );
  }
  if (offer.status === "DECLINED" || offer.status === "WITHDRAWN") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Offer {offer.status.toLowerCase()}</h1>
          <p className="text-sm text-gray-600">This offer is no longer active.</p>
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
          <p className="text-sm text-gray-600">Please contact the recruiter.</p>
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
            <div><div className="text-xs text-gray-500">Title</div><div className="font-medium">{offer.title}</div></div>
            <div><div className="text-xs text-gray-500">Salary</div><div className="font-medium">{offer.currency} {offer.baseSalary?.toLocaleString()} / {offer.salaryPeriod}</div></div>
            <div><div className="text-xs text-gray-500">Start date</div><div className="font-medium">{offer.startDate ? new Date(offer.startDate).toLocaleDateString() : "—"}</div></div>
            <div><div className="text-xs text-gray-500">Bonus</div><div className="font-medium">{offer.bonus ? `${offer.currency} ${offer.bonus.toLocaleString()}` : "—"}</div></div>
            <div><div className="text-xs text-gray-500">Offer expires</div><div className="font-medium">{offer.expiresAt ? new Date(offer.expiresAt).toLocaleDateString() : "—"}</div></div>
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
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Sign & accept</h2>
          <p className="text-xs text-gray-500 mb-4">
            By typing your full name and initials below, you agree this constitutes your electronic signature under ECTA (Electronic Communications and Transactions Act 2002). A legally binding audit log is recorded.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Full legal name</label>
              <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-serif italic" placeholder="e.g. Jane Doe" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Initials</label>
              <input value={initials} onChange={(e) => setInitials(e.target.value.toUpperCase())} maxLength={5} className="w-28 border rounded-lg px-3 py-2 text-sm font-serif italic tracking-widest" placeholder="JD" />
            </div>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I have read and accept the terms of this offer letter.</span>
            </label>
          </div>

          <div className="flex gap-2 mt-5">
            <button
              disabled={!signatureName || !initials || !agreed || acceptMut.isPending}
              onClick={() => acceptMut.mutate({
                signToken,
                signatureName,
                initials,
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

          {showDecline && (
            <div className="mt-4 p-4 border rounded-lg bg-red-50">
              <label className="text-xs text-gray-600">Optional — reason for declining</label>
              <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className="w-full border rounded px-2 py-1 text-sm mt-1" rows={2} />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => declineMut.mutate({ signToken, reason: declineReason || undefined })}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm"
                >Confirm decline</button>
                <button onClick={() => setShowDecline(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
