import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/reference/$token")({
  component: ReferenceQuestionnairePage,
});

function ReferenceQuestionnairePage() {
  const { token } = Route.useParams();
  const trpc = useTRPC();
  const q = useQuery(
    trpc.getReferenceQuestionnaireByToken.queryOptions({ token }, { retry: false }),
  );
  const submitMut = useMutation(
    trpc.submitReferenceQuestionnaire.mutationOptions({
      onSuccess: () => toast.success("Thank you — reference submitted."),
      onError: (e) => toast.error(e.message),
    }),
  );
  const [rehire, setRehire] = useState<number>(8);
  const [attendance, setAttendance] = useState<number>(3);
  const [conflict, setConflict] = useState<number>(3);
  const [strength, setStrength] = useState("");
  const [dev, setDev] = useState("");
  const [notes, setNotes] = useState("");

  if (q.isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const d = q.data as any;
  if (!d) return <div className="min-h-screen flex items-center justify-center text-gray-500">Link invalid or expired.</div>;

  if (d.completed || submitMut.isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-xl border p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Thank you</h1>
          <p className="mt-2 text-sm text-gray-600">Your reference for {d.candidateName} has been recorded. We appreciate your time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-r from-green-800 to-green-700 text-white rounded-t-xl p-6">
          <h1 className="text-xl font-bold">Reference for {d.candidateName}</h1>
          <p className="text-sm text-green-100 mt-1">{d.jobTitle}</p>
        </div>
        <div className="bg-white border rounded-b-xl p-6 space-y-5">
          <p className="text-sm text-gray-600">Hi {d.refereeName}, thank you for taking a few minutes to help us make a good decision. Your responses are confidential and used only for hiring.</p>

          <div>
            <label className="block text-sm font-semibold mb-1">On a scale of 1–10, would you rehire this person?</label>
            <input
              type="range"
              min={1}
              max={10}
              value={rehire}
              onChange={(e) => setRehire(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-sm mt-1 flex items-center gap-2">
              <span className="text-2xl font-bold text-green-700">{rehire}</span><span className="text-gray-500">/10</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Top strength (one sentence)</label>
            <input
              type="text"
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Very reliable, always delivered on deadline"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Biggest development area (one sentence)</label>
            <input
              type="text"
              value={dev}
              onChange={(e) => setDev(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Would benefit from more confidence in presentations"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Attendance & punctuality (1 = poor, 5 = excellent)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setAttendance(n)}
                  className={`w-10 h-10 rounded-full border font-semibold ${attendance === n ? "bg-green-700 text-white" : "bg-white text-gray-700"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">How did they handle mistakes or conflict? (1–5)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setConflict(n)}
                  className={`w-10 h-10 rounded-full border font-semibold ${conflict === n ? "bg-green-700 text-white" : "bg-white text-gray-700"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Anything else you'd like us to know? (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            disabled={submitMut.isPending || strength.trim().length < 3 || dev.trim().length < 3}
            onClick={() =>
              submitMut.mutate({
                token,
                rehireRating: rehire,
                topStrength: strength,
                developmentArea: dev,
                attendanceRating: attendance,
                conflictHandlingRating: conflict,
                additionalComments: notes || undefined,
              })
            }
            className="w-full px-4 py-3 bg-green-700 hover:bg-green-800 text-yellow-400 rounded-lg font-semibold disabled:opacity-50"
          >
            {submitMut.isPending ? "Submitting…" : "Submit reference"}
          </button>
          <p className="text-[11px] text-gray-400 text-center">Your responses are stored securely and used only for this hiring decision under POPIA.</p>
        </div>
      </div>
    </div>
  );
}
