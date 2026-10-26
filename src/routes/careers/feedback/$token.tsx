import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { ArrowLeft, Star, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/careers/feedback/$token")({
  component: FeedbackPage,
});

function FeedbackPage() {
  const { token } = Route.useParams();
  const trpc = useTRPC();
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [wouldReapply, setWouldReapply] = useState<boolean | null>(null);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackMut = useMutation(
    trpc.submitRejectionFeedback.mutationOptions({
      onSuccess: () => setSubmitted(true),
    }),
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-lg mx-auto px-6 py-12">
        <Link to="/careers" className="text-sm text-teal-700 hover:text-teal-800 flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to careers
        </Link>

        <div className="bg-white rounded-2xl border shadow-sm p-8">
          {submitted ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto mb-3" />
              <h1 className="text-xl font-semibold text-gray-900">Thank you for your feedback</h1>
              <p className="text-sm text-gray-500 mt-2">
                We appreciate you taking the time to help us improve our hiring process.
              </p>
              <Link to="/careers" className="inline-block mt-4 text-sm text-teal-700 hover:text-teal-800">
                Browse open roles →
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">How was your experience?</h1>
                <p className="text-sm text-gray-500 mt-2">
                  We&apos;re sorry things didn&apos;t work out this time. Your feedback helps us improve our process for future candidates.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (rating < 1 || wouldReapply === null) return;
                  feedbackMut.mutate({
                    accessToken: token,
                    rating,
                    wouldReapply,
                    comments: comments || undefined,
                  });
                }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overall, how would you rate your experience?
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        type="button"
                        key={n}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => setRating(n)}
                        className="p-1"
                        aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      >
                        <Star
                          className={`w-8 h-8 transition ${
                            (hover || rating) >= n
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Would you consider applying to us again in the future?
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWouldReapply(true)}
                      className={`flex-1 py-2 rounded-lg border font-medium text-sm ${
                        wouldReapply === true
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white border-gray-300 text-gray-700 hover:border-teal-400"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setWouldReapply(false)}
                      className={`flex-1 py-2 rounded-lg border font-medium text-sm ${
                        wouldReapply === false
                          ? "bg-slate-800 text-white border-slate-800"
                          : "bg-white border-gray-300 text-gray-700 hover:border-slate-500"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional comments (optional)
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={4}
                    placeholder="What could we have done better? Anything you want us to know?"
                    maxLength={2000}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="text-xs text-gray-400 text-right mt-1">{comments.length}/2000</div>
                </div>

                {feedbackMut.isError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {(feedbackMut.error as any)?.message ?? "Something went wrong. Please try again."}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={rating < 1 || wouldReapply === null || feedbackMut.isPending}
                  className="w-full rounded-lg bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {feedbackMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit feedback
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
