import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Upload, FileText, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/background/$token")({
  component: BackgroundUploadPage,
});

const CHECK_LABELS: Record<string, string> = {
  CRIMINAL: "Criminal record clearance",
  CREDIT: "Credit report",
  QUALIFICATION: "Qualifications / certificates",
  REFERENCE: "Reference letters",
  OTHER: "Other supporting document",
};

function BackgroundUploadPage() {
  const { token } = Route.useParams();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(trpc.getBackgroundCheckByToken.queryOptions({ uploadToken: token }));

  const uploadMut = useMutation(
    trpc.uploadBackgroundCheckDocument.mutationOptions({
      onSuccess: () => {
        toast.success("Uploaded — thank you!");
        qc.invalidateQueries({ queryKey: trpc.getBackgroundCheckByToken.queryKey({ uploadToken: token }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>;
  }
  const bg = q.data as any;
  if (!bg) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Link not found or expired.</div>;
  }

  const handleFile = (checkType: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] ?? "";
      uploadMut.mutate({
        uploadToken: token,
        checkType,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileBase64: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <ShieldCheck className="w-10 h-10 mb-2" />
          <h1 className="text-2xl font-bold">Upload your background-check documents</h1>
          <p className="text-emerald-100 mt-1">
            Hi {bg.application?.firstName} — please upload the documents requested below.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {bg.status === "COMPLETED" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> All checks are complete. No further action needed.
          </div>
        )}

        {(bg.checkTypes as string[]).map((t) => {
          const uploaded = ((bg.documents ?? []) as any[]).filter((d) => d.checkType === t);
          return (
            <div key={t} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{CHECK_LABELS[t] ?? t}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {uploaded.length === 0
                      ? "No documents uploaded yet"
                      : `${uploaded.length} document(s) uploaded`}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-teal-300 text-teal-700 rounded-lg cursor-pointer hover:bg-teal-50 text-sm">
                  <Upload className="w-4 h-4" />
                  Upload
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(t, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {uploaded.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploaded.map((d) => (
                    <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">{d.fileName}</span>
                      </div>
                      {d.decision === "APPROVED" ? (
                        <span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Approved</span>
                      ) : d.decision === "REJECTED" ? (
                        <span className="text-red-700 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Rejected</span>
                      ) : (
                        <span className="text-gray-500">Under review</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {uploaded.some((d) => d.decision === "REJECTED") && (
                <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  One or more documents were rejected. Please upload a replacement.
                  {uploaded.filter((d) => d.decision === "REJECTED" && d.decisionNotes).map((d) => (
                    <div key={d.id} className="mt-1"><b>Reason:</b> {d.decisionNotes}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
