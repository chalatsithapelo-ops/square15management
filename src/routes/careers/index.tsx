import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { Briefcase, MapPin, Search, Building2 } from "lucide-react";

export const Route = createFileRoute("/careers/")({
  component: CareersPage,
});

function CareersPage() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const jobsQ = useQuery(trpc.listPublicJobs.queryOptions({
    search: search || undefined,
    category: category || undefined,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="bg-gradient-to-r from-teal-700 to-cyan-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl font-bold mb-3">Join our team</h1>
          <p className="text-teal-100 mb-8">Find your next opportunity with SQR15 Property Management</p>
          <div className="max-w-xl mx-auto bg-white rounded-xl p-2 flex items-center gap-2 shadow-xl">
            <Search className="w-5 h-5 text-gray-400 ml-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles, skills, trades…"
              className="flex-1 py-2 px-2 text-gray-800 outline-none"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-gray-800 border-l px-2 py-2 outline-none">
              <option value="">All categories</option>
              <option>Plumbing</option>
              <option>Electrical</option>
              <option>Construction</option>
              <option>Painting</option>
              <option>General Maintenance</option>
              <option>Administration</option>
              <option>Sales</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-sm font-semibold text-gray-500 mb-4">
          {jobsQ.data?.length ?? 0} open {jobsQ.data?.length === 1 ? "position" : "positions"}
        </h2>
        <div className="space-y-3">
          {(jobsQ.data ?? []).map((j: any) => (
            <Link
              key={j.id}
              to="/careers/$slug"
              params={{ slug: j.slug }}
              className="block bg-white rounded-xl border p-5 hover:border-teal-400 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{j.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    {j.department && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{j.department}</span>}
                    {j.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{j.location}{j.province ? `, ${j.province}` : ""}</span>}
                    {j.employmentType && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{j.employmentType}</span>}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400">
                  Posted {j.openedAt ? new Date(j.openedAt).toLocaleDateString() : ""}
                </div>
              </div>
              {j.description && <p className="text-sm text-gray-600 mt-3 line-clamp-2">{j.description}</p>}
              {(j.minSalary || j.maxSalary) && (
                <div className="mt-2 text-sm font-medium text-teal-700">
                  R{j.minSalary?.toLocaleString()}{j.maxSalary ? ` – R${j.maxSalary.toLocaleString()}` : ""} {j.currency ?? "ZAR"}
                </div>
              )}
            </Link>
          ))}
          {jobsQ.data?.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Briefcase className="w-12 h-12 mx-auto mb-3" />
              No open positions right now. Check back soon.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
