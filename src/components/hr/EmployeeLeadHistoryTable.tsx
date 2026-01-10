import { useState } from "react";
import { 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign,
  Calendar,
  TrendingUp,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Lead {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string | null;
  serviceType: string;
  description: string;
  estimatedValue: number | null;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";
  notes: string | null;
  nextFollowUpDate: Date | null;
  followUpAssignedTo: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface EmployeeLeadHistoryTableProps {
  leads: Lead[];
  isLoading?: boolean;
}

type SortField = "date" | "customer" | "value" | "status";
type SortDirection = "asc" | "desc";

const getStatusColor = (status: Lead["status"]) => {
  const colors: Record<Lead["status"], string> = {
    NEW: "bg-blue-100 text-blue-800",
    CONTACTED: "bg-yellow-100 text-yellow-800",
    QUALIFIED: "bg-purple-100 text-purple-800",
    PROPOSAL_SENT: "bg-indigo-100 text-indigo-800",
    NEGOTIATION: "bg-orange-100 text-orange-800",
    WON: "bg-green-100 text-green-800",
    LOST: "bg-red-100 text-red-800",
  };
  return colors[status];
};

const getStatusLabel = (status: Lead["status"]) => {
  const labels: Record<Lead["status"], string> = {
    NEW: "New",
    CONTACTED: "Contacted",
    QUALIFIED: "Qualified",
    PROPOSAL_SENT: "Proposal Sent",
    NEGOTIATION: "Negotiation",
    WON: "Won",
    LOST: "Lost",
  };
  return labels[status];
};

export function EmployeeLeadHistoryTable({ leads, isLoading }: EmployeeLeadHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<Lead["status"] | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.serviceType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || lead.status === statusFilter;
    
    const leadDate = new Date(lead.createdAt);
    const matchesDateRange = 
      (!dateRange.start || leadDate >= new Date(dateRange.start)) &&
      (!dateRange.end || leadDate <= new Date(dateRange.end + 'T23:59:59'));
    
    return matchesSearch && matchesStatus && matchesDateRange;
  });

  // Sort leads
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case "date":
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case "customer":
        aValue = a.customerName;
        bValue = b.customerName;
        break;
      case "value":
        aValue = a.estimatedValue || 0;
        bValue = b.estimatedValue || 0;
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 text-purple-600" />
    ) : (
      <ChevronDown className="h-4 w-4 text-purple-600" />
    );
  };

  // Calculate statistics
  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.status === "WON").length;
  const lostLeads = leads.filter((l) => l.status === "LOST").length;
  const activeLeads = leads.filter((l) => !["WON", "LOST"].includes(l.status)).length;
  const totalValue = leads
    .filter((l) => l.status === "WON" && l.estimatedValue)
    .reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

  const statusOptions: Lead["status"][] = [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "NEGOTIATION",
    "WON",
    "LOST",
  ];

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-600 mb-1">Total Leads</div>
          <div className="text-2xl font-bold text-gray-900">{totalLeads}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm font-medium text-green-600 mb-1">Won</div>
          <div className="text-2xl font-bold text-gray-900">{wonLeads}</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-sm font-medium text-red-600 mb-1">Lost</div>
          <div className="text-2xl font-bold text-gray-900">{lostLeads}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm font-medium text-purple-600 mb-1">Active</div>
          <div className="text-2xl font-bold text-gray-900">{activeLeads}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name, email, or service type..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={statusFilter || ""}
              onChange={(e) => setStatusFilter(e.target.value ? (e.target.value as Lead["status"]) : null)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
            {(statusFilter || dateRange.start || dateRange.end) && (
              <button
                onClick={() => {
                  setStatusFilter(null);
                  setDateRange({ start: "", end: "" });
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    <SortIcon field="date" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("customer")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Customer</span>
                    <SortIcon field="customer" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service Type
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("value")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Est. Value</span>
                    <SortIcon field="value" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <SortIcon field="status" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Follow-up
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{lead.customerName}</div>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <Mail className="h-3 w-3 mr-1" />
                      {lead.customerEmail}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <Phone className="h-3 w-3 mr-1" />
                      {lead.customerPhone}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{lead.serviceType}</div>
                    {lead.address && (
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {lead.address}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lead.estimatedValue ? (
                      <div className="flex items-center text-sm font-medium text-gray-900">
                        <DollarSign className="h-4 w-4 mr-1 text-green-600" />
                        R{lead.estimatedValue.toLocaleString()}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Not provided</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        lead.status
                      )}`}
                    >
                      {getStatusLabel(lead.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lead.nextFollowUpDate ? (
                      <div>
                        <div className="font-medium text-gray-900">
                          {new Date(lead.nextFollowUpDate).toLocaleDateString()}
                        </div>
                        {lead.followUpAssignedTo && (
                          <div className="text-xs text-gray-500">
                            {lead.followUpAssignedTo.firstName} {lead.followUpAssignedTo.lastName}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Not scheduled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedLeads.length === 0 && (
          <div className="p-12 text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Leads Found</h3>
            <p className="text-sm text-gray-600">
              {searchTerm || statusFilter
                ? "Try adjusting your filters"
                : "This employee hasn't created any leads yet"}
            </p>
          </div>
        )}
      </div>

      {/* Total Value Summary */}
      {wonLeads > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-800 mb-1">Total Won Value</div>
              <div className="text-3xl font-bold text-green-900">
                R{totalValue.toLocaleString()}
              </div>
              <div className="text-sm text-green-700 mt-1">
                From {wonLeads} won {wonLeads === 1 ? "lead" : "leads"}
              </div>
            </div>
            <div className="bg-green-100 rounded-full p-4">
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
