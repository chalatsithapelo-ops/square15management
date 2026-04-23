import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { CheckCircle2, Clock, Calendar, MessageSquare, Briefcase, XCircle, Loader2, Award } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/candidate/$token")({
  component: CandidatePortalPage,
});

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
                <div className="whitespace-pre-wrap">{m.body}</div>
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
