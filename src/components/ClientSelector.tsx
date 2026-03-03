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
  }) => void;
  /** Reset trigger – bump to clear the selector */
  resetKey?: number;
}

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

  // Reset when parent form resets
  useEffect(() => {
    setSelectedClientName("");
    setSearch("");
    setOpen(false);
    setShowQuickAdd(false);
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
        onSelect({
          name: newClient.name,
          email: newClient.email,
          phone: newClient.phone,
          address: newClient.address || "",
          companyName: newClient.companyName || undefined,
        });
        setSelectedClientName(newClient.name);
        setShowQuickAdd(false);
        setOpen(false);
        setQaName("");
        setQaCompany("");
        setQaEmail("");
        setQaPhone("");
        setQaAddress("");
      },
      onError: (err) => toast.error(err.message || "Failed to save client"),
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
    onSelect({
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address || "",
      companyName: client.companyName || undefined,
    });
    setSelectedClientName(client.name);
    setSearch("");
    setOpen(false);
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
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-hidden">
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
        </div>
      )}
    </div>
  );
}
