import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/careers/resend-link")({
  component: ResendLinkPage,
});

function ResendLinkPage() {
  const trpc = useTRPC();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const resendMut = useMutation(
    trpc.resendCandidatePortalLink.mutationOptions({
      onSuccess: (res) => {
        setSubmitted(true);
        setMessage(res.message);
      },
      onError: () => {
        // Even on error surface a generic response so we do not leak whether
        // the email exists.
        setSubmitted(true);
        setMessage("If we found an application for that email, we sent a fresh link.");
      },
    }),
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-md mx-auto px-6 py-12">
        <Link to="/careers" className="text-sm text-teal-700 hover:text-teal-800 flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to careers
        </Link>
        <div className="bg-white rounded-2xl border shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-50 text-teal-700 mb-3">
              <Mail className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Resend application link</h1>
            <p className="text-sm text-gray-500 mt-2">
              Enter the email address you applied with and we&apos;ll send you a fresh link to your candidate portal.
            </p>
          </div>

          {submitted ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm text-emerald-800 font-medium">{message}</p>
              <p className="text-xs text-emerald-700 mt-2">
                If you don&apos;t see it within a few minutes, check your spam folder.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) resendMut.mutate({ email: email.trim() });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={!email || resendMut.isPending}
                className="w-full rounded-lg bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resendMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Send me a fresh link
              </button>
              <p className="text-xs text-gray-500 text-center">
                For security, we don&apos;t confirm whether an email is on file. If you have an active application, a link will be sent within 5 minutes.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
