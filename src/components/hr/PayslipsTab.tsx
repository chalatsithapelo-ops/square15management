import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import {
  DollarSign,
  Download,
  Edit,
  FileText,
  Filter,
  Search,
  Calendar,
  User,
  Eye,
  CheckCircle,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

export function PayslipsTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"GENERATED" | "SENT" | "VIEWED" | "">("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState<any | null>(null);
  
  // Generate payslip form state
  const [generationMode, setGenerationMode] = useState<"single" | "bulk">("single");
  const [generateEmployeeId, setGenerateEmployeeId] = useState<number | null>(null);
  const [generatePayPeriodStart, setGeneratePayPeriodStart] = useState("");
  const [generatePayPeriodEnd, setGeneratePayPeriodEnd] = useState("");

  const [selectedPayslipIds, setSelectedPayslipIds] = useState<Set<number>>(new Set());

  const payslipsQuery = useQuery(
    trpc.getPayslips.queryOptions({
      token: token!,
      employeeId: selectedEmployeeId || undefined,
      status: statusFilter || undefined,
    })
  );

  const employeesQuery = useQuery(
    trpc.getEmployees.queryOptions({
      token: token!,
    })
  );

  const generatePayslipPdfMutation = useMutation(
    trpc.generatePayslipPdf.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Failed to generate payslip PDF");
      },
    })
  );

  const createPayslipMutation = useMutation(
    trpc.createPayslip.mutationOptions({
      onSuccess: async (data) => {
        toast.success("Payslip generated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getPayslips.queryKey() });
        setIsGenerateModalOpen(false);
        setGenerateEmployeeId(null);
        setGeneratePayPeriodStart("");
        setGeneratePayPeriodEnd("");
        setGenerationMode("single");
        
        // Automatically download the generated payslip PDF
        try {
          toast.loading("Generating PDF...");
          const pdfData = await generatePayslipPdfMutation.mutateAsync({
            token: token!,
            payslipId: data.id,
          });

          // Convert base64 to blob and download
          const byteCharacters = atob(pdfData.pdf);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/pdf" });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `payslip-${data.payslipNumber}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          toast.dismiss();
          toast.success("Payslip PDF downloaded!");
        } catch (error) {
          console.error("Error downloading payslip PDF:", error);
          toast.dismiss();
          toast.error("Payslip created but PDF download failed. You can download it from the table.");
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate payslip");
      },
    })
  );

  const createBulkPayslipsMutation = useMutation(
    trpc.createBulkPayslips.mutationOptions({
      onSuccess: (data) => {
        let message = `Bulk generation complete! Created ${data.successCount} payslips successfully.`;
        
        if (data.needsManualCalculation > 0) {
          message += ` ${data.needsManualCalculation} payslip${data.needsManualCalculation !== 1 ? 's' : ''} need${data.needsManualCalculation === 1 ? 's' : ''} manual calculation (employees without monthly salary).`;
        }
        
        if (data.failedCount > 0) {
          message += ` ${data.failedCount} failed.`;
        }
        
        if (data.failedCount > 0) {
          toast.error(message);
          console.error("Failed payslips:", data.errors);
        } else if (data.needsManualCalculation > 0) {
          toast(message, {
            icon: "⚠️",
            duration: 6000,
          });
        } else {
          toast.success(message);
        }
        
        queryClient.invalidateQueries({ queryKey: trpc.getPayslips.queryKey() });
        setIsGenerateModalOpen(false);
        setGenerateEmployeeId(null);
        setGeneratePayPeriodStart("");
        setGeneratePayPeriodEnd("");
        setGenerationMode("single");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate payslips");
      },
    })
  );

  const updatePayslipMutation = useMutation(
    trpc.updatePayslip.mutationOptions({
      onSuccess: () => {
        toast.success("Payslip updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getPayslips.queryKey() });
        setEditingPayslip(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update payslip");
      },
    })
  );

  const payslips = payslipsQuery.data || [];
  const employees = employeesQuery.data || [];

  // Filter payslips by search term
  const filteredPayslips = payslips.filter((payslip) => {
    const searchLower = searchTerm.toLowerCase();
    const employeeName = `${payslip.employee.firstName} ${payslip.employee.lastName}`.toLowerCase();
    const payslipNumber = payslip.payslipNumber.toLowerCase();
    
    return employeeName.includes(searchLower) || payslipNumber.includes(searchLower);
  });

  const togglePayslipSelection = (payslipId: number) => {
    setSelectedPayslipIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(payslipId)) {
        newSet.delete(payslipId);
      } else {
        newSet.add(payslipId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPayslipIds.size === filteredPayslips.length) {
      setSelectedPayslipIds(new Set());
    } else {
      setSelectedPayslipIds(new Set(filteredPayslips.map((p) => p.id)));
    }
  };

  const handleBulkDownloadPayslips = async () => {
    if (selectedPayslipIds.size === 0) {
      toast.error("Please select payslips to download");
      return;
    }

    const selectedPayslips = filteredPayslips.filter((p) => selectedPayslipIds.has(p.id));
    let successCount = 0;
    let failCount = 0;

    toast.loading(`Downloading ${selectedPayslips.length} payslips...`);

    for (let i = 0; i < selectedPayslips.length; i++) {
      const payslip = selectedPayslips[i];
      try {
        const pdfData = await generatePayslipPdfMutation.mutateAsync({
          token: token!,
          payslipId: payslip.id,
        });

        // Convert base64 to blob and download
        const byteCharacters = atob(pdfData.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `payslip-${payslip.payslipNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        successCount++;

        // Update progress toast
        toast.loading(`Downloaded ${successCount} of ${selectedPayslips.length} payslips...`);

        // Small delay between downloads to avoid overwhelming the browser
        if (i < selectedPayslips.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error(`Error downloading payslip ${payslip.payslipNumber}:`, error);
        failCount++;
      }
    }

    toast.dismiss();

    if (failCount === 0) {
      toast.success(`Successfully downloaded ${successCount} payslips!`);
    } else {
      toast.error(`Downloaded ${successCount} payslips, ${failCount} failed`);
    }

    // Clear selection after bulk download
    setSelectedPayslipIds(new Set());

    // Refresh payslips to update viewed status
    queryClient.invalidateQueries({ queryKey: trpc.getPayslips.queryKey() });
  };

  const handleGeneratePayslip = () => {
    if (!generatePayPeriodStart || !generatePayPeriodEnd) {
      toast.error("Please select pay period dates");
      return;
    }

    if (generationMode === "single") {
      if (!generateEmployeeId) {
        toast.error("Please select an employee");
        return;
      }

      createPayslipMutation.mutate({
        token: token!,
        employeeId: generateEmployeeId,
        payPeriodStart: generatePayPeriodStart,
        payPeriodEnd: generatePayPeriodEnd,
        // paymentDate is now optional and will default to payPeriodEnd
      });
    } else {
      // Bulk generation
      createBulkPayslipsMutation.mutate({
        token: token!,
        payPeriodStart: generatePayPeriodStart,
        payPeriodEnd: generatePayPeriodEnd,
      });
    }
  };

  const handleUpdatePayslip = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPayslip) return;

    const formData = new FormData(e.currentTarget);
    const data: any = {
      token: token!,
      payslipId: editingPayslip.id,
    };

    for (const [key, value] of formData.entries()) {
      if (value) {
        data[key] = typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value;
      }
    }
    
    updatePayslipMutation.mutate(data);
  };

  const handleDownloadPayslip = async (payslipId: number, payslipNumber: string) => {
    try {
      toast.loading("Generating payslip PDF...");
      
      const pdfData = await generatePayslipPdfMutation.mutateAsync({
        token: token!,
        payslipId,
      });

      // Convert base64 to blob and download
      const byteCharacters = atob(pdfData.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payslip-${payslipNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Payslip downloaded!");
      
      // Refresh payslips to update viewed status
      queryClient.invalidateQueries({ queryKey: trpc.getPayslips.queryKey() });
    } catch (error) {
      console.error("Error downloading payslip:", error);
      toast.dismiss();
    }
  };

  const hasManualCalculationNote = (notes: string | null) => {
    if (!notes) return false;
    return notes.includes("manual") || notes.includes("No salary information") || notes.includes("does not have a monthly salary");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VIEWED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Viewed
          </span>
        );
      case "SENT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Eye className="h-3 w-3 mr-1" />
            Sent
          </span>
        );
      case "GENERATED":
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Generated
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-8 w-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Total Payslips</span>
          </div>
          <div className="text-3xl font-bold mb-1">{payslips.length}</div>
          <div className="text-sm opacity-90">All time</div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-8 w-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Total Paid</span>
          </div>
          <div className="text-3xl font-bold mb-1">
            R{payslips.reduce((sum, p) => sum + p.netPay, 0).toLocaleString()}
          </div>
          <div className="text-sm opacity-90">Net pay</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <User className="h-8 w-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Employees Paid</span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {new Set(payslips.map(p => p.employeeId)).size}
          </div>
          <div className="text-sm opacity-90">Unique employees</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="h-8 w-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">This Month</span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {payslips.filter(p => {
              const paymentDate = new Date(p.paymentDate);
              const now = new Date();
              return paymentDate.getMonth() === now.getMonth() && 
                     paymentDate.getFullYear() === now.getFullYear();
            }).length}
          </div>
          <div className="text-sm opacity-90">Payslips</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or payslip number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Employee Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee
            </label>
            <select
              value={selectedEmployeeId || ""}
              onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="GENERATED">Generated</option>
              <option value="SENT">Sent</option>
              <option value="VIEWED">Viewed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Generate Payslip Button */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Generate New Payslip</h3>
            <p className="text-sm text-gray-600">
              Create a payslip for an employee for a specific time period
            </p>
          </div>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Payslip
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedPayslipIds.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-purple-600 text-white font-bold">
                {selectedPayslipIds.size}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-purple-900">
                  {selectedPayslipIds.size} payslip{selectedPayslipIds.size !== 1 ? "s" : ""} selected
                </h3>
                <p className="text-xs text-purple-700">
                  Ready to download selected payslips
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedPayslipIds(new Set())}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Selection
              </button>
              <button
                onClick={handleBulkDownloadPayslips}
                disabled={generatePayslipPdfMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Selected ({selectedPayslipIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payslips Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Payslips</h2>
        </div>
        
        {payslipsQuery.isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="mx-auto h-12 w-12 text-gray-400 animate-spin mb-4" />
            <p className="text-sm text-gray-600">Loading payslips...</p>
          </div>
        ) : filteredPayslips.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600">No payslips found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={filteredPayslips.length > 0 && selectedPayslipIds.size === filteredPayslips.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payslip Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pay Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gross Pay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Pay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayslips.map((payslip) => (
                  <tr key={payslip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap w-12">
                      <input
                        type="checkbox"
                        checked={selectedPayslipIds.has(payslip.id)}
                        onChange={() => togglePayslipSelection(payslip.id)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payslip.payslipNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payslip.employee.firstName} {payslip.employee.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{payslip.employee.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(payslip.payPeriodStart).toLocaleDateString("en-ZA", { 
                          day: "2-digit", 
                          month: "short" 
                        })} - {new Date(payslip.payPeriodEnd).toLocaleDateString("en-ZA", { 
                          day: "2-digit", 
                          month: "short", 
                          year: "numeric" 
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(payslip.paymentDate).toLocaleDateString("en-ZA")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        R{payslip.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-green-600">
                        R{payslip.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(payslip.status)}
                        {hasManualCalculationNote(payslip.notes) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800" title={payslip.notes || undefined}>
                            ⚠️ Needs Review
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setEditingPayslip(payslip)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDownloadPayslip(payslip.id, payslip.payslipNumber)}
                          disabled={generatePayslipPdfMutation.isPending}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Payslip Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Generate New Payslip</h2>
                <button
                  onClick={() => {
                    setIsGenerateModalOpen(false);
                    setGenerateEmployeeId(null);
                    setGeneratePayPeriodStart("");
                    setGeneratePayPeriodEnd("");
                    setGenerationMode("single");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Select the pay period to generate payslip(s). The payment date will be automatically set to the end of the pay period. The system will calculate earnings based on employee monthly salaries and apply standard deductions.
              </p>

              <div className="space-y-4">
                {/* Generation Mode Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Generation Mode *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setGenerationMode("single")}
                      className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-all ${
                        generationMode === "single"
                          ? "border-purple-600 bg-purple-50 text-purple-700"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      <User className="h-5 w-5 mr-2" />
                      <span className="font-medium">Single Employee</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerationMode("bulk")}
                      className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-all ${
                        generationMode === "bulk"
                          ? "border-purple-600 bg-purple-50 text-purple-700"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      <FileText className="h-5 w-5 mr-2" />
                      <span className="font-medium">Bulk (All Employees)</span>
                    </button>
                  </div>
                </div>

                {/* Employee Selection - Only show for single mode */}
                {generationMode === "single" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee *
                    </label>
                    <select
                      value={generateEmployeeId || ""}
                      onChange={(e) => setGenerateEmployeeId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select an employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName} ({employee.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Bulk generation info */}
                {generationMode === "bulk" && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <FileText className="h-5 w-5 text-purple-600 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-900 mb-1">
                          Bulk Generation Mode
                        </p>
                        <p className="text-sm text-purple-800">
                          Payslips will be generated for all <strong>{employees.length} employees</strong> in the system for the selected pay period.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pay Period Start */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pay Period Start *
                  </label>
                  <input
                    type="date"
                    value={generatePayPeriodStart}
                    onChange={(e) => setGeneratePayPeriodStart(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Pay Period End */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pay Period End *
                  </label>
                  <input
                    type="date"
                    value={generatePayPeriodEnd}
                    onChange={(e) => setGeneratePayPeriodEnd(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Info box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> The payment date will be automatically set to the pay period end date. Payslips will be generated with employee monthly salaries as the basic salary. Standard South African tax deductions (15% PAYE, 1% UIF) will be applied automatically. You can edit all values after generation if needed.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsGenerateModalOpen(false);
                    setGenerateEmployeeId(null);
                    setGeneratePayPeriodStart("");
                    setGeneratePayPeriodEnd("");
                    setGenerationMode("single");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGeneratePayslip}
                  disabled={createPayslipMutation.isPending || createBulkPayslipsMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {createPayslipMutation.isPending || createBulkPayslipsMutation.isPending
                    ? "Generating..."
                    : generationMode === "bulk"
                    ? `Generate ${employees.length} Payslips`
                    : "Generate Payslip"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payslip Modal */}
      {editingPayslip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
            <form onSubmit={handleUpdatePayslip}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Edit Payslip - {editingPayslip.payslipNumber}</h2>
                  <button
                    type="button"
                    onClick={() => setEditingPayslip(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Earnings */}
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900">Earnings</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Basic Salary</label>
                      <input type="number" step="0.01" name="basicSalary" defaultValue={editingPayslip.basicSalary} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Overtime</label>
                      <input type="number" step="0.01" name="overtime" defaultValue={editingPayslip.overtime} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bonus</label>
                      <input type="number" step="0.01" name="bonus" defaultValue={editingPayslip.bonus} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Allowances</label>
                      <input type="number" step="0.01" name="allowances" defaultValue={editingPayslip.allowances} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Commission</label>
                      <input type="number" step="0.01" name="commission" defaultValue={editingPayslip.commission} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Other Earnings</label>
                      <input type="number" step="0.01" name="otherEarnings" defaultValue={editingPayslip.otherEarnings} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900">Deductions</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Income Tax (PAYE)</label>
                      <input type="number" step="0.01" name="incomeTax" defaultValue={editingPayslip.incomeTax} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">UIF</label>
                      <input type="number" step="0.01" name="uif" defaultValue={editingPayslip.uif} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Pension Fund</label>
                      <input type="number" step="0.01" name="pensionFund" defaultValue={editingPayslip.pensionFund} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Medical Aid</label>
                      <input type="number" step="0.01" name="medicalAid" defaultValue={editingPayslip.medicalAid} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Other Deductions</label>
                      <input type="number" step="0.01" name="otherDeductions" defaultValue={editingPayslip.otherDeductions} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea name="notes" defaultValue={editingPayslip.notes || ""} rows={3} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                </div>
              </div>

              <div className="bg-gray-100 px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingPayslip(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePayslipMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
                >
                  {updatePayslipMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
