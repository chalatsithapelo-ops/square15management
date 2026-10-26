import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/verify-employment/$token")({
  component: EmploymentVerificationPage,
});

function EmploymentVerificationPage() {
  const { token } = Route.useParams();
  const trpc = useTRPC();
  const q = useQuery(
    trpc.getEmploymentVerificationByToken.queryOptions({ token }, { retry: false }),
  );
  const mut = useMutation(
    trpc.submitEmploymentVerification.mutationOptions({
      onSuccess: () => toast.success("Thank you — response recorded."),
      onError: (e) => toast.error(e.message),
    }),
  );
  const [confirm, setConfirm] = useState<"yes" | "no" | null>(null);
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");

  if (q.isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const d = q.data as any;
  if (!d) return <div className="min-h-screen flex items-center justify-center text-gray-500">Link invalid or expired.</div>;

  if (d.responded || mut.isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-xl border p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h1 className="mt-3 text-lg font-semibold">Thank you</h1>
          <p className="mt-2 text-sm text-gray-600">Your employment verification has been recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        <div className="bg-gradient-to-r from-green-800 to-green-700 text-white rounded-t-xl p-6">
          <h1 className="text-xl font-bold">Employment verification</h1>
          <p className="text-sm text-green-100 mt-1">Confirm the details for {d.candidateName}</p>
        </div>
        <div className="bg-white border rounded-b-xl p-6 space-y-5">
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
            <div><span className="text-gray-500">Employer:</span> <strong>{d.employerName}</strong></div>
            {d.claimedRole && <div><span className="text-gray-500">Claimed role:</span> <strong>{d.claimedRole}</strong></div>}
            {d.claimedStart && <div><span className="text-gray-500">Claimed start:</span> {new Date(d.claimedStart).toLocaleDateString()}</div>}
            {d.claimedEnd && <div><span className="text-gray-500">Claimed end:</span> {new Date(d.claimedEnd).toLocaleDateString()}</div>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Can you confirm these details are correct?</label>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm("yes")}
                className={`flex-1 px-4 py-3 rounded-lg border font-medium ${confirm === "yes" ? "bg-emerald-100 border-emerald-400 text-emerald-800" : "bg-white text-gray-700"}`}
              >
                Yes — details match our records
              </button>
              <button
                onClick={() => setConfirm("no")}
                className={`flex-1 px-4 py-3 rounded-lg border font-medium ${confirm === "no" ? "bg-red-100 border-red-400 text-red-800" : "bg-white text-gray-700"}`}
              >
                No — discrepancy
              </button>
            </div>
          </div>
          {confirm === "no" && (
            <div>
              <label className="block text-sm font-semibold mb-1">Correct role title (if different)</label>
              <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button
            disabled={confirm === null || mut.isPending}
            onClick={() =>
              mut.mutate({
                token,
                confirmClaimed: confirm === "yes",
                confirmedRole: role || undefined,
                responseNotes: notes || undefined,
              })
            }
            className="w-full px-4 py-3 bg-green-700 hover:bg-green-800 text-yellow-400 rounded-lg font-semibold disabled:opacity-50"
          >
            {mut.isPending ? "Submitting…" : "Submit response"}
          </button>
          <p className="text-[11px] text-gray-400 text-center">Your response is stored securely and used only for this hiring decision under POPIA.</p>
        </div>
      </div>
    </div>
  );
}
