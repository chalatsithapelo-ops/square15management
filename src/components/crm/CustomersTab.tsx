import { useState, useMemo, Fragment } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Dialog, Transition } from "@headlessui/react";
import {
  Plus,
  Search,
  Building2,
  Users as UsersIcon,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  FileText,
  X,
  Loader2,
  Star,
  StarOff,
  UserCheck,
} from "lucide-react";

// Roles allowed to reassign portfolios (mirrors canReassignPortfolios server-side).
const SENIOR_ROLES = ["SENIOR_ADMIN", "MANAGER", "ADMIN", "TECHNICAL_MANAGER"];
type PortfolioScope = "MINE" | "ALL" | "UNASSIGNED";

// â”€â”€ Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const clientSchema = z
  .object({
    name: z.string().min(1, "Contact name is required"),
    companyName: z.string().optional(),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(1, "Phone is required"),
    address: z.string().optional(),
    vatNumber: z.string().optional(),
    notes: z.string().optional(),
    portfolioOwnerId: z.union([z.number(), z.literal("")]).optional(),
    portfolioTag: z.string().optional(),
    // Optional inline building creation â€” fill both to add a building on save.
    buildingName: z.string().optional(),
    buildingAddress: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const bn = (v.buildingName || "").trim();
    const ba = (v.buildingAddress || "").trim();
    if (bn && !ba) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["buildingAddress"],
        message: "Address is required when adding a building",
      });
    }
    if (!bn && ba) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["buildingName"],
        message: "Name is required when adding a building",
      });
    }
  });
type ClientForm = z.infer<typeof clientSchema>;

const buildingSchema = z.object({
  name: z.string().min(1, "Building name is required"),
  address: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
  managerName: z.string().optional(),
  managerEmail: z
    .string()
    .email("Invalid manager email")
    .optional()
    .or(z.literal("")),
  managerPhone: z.string().optional(),
  portfolioOwnerId: z.union([z.number(), z.literal("")]).optional(),
});
type BuildingForm = z.infer<typeof buildingSchema>;

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function CustomersTab() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const isSenior = !!user && SENIOR_ROLES.includes(user.role);

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<PortfolioScope>(
    ((user as any)?.defaultPortfolioView === "MINE" ? "MINE" : "ALL") as PortfolioScope,
  );
  const [expandedClientIds, setExpandedClientIds] = useState<Set<number>>(new Set());

  // Bulk-assign state (seniors only)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  const clientsQuery = useQuery(
    trpc.getClients.queryOptions({ token: token!, scope }),
  );

  // Fetch owner list once for seniors â€” powers the Owner dropdown + bulk assign.
  const ownersQuery = useQuery(
    trpc.listPortfolioOwners.queryOptions(
      { token: token! },
      { enabled: isSenior },
    ),
  );
  const owners = ownersQuery.data || [];

  // Save scope preference server-side when user picks a new one.
  const setViewMut = useMutation(
    trpc.setMyPortfolioView.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() }),
    }),
  );

  const changeScope = (next: PortfolioScope) => {
    setScope(next);
    setViewMut.mutate({ token: token!, view: next });
  };

  // Modals
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [deletingClient, setDeletingClient] = useState<any | null>(null);

  const [buildingModalOpen, setBuildingModalOpen] = useState(false);
  const [buildingModalClientId, setBuildingModalClientId] = useState<number | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<any | null>(null);
  const [deletingBuilding, setDeletingBuilding] = useState<any | null>(null);

  const clients = clientsQuery.data || [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c: any) => {
      const fields = [
        c.name,
        c.companyName,
        c.email,
        c.phone,
        c.address,
        c.vatNumber,
        ...(c.buildings || []).flatMap((b: any) => [
          b.name,
          b.address,
          b.managerName,
          b.managerEmail,
          b.managerPhone,
        ]),
      ];
      return fields.some((f: any) => f && String(f).toLowerCase().includes(term));
    });
  }, [clients, search]);

  const toggleExpand = (id: number) => {
    setExpandedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const createClientMut = useMutation(
    trpc.createClient.mutationOptions({
      onSuccess: () => {
        toast.success("Company added");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
        setClientModalOpen(false);
        setEditingClient(null);
      },
      onError: (e) => toast.error(e.message || "Failed to create"),
    }),
  );

  const updateClientMut = useMutation(
    trpc.updateClient.mutationOptions({
      onSuccess: () => {
        toast.success("Company updated");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
        setClientModalOpen(false);
        setEditingClient(null);
      },
      onError: (e) => toast.error(e.message || "Failed to update"),
    }),
  );

  const deleteClientMut = useMutation(
    trpc.deleteClient.mutationOptions({
      onSuccess: () => {
        toast.success("Company deleted");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
        setDeletingClient(null);
      },
      onError: (e) => toast.error(e.message || "Failed to delete"),
    }),
  );

  const createBuildingMut = useMutation(
    trpc.createClientBuilding.mutationOptions({
      onSuccess: () => {
        toast.success("Building added");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
        setBuildingModalOpen(false);
        setEditingBuilding(null);
      },
      onError: (e) => toast.error(e.message || "Failed to create"),
    }),
  );

  const updateBuildingMut = useMutation(
    trpc.updateClientBuilding.mutationOptions({
      onSuccess: () => {
        toast.success("Building updated");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
        setBuildingModalOpen(false);
        setEditingBuilding(null);
      },
      onError: (e) => toast.error(e.message || "Failed to update"),
    }),
  );

  const deleteBuildingMut = useMutation(
    trpc.deleteClientBuilding.mutationOptions({
      onSuccess: () => {
        toast.success("Building deleted");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
        setDeletingBuilding(null);
      },
      onError: (e) => toast.error(e.message || "Failed to delete"),
    }),
  );

  const bulkAssignMut = useMutation(
    trpc.bulkReassignClients.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Reassigned ${res.updated} client${res.updated === 1 ? "" : "s"}`);
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
        setSelectedIds(new Set());
        setBulkAssignOpen(false);
      },
      onError: (e) => toast.error(e.message || "Failed to reassign"),
    }),
  );

  const reassignClientMut = useMutation(
    trpc.reassignClientPortfolio.mutationOptions({
      onSuccess: () => {
        toast.success("Portfolio owner updated");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
      },
      onError: (e) => toast.error(e.message || "Failed to reassign"),
    }),
  );

  const reassignBuildingMut = useMutation(
    trpc.reassignBuildingPortfolio.mutationOptions({
      onSuccess: () => {
        toast.success("Building owner updated");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
      },
      onError: (e) => toast.error(e.message || "Failed to reassign"),
    }),
  );

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div>
      {/* Portfolio scope toggle + Bulk assign */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="text-xs font-medium text-gray-600 mr-1">View:</div>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {(["MINE", "ALL", "UNASSIGNED"] as PortfolioScope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeScope(s)}
              className={
                "px-3 py-1.5 text-xs font-medium " +
                (scope === s
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50")
              }
            >
              {s === "MINE" ? "My Portfolio" : s === "ALL" ? "All Clients" : "Unassigned"}
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && isSenior && (
          <div className="ml-auto flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-blue-900">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={() => setBulkAssignOpen(true)}
              className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md inline-flex items-center"
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Assign owner
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-blue-700 hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Header bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Customer Companies</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage companies, their buildings, and building managers. Statements can be generated per company or per building.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, building, manager..."
              className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingClient(null);
              setClientModalOpen(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {clientsQuery.isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading customers...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <UsersIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No companies match your search.</p>
            <p className="text-xs mt-1">Click "Add Company" to create your first one.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((client: any) => {
              const expanded = expandedClientIds.has(client.id);
              const buildingCount = client.buildings?.length || 0;
              const ownerName = client.portfolioOwner
                ? `${client.portfolioOwner.firstName} ${client.portfolioOwner.lastName}`
                : null;
              return (
                <li key={client.id}>
                  {/* Company row */}
                  <div className="flex items-start gap-3 p-4 hover:bg-gray-50">
                    {isSenior && (
                      <input
                        type="checkbox"
                        className="mt-1.5 rounded border-gray-300"
                        checked={selectedIds.has(client.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(client.id);
                            else next.delete(client.id);
                            return next;
                          });
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExpand(client.id)}
                      className="mt-1 text-gray-400 hover:text-gray-700"
                      aria-label={expanded ? "Collapse" : "Expand"}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => toggleExpand(client.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpand(client.id);
                        }
                      }}
                      title={
                        buildingCount > 0
                          ? expanded
                            ? "Click to hide buildings"
                            : `Click to see ${buildingCount} building${buildingCount === 1 ? "" : "s"}`
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {client.companyName || client.name}
                        </span>
                        {client.companyName && (
                          <span className="text-xs text-gray-500">({client.name})</span>
                        )}
                        <span className="inline-flex items-center text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          <Building2 className="h-3 w-3 mr-1" />
                          {buildingCount} building{buildingCount === 1 ? "" : "s"}
                        </span>
                        {ownerName ? (
                          <span className="inline-flex items-center text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                            <UserCheck className="h-3 w-3 mr-1" />
                            {ownerName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            Unassigned
                          </span>
                        )}
                        {client.portfolioTag && (
                          <span className="inline-flex items-center text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            {client.portfolioTag}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                        {client.email && (
                          <span className="inline-flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {client.email}
                          </span>
                        )}
                        {client.phone && (
                          <span className="inline-flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {client.phone}
                          </span>
                        )}
                        {client.address && (
                          <span className="inline-flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {client.address}
                          </span>
                        )}
                        {client.vatNumber && (
                          <span className="text-gray-500">VAT: {client.vatNumber}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        to="/admin/statements"
                        search={{ clientId: client.id } as any}
                        title="Generate statement for this company"
                        className="inline-flex items-center px-2 py-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 rounded"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Statement
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setBuildingModalClientId(client.id);
                          setEditingBuilding(null);
                          setBuildingModalOpen(true);
                        }}
                        title="Add building"
                        className="inline-flex items-center px-2 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Building
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClient(client);
                          setClientModalOpen(true);
                        }}
                        title="Edit company"
                        className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingClient(client)}
                        title="Delete company"
                        className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Buildings */}
                  {expanded && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      {buildingCount === 0 ? (
                        <div className="px-12 py-6 text-sm text-gray-500">
                          No buildings yet.{" "}
                          <button
                            type="button"
                            onClick={() => {
                              setBuildingModalClientId(client.id);
                              setEditingBuilding(null);
                              setBuildingModalOpen(true);
                            }}
                            className="text-blue-700 hover:underline"
                          >
                            Add the first building
                          </button>
                          .
                        </div>
                      ) : (
                        <ul className="divide-y divide-gray-100">
                          {client.buildings.map((b: any) => (
                            <li
                              key={b.id}
                              className="flex items-start gap-3 px-12 py-3 hover:bg-white"
                            >
                              <div className="mt-0.5 text-gray-400">
                                {b.isPrimary ? (
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                ) : (
                                  <Building2 className="h-4 w-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-gray-900 text-sm">{b.name}</span>
                                  {b.isPrimary && (
                                    <span className="text-[10px] uppercase tracking-wide bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                      Primary
                                    </span>
                                  )}
                                  {b.portfolioOwner && (
                                    <span className="inline-flex items-center text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                      <UserCheck className="h-2.5 w-2.5 mr-1" />
                                      {b.portfolioOwner.firstName} {b.portfolioOwner.lastName}
                                    </span>
                                  )}
                                </div>
                                {b.address && (
                                  <div className="text-xs text-gray-500 mt-0.5 inline-flex items-center">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {b.address}
                                  </div>
                                )}
                                {(b.managerName || b.managerEmail || b.managerPhone) && (
                                  <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-0.5">
                                    {b.managerName && (
                                      <span className="inline-flex items-center">
                                        <UsersIcon className="h-3 w-3 mr-1" />
                                        {b.managerName}
                                      </span>
                                    )}
                                    {b.managerEmail && (
                                      <span className="inline-flex items-center">
                                        <Mail className="h-3 w-3 mr-1" />
                                        {b.managerEmail}
                                      </span>
                                    )}
                                    {b.managerPhone && (
                                      <span className="inline-flex items-center">
                                        <Phone className="h-3 w-3 mr-1" />
                                        {b.managerPhone}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {b.notes && (
                                  <div className="text-xs text-gray-500 mt-0.5 italic">{b.notes}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Link
                                  to="/admin/statements"
                                  search={{ clientId: client.id, clientBuildingId: b.id } as any}
                                  title="Generate statement for this building"
                                  className="inline-flex items-center px-2 py-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 rounded"
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  Statement
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBuildingModalClientId(client.id);
                                    setEditingBuilding(b);
                                    setBuildingModalOpen(true);
                                  }}
                                  title="Edit building"
                                  className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingBuilding({ ...b, _clientId: client.id })}
                                  title="Delete building"
                                  className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Company Modal */}
      <ClientModal
        open={clientModalOpen}
        editing={editingClient}
        owners={owners}
        canAssignOwner={isSenior}
        onClose={() => {
          setClientModalOpen(false);
          setEditingClient(null);
        }}
        onSubmit={async (data) => {
          // Normalise portfolioOwnerId ("" â†’ undefined on create; explicit null on edit-clear)
          const portfolioOwnerIdRaw = data.portfolioOwnerId;
          const portfolioOwnerId =
            portfolioOwnerIdRaw === "" || portfolioOwnerIdRaw === undefined
              ? undefined
              : Number(portfolioOwnerIdRaw);
          const {
            portfolioOwnerId: _po,
            buildingName: bNameRaw,
            buildingAddress: bAddrRaw,
            ...rest
          } = data;
          const buildingName = (bNameRaw || "").trim();
          const buildingAddress = (bAddrRaw || "").trim();

          try {
            let clientId: number | null = null;
            let existingBuildingCount = 0;
            if (editingClient) {
              await updateClientMut.mutateAsync({
                token: token!,
                id: editingClient.id,
                ...rest,
              });
              clientId = editingClient.id;
              existingBuildingCount = editingClient.buildings?.length || 0;
              // If senior + owner field changed â†’ reassign via dedicated procedure
              if (isSenior && portfolioOwnerId !== editingClient.portfolioOwnerId) {
                await reassignClientMut.mutateAsync({
                  token: token!,
                  clientId: editingClient.id,
                  toUserId: portfolioOwnerId ?? null,
                  reason: "Edited via customer form",
                });
              }
            } else {
              const created = await createClientMut.mutateAsync({
                token: token!,
                ...rest,
                portfolioOwnerId,
              });
              clientId = (created as any)?.id ?? null;
            }

            // Optionally create a building inline
            if (clientId && buildingName && buildingAddress) {
              await createBuildingMut.mutateAsync({
                token: token!,
                clientId,
                name: buildingName,
                address: buildingAddress,
                isPrimary: existingBuildingCount === 0,
              });
            }
          } catch {
            // Errors are already surfaced via each mutation's onError toast.
          }
        }}
        pending={createClientMut.isPending || updateClientMut.isPending || createBuildingMut.isPending}
      />

      {/* Building Modal */}
      <BuildingModal
        open={buildingModalOpen}
        editing={editingBuilding}
        owners={owners}
        canAssignOwner={isSenior}
        onClose={() => {
          setBuildingModalOpen(false);
          setEditingBuilding(null);
          setBuildingModalClientId(null);
        }}
        onSubmit={(data) => {
          const portfolioOwnerIdRaw = data.portfolioOwnerId;
          const portfolioOwnerId =
            portfolioOwnerIdRaw === "" || portfolioOwnerIdRaw === undefined
              ? undefined
              : Number(portfolioOwnerIdRaw);
          const { portfolioOwnerId: _po, ...rest } = data;
          const payload = {
            ...rest,
            managerEmail: rest.managerEmail || undefined,
          };
          if (editingBuilding) {
            updateBuildingMut.mutate({
              token: token!,
              id: editingBuilding.id,
              ...payload,
            });
            if (isSenior && portfolioOwnerId !== editingBuilding.portfolioOwnerId) {
              reassignBuildingMut.mutate({
                token: token!,
                clientBuildingId: editingBuilding.id,
                toUserId: portfolioOwnerId ?? null,
                reason: "Edited via building form",
              });
            }
          } else if (buildingModalClientId) {
            createBuildingMut.mutate({
              token: token!,
              clientId: buildingModalClientId,
              ...payload,
            });
            // NOTE: create procedure doesn't accept portfolioOwnerId yet; assign
            // immediately after via reassign if the senior picked one.
            if (isSenior && portfolioOwnerId) {
              // Race: we don't have new id yet.  Handled inside createBuilding by user editing after â€” TODO
            }
          }
        }}
        pending={createBuildingMut.isPending || updateBuildingMut.isPending}
      />

      {/* Bulk Assign Modal */}
      <BulkAssignModal
        open={bulkAssignOpen}
        count={selectedIds.size}
        owners={owners}
        onCancel={() => setBulkAssignOpen(false)}
        onConfirm={(toUserId) =>
          bulkAssignMut.mutate({
            token: token!,
            clientIds: Array.from(selectedIds),
            toUserId,
            reason: "Bulk reassignment from CRM",
          })
        }
        pending={bulkAssignMut.isPending}
      />

      {/* Delete Confirmations */}
      <ConfirmDeleteModal
        open={!!deletingClient}
        title="Delete company?"
        message={
          deletingClient
            ? `Permanently delete "${deletingClient.companyName || deletingClient.name}"? This will also remove its buildings.`
            : ""
        }
        onCancel={() => setDeletingClient(null)}
        onConfirm={() =>
          deletingClient && deleteClientMut.mutate({ token: token!, id: deletingClient.id })
        }
        pending={deleteClientMut.isPending}
      />
      <ConfirmDeleteModal
        open={!!deletingBuilding}
        title="Delete building?"
        message={deletingBuilding ? `Permanently delete building "${deletingBuilding.name}"?` : ""}
        onCancel={() => setDeletingBuilding(null)}
        onConfirm={() =>
          deletingBuilding && deleteBuildingMut.mutate({ token: token!, id: deletingBuilding.id })
        }
        pending={deleteBuildingMut.isPending}
      />
    </div>
  );
}

// â”€â”€ Company Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ClientModal({
  open,
  editing,
  owners,
  canAssignOwner,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  editing: any | null;
  owners: any[];
  canAssignOwner: boolean;
  onClose: () => void;
  onSubmit: (d: ClientForm) => void;
  pending: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: editing?.name || "",
      companyName: editing?.companyName || "",
      email: editing?.email || "",
      phone: editing?.phone || "",
      address: editing?.address || "",
      vatNumber: editing?.vatNumber || "",
      notes: editing?.notes || "",
      portfolioOwnerId: editing?.portfolioOwnerId ?? "",
      portfolioTag: editing?.portfolioTag || "",
      buildingName: "",
      buildingAddress: "",
    },
    // Re-init when editing changes
    values: editing
      ? {
          name: editing.name || "",
          companyName: editing.companyName || "",
          email: editing.email || "",
          phone: editing.phone || "",
          address: editing.address || "",
          vatNumber: editing.vatNumber || "",
          notes: editing.notes || "",
          portfolioOwnerId: editing.portfolioOwnerId ?? "",
          portfolioTag: editing.portfolioTag || "",
          buildingName: "",
          buildingAddress: "",
        }
      : {
          name: "",
          companyName: "",
          email: "",
          phone: "",
          address: "",
          vatNumber: "",
          notes: "",
          portfolioOwnerId: "",
          portfolioTag: "",
          buildingName: "",
          buildingAddress: "",
        },
  });

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  {editing ? "Edit Company" : "Add Company"}
                </Dialog.Title>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form
                onSubmit={handleSubmit((d) => {
                  onSubmit(d);
                })}
                className="px-5 py-4 space-y-3 overflow-y-auto"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Company Name" error={errors.companyName?.message}>
                    <input
                      type="text"
                      {...register("companyName")}
                      placeholder="e.g. Broll"
                      className="input"
                    />
                  </Field>
                  <Field label="Primary Contact *" error={errors.name?.message}>
                    <input type="text" {...register("name")} className="input" />
                  </Field>
                  <Field label="Email *" error={errors.email?.message}>
                    <input type="email" {...register("email")} className="input" />
                  </Field>
                  <Field label="Phone *" error={errors.phone?.message}>
                    <input type="tel" {...register("phone")} className="input" />
                  </Field>
                  <Field label="Address" error={errors.address?.message}>
                    <input type="text" {...register("address")} className="input" />
                  </Field>
                  <Field label="VAT Number" error={errors.vatNumber?.message}>
                    <input type="text" {...register("vatNumber")} className="input" />
                  </Field>
                </div>
                <Field label="Notes" error={errors.notes?.message}>
                  <textarea {...register("notes")} rows={2} className="input" />
                </Field>
                <div className="border-t border-gray-100 pt-3 mt-1">
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {editing ? "Add Another Building" : "First Building"}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {editing
                        ? `${editing.buildings?.length || 0} existing Â· optional`
                        : "optional"}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Building Name" error={errors.buildingName?.message}>
                      <input
                        type="text"
                        {...register("buildingName")}
                        placeholder="e.g. Sandton City"
                        className="input"
                      />
                    </Field>
                    <Field label="Building Address" error={errors.buildingAddress?.message}>
                      <input
                        type="text"
                        {...register("buildingAddress")}
                        placeholder="Street, suburb, city"
                        className="input"
                      />
                    </Field>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Leave both blank to skip. Fill both to add a building when you save.
                  </p>
                </div>
                {canAssignOwner && (
                  <div className="border-t border-gray-100 pt-3 mt-1">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Portfolio
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Portfolio Owner">
                        <select
                          {...register("portfolioOwnerId", {
                            setValueAs: (v) => (v === "" ? "" : Number(v)),
                          })}
                          className="input"
                        >
                          <option value="">â€” Unassigned â€”</option>
                          {owners.map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.firstName} {u.lastName} ({u.role.replace("_", " ")})
                              {u.onLeaveUntil && new Date(u.onLeaveUntil) > new Date() ? " Â· On leave" : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Portfolio Tag" error={errors.portfolioTag?.message}>
                        <input
                          type="text"
                          {...register("portfolioTag")}
                          placeholder="e.g. Retail, JHB North"
                          className="input"
                        />
                      </Field>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 inline-flex items-center"
                  >
                    {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editing ? "Save Changes" : "Create Company"}
                  </button>
                </div>
              </form>
              <style>{`.input { width:100%; padding:0.5rem 0.75rem; border:1px solid #d1d5db; border-radius:0.5rem; font-size:0.875rem; }
                .input:focus { outline:none; border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,0.2); }`}</style>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

// â”€â”€ Building Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BuildingModal({
  open,
  editing,
  owners,
  canAssignOwner,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  editing: any | null;
  owners: any[];
  canAssignOwner: boolean;
  onClose: () => void;
  onSubmit: (d: BuildingForm) => void;
  pending: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BuildingForm>({
    resolver: zodResolver(buildingSchema),
    values: editing
      ? {
          name: editing.name || "",
          address: editing.address || "",
          isPrimary: !!editing.isPrimary,
          notes: editing.notes || "",
          managerName: editing.managerName || "",
          managerEmail: editing.managerEmail || "",
          managerPhone: editing.managerPhone || "",
          portfolioOwnerId: editing.portfolioOwnerId ?? "",
        }
      : {
          name: "",
          address: "",
          isPrimary: false,
          notes: "",
          managerName: "",
          managerEmail: "",
          managerPhone: "",
          portfolioOwnerId: "",
        },
  });

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  {editing ? "Edit Building" : "Add Building"}
                </Dialog.Title>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form
                onSubmit={handleSubmit((d) => onSubmit(d))}
                className="px-5 py-4 space-y-3 overflow-y-auto"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Building Name *" error={errors.name?.message}>
                    <input type="text" {...register("name")} placeholder="e.g. Kasteel" className="input" />
                  </Field>
                  <Field label="Address" error={errors.address?.message}>
                    <input type="text" {...register("address")} className="input" />
                  </Field>
                </div>
                <div className="border-t border-gray-100 pt-3 mt-1">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                    Building Manager
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Manager Name" error={errors.managerName?.message}>
                      <input
                        type="text"
                        {...register("managerName")}
                        placeholder="e.g. Everson"
                        className="input"
                      />
                    </Field>
                    <Field label="Manager Email" error={errors.managerEmail?.message}>
                      <input type="email" {...register("managerEmail")} className="input" />
                    </Field>
                    <Field label="Manager Phone" error={errors.managerPhone?.message}>
                      <input type="tel" {...register("managerPhone")} className="input" />
                    </Field>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    id="isPrimary"
                    type="checkbox"
                    {...register("isPrimary")}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="isPrimary" className="text-sm text-gray-700 inline-flex items-center">
                    <Star className="h-3.5 w-3.5 mr-1 text-yellow-500" />
                    Mark as primary building
                  </label>
                </div>
                <Field label="Notes" error={errors.notes?.message}>
                  <textarea {...register("notes")} rows={2} className="input" />
                </Field>
                {canAssignOwner && (
                  <Field label="Portfolio Owner (overrides company owner)">
                    <select
                      {...register("portfolioOwnerId", {
                        setValueAs: (v) => (v === "" ? "" : Number(v)),
                      })}
                      className="input"
                    >
                      <option value="">â€” Inherit from company â€”</option>
                      {owners.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.role.replace("_", " ")})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 inline-flex items-center"
                  >
                    {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editing ? "Save Changes" : "Create Building"}
                  </button>
                </div>
              </form>
              <style>{`.input { width:100%; padding:0.5rem 0.75rem; border:1px solid #d1d5db; border-radius:0.5rem; font-size:0.875rem; }
                .input:focus { outline:none; border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,0.2); }`}</style>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

// â”€â”€ Confirm Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ConfirmDeleteModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onCancel} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
              <Dialog.Title className="text-base font-semibold text-gray-900">{title}</Dialog.Title>
              <p className="text-sm text-gray-600 mt-2">{message}</p>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={pending}
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 inline-flex items-center"
                >
                  {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

// â”€â”€ Field helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// â”€â”€ Bulk Assign Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BulkAssignModal({
  open,
  count,
  owners,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean;
  count: number;
  owners: any[];
  onCancel: () => void;
  onConfirm: (toUserId: number | null) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<string>("");
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onCancel} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
              <Dialog.Title className="text-base font-semibold text-gray-900 inline-flex items-center">
                <UsersIcon className="h-4 w-4 mr-2 text-blue-600" />
                Assign {count} client{count === 1 ? "" : "s"} toâ€¦
              </Dialog.Title>
              <p className="text-xs text-gray-500 mt-1">
                All selected clients will be reassigned. The change is logged for audit.
              </p>
              <select
                className="mt-4 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">â€” Choose owner â€”</option>
                <option value="__none">Unassign (return to pool)</option>
                {owners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role.replace("_", " ")})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selected || pending}
                  onClick={() =>
                    onConfirm(selected === "__none" ? null : Number(selected))
                  }
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 inline-flex items-center"
                >
                  {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Reassign
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
