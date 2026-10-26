import { createFileRoute, Link } from "@tanstack/react-router";
import { useTRPC } from "~/trpc/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/careers/find-my-application")({
  component: FindMyApplicationPage,
});

function FindMyApplicationPage() {
  const trpc = useTRPC();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const mut = useMutation(
    trpc.sendPortalLinkAllChannels.mutationOptions({
      onSuccess: () => setSent(true),
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border p-8 max-w-md w-full">
        <div className="text-center mb-4">
          <Mail className="w-12 h-12 text-teal-500 mx-auto mb-2" />
          <h1 className="text-xl font-bold">Find my application</h1>
          <p className="text-sm text-gray-600 mt-1">
            We'll send your candidate portal link to the email, WhatsApp and SMS on your application.
          </p>
        </div>
        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-emerald-900">
              If your email is on file, we've just sent your portal link to all channels we have on record. Check WhatsApp / SMS / email.
            </p>
            <p className="text-[11px] text-emerald-800 mt-2">
              (You can request this up to 3 times per day.)
            </p>
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
            />
            <button
              onClick={() => {
                if (!email.includes("@")) return toast.error("Enter a valid email");
                mut.mutate({ email });
              }}
              disabled={mut.isPending}
              className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {mut.isPending ? "Sending…" : "Send portal link"}
            </button>
            <p className="text-[11px] text-gray-500 text-center mt-3">
              For your security we don't confirm whether the email exists — a link is only sent if we have a matching application.
            </p>
          </>
        )}
        <div className="mt-5 text-center">
          <Link to="/careers" className="text-sm text-teal-600 hover:underline">← Back to jobs</Link>
        </div>
      </div>
    </div>
  );
}
