import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import { Search, Plus, User, X, ChevronDown, Building2 } from "lucide-react";

interface ClientSelectorProps {
  token: string;
  onSelect: (client: {
    name: string;
    email: string;
    phone: string;
    address: string;
    companyName?: string;
    vatNumber?: string;
    /** Newly populated: id of the saved client (omitted for ad-hoc entries). */
    clientId?: number;
    /** Newly populated: id of the chosen ClientBuilding (omitted if using primary client address). */
    clientBuildingId?: number;
  }) => void;
  /** Reset trigger – bump to clear the selector */
  resetKey?: number;
}

type ClientBuildingLite = {
  id: number;
  name: string;
  address: string;
  isPrimary: boolean;
};

export function ClientSelector({ token, onSelect, resetKey }: ClientSelectorProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Quick-add form state
  const [qaName, setQaName] = useState("");
  const [qaCompany, setQaCompany] = useState("");
  const [qaEmail, setQaEmail] = useState("");
  const [qaPhone, setQaPhone] = useState("");
  const [qaAddress, setQaAddress] = useState("");
  const [qaVatNumber, setQaVatNumber] = useState("");

  // Building picker state — when a client with multiple buildings is chosen,
  // we show a secondary list before firing onSelect.
  type PendingClient = {
    id: number;
    name: string;
    email: string;
    phone: string;
    address: string | null;
    companyName: string | null;
    vatNumber: string | null;
    buildings: ClientBuildingLite[];
  };
  const [pendingClient, setPendingClient] = useState<PendingClient | null>(null);
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [bldgName, setBldgName] = useState("");
  const [bldgAddress, setBldgAddress] = useState("");
  const [bldgNotes, setBldgNotes] = useState("");

  // Reset when parent form resets
  useEffect(() => {
    setSelectedClientName("");
    setSearch("");
    setOpen(false);
    setShowQuickAdd(false);
    setPendingClient(null);
    setShowAddBuilding(false);
  }, [resetKey]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowQuickAdd(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clientsQuery = useQuery(
    trpc.getClients.queryOptions({ token })
  );

  const createClientMutation = useMutation(
    trpc.createClient.mutationOptions({
      onSuccess: (newClient) => {
        toast.success("Client saved!");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
        // Brand new client — no buildings yet, fire onSelect directly
        onSelect({
          name: newClient.name,
          email: newClient.email,
          phone: newClient.phone,
          address: newClient.address || "",
          companyName: newClient.companyName || undefined,
          vatNumber: newClient.vatNumber || undefined,
          clientId: newClient.id,
        });
        setSelectedClientName(newClient.name);
        setShowQuickAdd(false);
        setOpen(false);
        setQaName("");
        setQaCompany("");
        setQaEmail("");
        setQaPhone("");
        setQaAddress("");
        setQaVatNumber("");
      },
      onError: (err) => toast.error(err.message || "Failed to save client"),
    })
  );

  const createBuildingMutation = useMutation(
    trpc.createClientBuilding.mutationOptions({
      onSuccess: (b) => {
        toast.success("Building saved!");
        queryClient.invalidateQueries({ queryKey: trpc.getClients.queryKey() });
        if (pendingClient) {
          onSelect({
            name: pendingClient.name,
            email: pendingClient.email,
            phone: pendingClient.phone,
            address: b.address,
            companyName: pendingClient.companyName || undefined,
            vatNumber: pendingClient.vatNumber || undefined,
            clientId: pendingClient.id,
            clientBuildingId: b.id,
          });
          setSelectedClientName(`${pendingClient.name} — ${b.name}`);
        }
        setPendingClient(null);
        setShowAddBuilding(false);
        setBldgName("");
        setBldgAddress("");
        setBldgNotes("");
        setOpen(false);
      },
      onError: (err) => toast.error(err.message || "Failed to save building"),
    })
  );

  const clients = clientsQuery.data || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        c.phone.includes(q)
    );
  }, [clients, search]);

  const handleSelectClient = (client: (typeof clients)[0]) => {
    const buildings: ClientBuildingLite[] = ((client as any).buildings ?? []) as ClientBuildingLite[];
    if (buildings.length > 0) {
      // Defer onSelect until building is chosen
      setPendingClient({
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        companyName: client.companyName,
        vatNumber: client.vatNumber,
        buildings,
      });
      setShowAddBuilding(false);
      setSearch("");
      return;
    }
    onSelect({
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address || "",
      companyName: client.companyName || undefined,
      vatNumber: client.vatNumber || undefined,
      clientId: client.id,
    });
    setSelectedClientName(client.name);
    setSearch("");
    setOpen(false);
  };

  const handlePickBuilding = (b: ClientBuildingLite | null) => {
    if (!pendingClient) return;
    if (b) {
      onSelect({
        name: pendingClient.name,
        email: pendingClient.email,
        phone: pendingClient.phone,
        address: b.address,
        companyName: pendingClient.companyName || undefined,
        vatNumber: pendingClient.vatNumber || undefined,
        clientId: pendingClient.id,
        clientBuildingId: b.id,
      });
      setSelectedClientName(`${pendingClient.name} — ${b.name}`);
    } else {
      // "Use main address" — no building FK
      onSelect({
        name: pendingClient.name,
        email: pendingClient.email,
        phone: pendingClient.phone,
        address: pendingClient.address || "",
        companyName: pendingClient.companyName || undefined,
        vatNumber: pendingClient.vatNumber || undefined,
        clientId: pendingClient.id,
      });
      setSelectedClientName(pendingClient.name);
    }
    setPendingClient(null);
    setOpen(false);
  };

  const handleAddBuilding = () => {
    if (!pendingClient) return;
    if (!bldgName.trim() || !bldgAddress.trim()) {
      toast.error("Building name and address are required");
      return;
    }
    createBuildingMutation.mutate({
      token,
      clientId: pendingClient.id,
      name: bldgName.trim(),
      address: bldgAddress.trim(),
      notes: bldgNotes.trim() || undefined,
    });
  };

  const handleQuickAdd = () => {
    if (!qaName.trim() || !qaEmail.trim() || !qaPhone.trim()) {
      toast.error("Name, email and phone are required");
      return;
    }
    createClientMutation.mutate({
      token,
      name: qaName.trim(),
      companyName: qaCompany.trim() || undefined,
      email: qaEmail.trim(),
      phone: qaPhone.trim(),
      address: qaAddress.trim() || undefined,
      vatNumber: qaVatNumber.trim() || undefined,
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Select Saved Client
      </label>
      <div
        className="flex items-center gap-2 w-full px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors bg-white"
        onClick={() => setOpen(!open)}
      >
        <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className={`flex-1 truncate ${selectedClientName ? "text-gray-900" : "text-gray-400"}`}>
          {selectedClientName || "Choose a saved client or type below..."}
        </span>
        {selectedClientName && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedClientName("");
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-hidden">
          {pendingClient ? (
            // ── Building picker for selected client ──
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800 truncate">
                    Pick site for {pendingClient.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingClient(null);
                    setShowAddBuilding(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Back
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {pendingClient.address && (
                  <button
                    type="button"
                    onClick={() => handlePickBuilding(null)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50"
                  >
                    <div className="text-sm font-medium text-gray-900">Main address</div>
                    <div className="text-xs text-gray-500 truncate">{pendingClient.address}</div>
                  </button>
                )}
                {pendingClient.buildings.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handlePickBuilding(b)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {b.name}
                          {b.isPrimary && (
                            <span className="ml-1 text-[10px] text-blue-600 uppercase">primary</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{b.address}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-100">
                {!showAddBuilding ? (
                  <button
                    type="button"
                    onClick={() => setShowAddBuilding(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add new building / site
                  </button>
                ) : (
                  <div className="p-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Building / site name *"
                      value={bldgName}
                      onChange={(e) => setBldgName(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Address *"
                      value={bldgAddress}
                      onChange={(e) => setBldgAddress(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Notes"
                      value={bldgNotes}
                      onChange={(e) => setBldgNotes(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={handleAddBuilding}
                      disabled={createBuildingMutation.isPending}
                      className="w-full py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {createBuildingMutation.isPending ? "Saving..." : "Save & Use"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
          <>
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-md">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients..."
                className="flex-1 bg-transparent text-sm outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Client list */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-sm text-gray-500">
                {clientsQuery.isLoading ? "Loading..." : "No clients found"}
              </div>
            ) : (
              filtered.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectClient(client)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {client.name}
                        {client.companyName && (
                          <span className="ml-1 text-xs text-gray-500">({client.companyName})</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {client.email} · {client.phone}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Quick add toggle */}
          <div className="border-t border-gray-100">
            {!showQuickAdd ? (
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Save New Client
              </button>
            ) : (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Quick Add Client
                  </span>
                  <button type="button" onClick={() => setShowQuickAdd(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Client Name *"
                  value={qaName}
                  onChange={(e) => setQaName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Company Name"
                  value={qaCompany}
                  onChange={(e) => setQaCompany(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={qaEmail}
                  onChange={(e) => setQaEmail(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Phone *"
                  value={qaPhone}
                  onChange={(e) => setQaPhone(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={qaAddress}
                  onChange={(e) => setQaAddress(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="VAT Number"
                  value={qaVatNumber}
                  onChange={(e) => setQaVatNumber(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  disabled={createClientMutation.isPending}
                  className="w-full py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors"
                >
                  {createClientMutation.isPending ? "Saving..." : "Save & Select"}
                </button>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}
