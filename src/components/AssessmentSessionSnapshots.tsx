import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function AssessmentSessionSnapshots({ token, applicationId }: { token: string; applicationId: number }) {
  const trpc = useTRPC();
  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const sessions = useQuery(trpc.listAssessmentSessions.queryOptions({ token, applicationId }));
  const snapshot = useQuery(trpc.getSessionSnapshot.queryOptions({ token, applicationId, snapshotId: snapshotId ?? 0 }, { enabled: snapshotId !== null }));
  return <section className="bg-white border rounded-xl p-5 space-y-3">
    <h3 className="font-semibold">Candidate camera snapshots</h3>
    <p className="text-xs text-gray-500">These face snapshots are captured after camera consent for required assessment verification; the system does not capture the candidate’s screen. Select a timestamp to load an image.</p>
    {sessions.isLoading && <p>Loading sessions…</p>}
    {sessions.error && <p role="alert" className="text-red-700">{sessions.error.message}</p>}
    {sessions.data?.length === 0 && <p>No sessions recorded.</p>}
    {sessions.data?.map(session => <div key={session.id} className="border rounded p-3 space-y-2">
      <p className="text-sm">Session {session.id} · {new Date(session.startedAt).toLocaleString()} · {session.finishedAt ? "Finished" : session.pausedAt ? "On break" : "Active"}</p>
      <p className="text-xs">{session.webcamGranted ? "Camera consent recorded" : "Camera consent declined / withdrawn — verification is required to submit assessment answers"}{session.webcamDeclineReason && ` · ${session.webcamDeclineReason}`}</p>
      <div className="flex flex-wrap gap-2">{session.snapshots.map(s => <button key={s.id} className={`border rounded px-2 py-1 text-xs ${snapshotId === s.id ? "border-teal-600 bg-teal-50 text-teal-800" : "text-teal-700"}`} onClick={() => setSnapshotId(s.id)}>View image · {new Date(s.createdAt).toLocaleString()} · {s.step ?? "Assessment"}</button>)}</div>
      {!session.snapshots.length && <p className="text-xs text-gray-500">No snapshots captured.</p>}
    </div>)}
    {snapshot.isFetching && <p>Loading snapshot…</p>}
    {snapshot.error && <p role="alert" className="text-red-700">{snapshot.error.message}</p>}
    {snapshot.data && <div><img className="max-w-sm rounded border" src={snapshot.data.imageDataUrl} alt={`Consented face snapshot from ${new Date(snapshot.data.createdAt).toLocaleString()}`} /><button className="text-sm text-teal-700" onClick={() => setSnapshotId(null)}>Close snapshot</button></div>}
  </section>;
}