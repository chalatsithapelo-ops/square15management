import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { isContractorRole } from "~/utils/roles";
import { UserEmailSettingsPanel } from "~/components/settings/UserEmailSettingsPanel";
import { 
  Upload, 
  Loader2, 
  Building2, 
  CreditCard, 
  Save, 
  Trash2, 
  Mail, 
  Users,
  Shield,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  UserPlus,
  Edit2,
  X,
  Palette
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/contractor/settings/")({
  component: ContractorSettings,
});

function ContractorSettings() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"company" | "banking" | "employees" | "access-control" | "email" | "branding">("company");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Branding Preview State
  const [previewColors, setPreviewColors] = useState({
    primaryColor: "#2D5016",
    secondaryColor: "#F4C430",
    accentColor: "#5A9A47",
  });

  // Temporary color state (before clicking OK)
  const [tempColors, setTempColors] = useState({
    primaryColor: "#2D5016",
    secondaryColor: "#F4C430",
    accentColor: "#5A9A47",
  });

  // Fetch contractor details
  const contractorQuery = useQuery({
    queryKey: ["contractor", token],
    queryFn: async () => {
      const response = await fetch("/api/trpc/getContractorProfile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error("Failed to fetch contractor profile");
      return response.json();
    },
    enabled: !!token,
  });

  // Company Info Form
  const companyInfoForm = useForm({
    defaultValues: {
      companyName: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: user?.email || "",
      companyVatNumber: "",
    },
  });

  // Banking Form
  const bankingForm = useForm({
    defaultValues: {
      bankName: "",
      accountName: "",
      accountNumber: "",
      branchCode: "",
    },
  });

  // Employee Invite Form
  const employeeInviteForm = useForm({
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      role: "ARTISAN",
      password: "",
    },
  });

  // Fetch employees (artisans under this contractor)
  const employeesQuery = useQuery(
    trpc.getEmployees.queryOptions({
      token: token!,
      role: "ARTISAN",
    }, {
      enabled: !!token && activeTab === "employees",
    })
  );

  // Fetch branding settings
  const brandingQuery = useQuery(
    trpc.getContractorBranding.queryOptions(
      { token: token! },
      { enabled: !!token }
    )
  );

  // Update preview colors when branding data loads
  useEffect(() => {
    if (brandingQuery.data) {
      const colors = {
        primaryColor: brandingQuery.data.primaryColor,
        secondaryColor: brandingQuery.data.secondaryColor,
        accentColor: brandingQuery.data.accentColor,
      };
      setPreviewColors(colors);
      setTempColors(colors);
    }
  }, [brandingQuery.data]);

  // Populate forms with user data when it loads
  useEffect(() => {
    if (user) {
      // Populate company info form
      companyInfoForm.reset({
        companyName: (user as any).contractorCompanyName || "",
        companyAddress: (user as any).contractorCompanyAddressLine1 || "",
        companyPhone: (user as any).contractorCompanyPhone || "",
        companyEmail: (user as any).contractorCompanyEmail || user.email || "",
        companyVatNumber: (user as any).contractorCompanyVatNumber || "",
      });

      // Populate banking form
      bankingForm.reset({
        bankName: (user as any).contractorCompanyBankName || "",
        accountName: (user as any).contractorCompanyBankAccountName || "",
        accountNumber: (user as any).contractorCompanyBankAccountNumber || "",
        branchCode: (user as any).contractorCompanyBankBranchCode || "",
      });
    }
  }, [user]);


  // Branding Form
  const brandingForm = useForm<{
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  }>({
    defaultValues: {
      primaryColor: brandingQuery.data?.primaryColor || "#2D5016",
      secondaryColor: brandingQuery.data?.secondaryColor || "#F4C430",
      accentColor: brandingQuery.data?.accentColor || "#5A9A47",
    },
    mode: "onChange",
  });

  // Create employee mutation
  const createEmployeeMutation = useMutation(
    trpc.createEmployee.mutationOptions({
      onSuccess: () => {
        toast.success("Employee invited successfully!");
        setShowInviteModal(false);
        employeeInviteForm.reset();
        employeesQuery.refetch();
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to invite employee");
      },
    })
  );

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation(
    trpc.deleteEmployee.mutationOptions({
      onSuccess: () => {
        toast.success("Employee removed successfully!");
        employeesQuery.refetch();
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to remove employee");
      },
    })
  );

  // Branding mutation
  const updateBrandingMutation = useMutation(
    trpc.updateContractorBranding.mutationOptions({
      onSuccess: () => {
        toast.success("Branding updated successfully!");
        brandingQuery.refetch();
      },
      onError: (error) => {
        console.error("Update branding error:", error);
        toast.error(error.message || "Failed to update branding");
      },
    })
  );

  // Company details mutation
  const updateCompanyDetailsMutation = useMutation(
    trpc.updateContractorCompanyDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Company details updated successfully!");
        // Refetch user data to get updated company info
        queryClient.invalidateQueries({ queryKey: ["contractor"] });
      },
      onError: (error) => {
        console.error("Update company details error:", error);
        toast.error(error.message || "Failed to update company details");
      },
    })
  );


  // Logo upload mutation
  const uploadLogoMutation = useMutation(
    trpc.uploadCompanyLogo.mutationOptions({
      onSuccess: () => {
        toast.success("Logo uploaded successfully!");
        setSelectedFile(null);
        setPreviewUrl(null);
        contractorQuery.refetch();
      },
      onError: (error) => {
        console.error("Upload logo mutation error:", error);
        toast.error("Failed to upload logo");
      },
    })
  );

  // Delete logo mutation
  const deleteLogoMutation = useMutation(
    trpc.deleteCompanyLogo.mutationOptions({
      onSuccess: () => {
        toast.success("Logo deleted successfully!");
        contractorQuery.refetch();
      },
      onError: (error) => {
        console.error("Delete logo mutation error:", error);
        toast.error("Failed to delete logo");
      },
    })
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    try {
      setUploading(true);
      const { presignedUrl, logoUrl } = await uploadLogoMutation.mutateAsync({
        token,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
      });

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload logo");
      }

      setUploadSuccess(true);
      toast.success("Company logo uploaded successfully!");
      
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!token) return;

    try {
      await deleteLogoMutation.mutateAsync({ token });
      toast.success("Company logo removed successfully!");
    } catch (error) {
      console.error("Error deleting logo:", error);
      toast.error("Failed to remove logo");
    }
  };

  const handleCancel = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmitCompanyInfo = async (data: any) => {
    if (!token) {
      toast.error("Authentication token missing. Please log in again.");
      return;
    }
    updateCompanyDetailsMutation.mutate({ 
      token, 
      companyName: data.companyName,
      companyAddressLine1: data.companyAddress,
      companyPhone: data.companyPhone,
      companyEmail: data.companyEmail,
      companyVatNumber: data.companyVatNumber,
    });
  };

  const onSubmitBanking = async (data: any) => {
    if (!token) {
      toast.error("Authentication token missing. Please log in again.");
      return;
    }
    updateCompanyDetailsMutation.mutate({ 
      token, 
      companyBankName: data.bankName,
      companyBankAccountName: data.accountName,
      companyBankAccountNumber: data.accountNumber,
      companyBankBranchCode: data.branchCode,
    });
  };

  const onSubmitEmployeeInvite = async (data: any) => {
    createEmployeeMutation.mutate({
      token: token!,
      ...data,
    });
  };

  const handleBrandingSubmit = brandingForm.handleSubmit((data) => {
    if (!token) {
      toast.error("Authentication token missing. Please log in again.");
      return;
    }
    console.log("Submitting branding with token:", token ? "present" : "missing", "data:", previewColors);
    updateBrandingMutation.mutate({ token, ...previewColors });
  });

  const handleDeleteEmployee = async (employeeId: number, employeeName: string) => {
    if (confirm(`Are you sure you want to remove ${employeeName} from your team?`)) {
      deleteEmployeeMutation.mutate({
        token: token!,
        employeeId,
      });
    }
  };

  if (!user || !isContractorRole(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
          <p className="text-gray-600 mt-2">Only contractors can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your company profile, branding, and business information
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("company")}
              className={`${
                activeTab === "company"
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Building2 className="h-5 w-5 mr-2" />
              Company Information
            </button>
            <button
              onClick={() => setActiveTab("banking")}
              className={`${
                activeTab === "banking"
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Banking Details
            </button>
            <button
              onClick={() => setActiveTab("employees")}
              className={`${
                activeTab === "employees"
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Users className="h-5 w-5 mr-2" />
              Employee Access
            </button>
            <button
              onClick={() => setActiveTab("access-control")}
              className={`${
                activeTab === "access-control"
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Shield className="h-5 w-5 mr-2" />
              Access Control
            </button>
            <button
              onClick={() => setActiveTab("branding")}
              className={`${
                activeTab === "branding"
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Palette className="h-5 w-5 mr-2" />
              Branding
            </button>

            <button
              onClick={() => setActiveTab("email")}
              className={`${
                activeTab === "email"
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Mail className="h-5 w-5 mr-2" />
              Email
            </button>
          </nav>
        </div>

        {activeTab === "email" && (
          <UserEmailSettingsPanel
            theme="green"
            title="Email Settings"
            description="Configure your SMTP settings to send emails through your own email account"
          />
        )}

        {/* Company Information Tab */}
        {activeTab === "company" && (
          <div className="space-y-6">
            {/* Logo Upload Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Building2 className="h-6 w-6 mr-2 text-amber-600" />
                  Company Logo
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Upload your company logo for documents and invoices
                </p>
              </div>

              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Recommended specifications:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                      <li>Format: PNG (for transparency) or JPG</li>
                      <li>Minimum size: 200x200 pixels</li>
                      <li>Recommended size: 400x400 to 800x800 pixels</li>
                      <li>Maximum file size: 5MB</li>
                    </ul>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!selectedFile && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Logo
                </button>
              )}

              {selectedFile && previewUrl && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Logo Preview
                    </label>
                    <div className="flex items-start space-x-4">
                      <div className="relative w-32 h-32 border-2 border-amber-300 rounded-lg overflow-hidden bg-gray-50">
                        <img
                          src={previewUrl}
                          alt="Logo Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex space-x-3">
                          <button
                            type="button"
                            onClick={handleUpload}
                            disabled={uploading}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {uploading ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="h-5 w-5 mr-2" />
                                Upload Logo
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancel}
                            disabled={uploading}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Company Details Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Company Information</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Update your business details
                </p>
              </div>

              <form onSubmit={companyInfoForm.handleSubmit(onSubmitCompanyInfo)} className="space-y-4">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    {...companyInfoForm.register("companyName", { required: "Company name is required" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  {companyInfoForm.formState.errors.companyName && (
                    <p className="mt-1 text-sm text-red-600">
                      {companyInfoForm.formState.errors.companyName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="companyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    Business Address *
                  </label>
                  <textarea
                    id="companyAddress"
                    rows={3}
                    {...companyInfoForm.register("companyAddress", { required: "Address is required" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  {companyInfoForm.formState.errors.companyAddress && (
                    <p className="mt-1 text-sm text-red-600">
                      {companyInfoForm.formState.errors.companyAddress.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      id="companyPhone"
                      type="tel"
                      {...companyInfoForm.register("companyPhone", { required: "Phone is required" })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      id="companyEmail"
                      type="email"
                      {...companyInfoForm.register("companyEmail", { required: "Email is required" })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="companyVatNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    VAT Number
                  </label>
                  <input
                    id="companyVatNumber"
                    type="text"
                    {...companyInfoForm.register("companyVatNumber")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
                >
                  <Save className="h-5 w-5 mr-2" />
                  Save Company Information
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Banking Details Tab */}
        {activeTab === "banking" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <CreditCard className="h-6 w-6 mr-2 text-amber-600" />
                Banking Details
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your banking information for payments
              </p>
            </div>

            <form onSubmit={bankingForm.handleSubmit(onSubmitBanking)} className="space-y-4">
              <div>
                <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name *
                </label>
                <input
                  id="bankName"
                  type="text"
                  {...bankingForm.register("bankName", { required: "Bank name is required" })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                {bankingForm.formState.errors.bankName && (
                  <p className="mt-1 text-sm text-red-600">
                    {bankingForm.formState.errors.bankName.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="accountName" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Holder Name *
                </label>
                <input
                  id="accountName"
                  type="text"
                  {...bankingForm.register("accountName", { required: "Account name is required" })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number *
                  </label>
                  <input
                    id="accountNumber"
                    type="text"
                    {...bankingForm.register("accountNumber", { required: "Account number is required" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="branchCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Branch Code *
                  </label>
                  <input
                    id="branchCode"
                    type="text"
                    {...bankingForm.register("branchCode", { required: "Branch code is required" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
              >
                <Save className="h-5 w-5 mr-2" />
                Save Banking Details
              </button>
            </form>
          </div>
        )}

        {/* Employee Access Tab */}
        {activeTab === "employees" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Shield className="h-6 w-6 mr-2 text-amber-600" />
                  Employee Access Control
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your team members and their access levels
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Invite Employee
              </button>
            </div>

            {employeesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              </div>
            ) : employeesQuery.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">Error loading employees</p>
                    <p className="text-red-700">Please try again later</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-none touch-pan-x">
                {employeesQuery.data && employeesQuery.data.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rate
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employeesQuery.data.map((employee: any) => (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {employee.firstName} {employee.lastName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{employee.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{employee.phone || "—"}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {employee.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {employee.hourlyRate ? `R${employee.hourlyRate}/hr` :
                               employee.dailyRate ? `R${employee.dailyRate}/day` :
                               employee.monthlySalary ? `R${employee.monthlySalary}/mo` :
                               "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleDeleteEmployee(employee.id, `${employee.firstName} ${employee.lastName}`)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              title="Remove employee"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No employees yet</h3>
                    <p className="text-sm text-gray-500 mb-4">Get started by inviting your first team member</p>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
                    >
                      <UserPlus className="h-5 w-5 mr-2" />
                      Invite Your First Employee
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Invite Employee Modal */}
            {showInviteModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Invite Employee</h3>
                        <p className="text-sm text-gray-600 mt-1">Add a new team member to your workforce</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowInviteModal(false);
                          employeeInviteForm.reset();
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <form onSubmit={employeeInviteForm.handleSubmit(onSubmitEmployeeInvite)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                            First Name *
                          </label>
                          <input
                            id="firstName"
                            type="text"
                            {...employeeInviteForm.register("firstName", { required: "First name is required" })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name *
                          </label>
                          <input
                            id="lastName"
                            type="text"
                            {...employeeInviteForm.register("lastName", { required: "Last name is required" })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address *
                        </label>
                        <input
                          id="email"
                          type="email"
                          {...employeeInviteForm.register("email", { required: "Email is required" })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          id="phone"
                          type="tel"
                          {...employeeInviteForm.register("phone")}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                          Initial Password *
                        </label>
                        <input
                          id="password"
                          type="password"
                          {...employeeInviteForm.register("password", { 
                            required: "Password is required",
                            minLength: { value: 6, message: "Password must be at least 6 characters" }
                          })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                        {employeeInviteForm.formState.errors.password && (
                          <p className="mt-1 text-sm text-red-600">
                            {employeeInviteForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                          Role *
                        </label>
                        <select
                          id="role"
                          {...employeeInviteForm.register("role", { required: "Role is required" })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        >
                          <option value="ARTISAN">Artisan</option>
                          <option value="SUPERVISOR">Supervisor</option>
                          <option value="MANAGER">Manager</option>
                        </select>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start">
                          <Info className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-blue-800">
                            The employee will receive their login credentials and can access the system immediately.
                          </p>
                        </div>
                      </div>

                      <div className="flex space-x-3 pt-4">
                        <button
                          type="submit"
                          disabled={createEmployeeMutation.isPending}
                          className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {createEmployeeMutation.isPending ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Inviting...
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-5 w-5 mr-2" />
                              Invite Employee
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowInviteModal(false);
                            employeeInviteForm.reset();
                          }}
                          disabled={createEmployeeMutation.isPending}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Access Control Tab */}
        {activeTab === "access-control" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Shield className="h-6 w-6 mr-2 text-amber-600" />
                Employee Role & Permission Management
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Define what your employees can access and manage
              </p>
            </div>

            {/* Role Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Artisan Role */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-blue-500 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    Default
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Artisan</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Field workers who execute jobs and report progress
                </p>
                <div className="space-y-2">
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    View assigned jobs
                  </div>
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    Update job status
                  </div>
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    Submit payment requests
                  </div>
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    View own documents
                  </div>
                </div>
              </div>

              {/* Supervisor Role */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-green-500 p-3 rounded-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    Advanced
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Supervisor</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Team leaders who oversee multiple artisans and projects
                </p>
                <div className="space-y-2">
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    All Artisan permissions
                  </div>
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    Assign jobs to artisans
                  </div>
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    Approve payment requests
                  </div>
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    View team performance
                  </div>
                </div>
              </div>

              {/* Manager Role */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-purple-500 p-3 rounded-lg">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    Full Access
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Manager</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Senior staff with full business management capabilities
                </p>
                <div className="space-y-2">
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    All Supervisor permissions
                  </div>
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    Manage quotations & invoices
                  </div>
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    View financial reports
                  </div>
                  <div className="flex items-center text-xs text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    Access all company data
                  </div>
                </div>
              </div>
            </div>

            {/* Permission Matrix */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Permission Matrix</h3>
              <div className="overflow-x-auto scrollbar-none touch-pan-x">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Permission Category
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Artisan
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Supervisor
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Manager
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        View Jobs
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Manage Jobs
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <X className="w-5 h-5 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Submit Payment Requests
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Approve Payments
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <X className="w-5 h-5 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        View Financial Reports
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <X className="w-5 h-5 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <X className="w-5 h-5 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Manage Quotations & Invoices
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <X className="w-5 h-5 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <X className="w-5 h-5 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Assign Jobs to Artisans
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <X className="w-5 h-5 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        View Team Performance
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <X className="w-5 h-5 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info Notice */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">Role Assignment Guide</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>When inviting employees, select the role that matches their responsibilities</li>
                    <li>Artisans are best for field workers who execute jobs</li>
                    <li>Supervisors should manage teams and oversee multiple projects</li>
                    <li>Managers have full access to business operations and financial data</li>
                    <li>You can change an employee's role at any time from the Employee Access tab</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab Content */}
        {activeTab === "branding" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center">
                <Palette className="h-6 w-6 mr-2 text-amber-600" />
                Brand Colors
              </h2>
              <p className="text-gray-600 mb-6">
                Customize the colors that appear on your PDFs and documents
              </p>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">How to use:</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-700">
                      <li>Click on a color square or type a hex code (e.g., #2D5016)</li>
                      <li>Click the "OK" button to see the color in the preview below</li>
                      <li>Adjust all three colors until you're happy with the result</li>
                      <li>Click "Save Branding" to apply the colors to your PDFs</li>
                    </ol>
                  </div>
                </div>
              </div>

              <form onSubmit={handleBrandingSubmit} className="space-y-6">
                {/* Color Pickers */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Primary Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={tempColors.primaryColor}
                        onChange={(e) => setTempColors(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="h-12 w-12 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={tempColors.primaryColor}
                        onChange={(e) => setTempColors(prev => ({ ...prev, primaryColor: e.target.value }))}
                        placeholder="#2D5016"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewColors(prev => ({ ...prev, primaryColor: tempColors.primaryColor }))}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        OK
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Used for headers and main accents</p>
                  </div>

                  {/* Secondary Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={tempColors.secondaryColor}
                        onChange={(e) => setTempColors(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="h-12 w-12 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={tempColors.secondaryColor}
                        onChange={(e) => setTempColors(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        placeholder="#F4C430"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewColors(prev => ({ ...prev, secondaryColor: tempColors.secondaryColor }))}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        OK
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Used for highlights and borders</p>
                  </div>

                  {/* Accent Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Accent Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={tempColors.accentColor}
                        onChange={(e) => setTempColors(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="h-12 w-12 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={tempColors.accentColor}
                        onChange={(e) => setTempColors(prev => ({ ...prev, accentColor: e.target.value }))}
                        placeholder="#5A9A47"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewColors(prev => ({ ...prev, accentColor: tempColors.accentColor }))}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        OK
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Used for buttons and status indicators</p>
                  </div>
                </div>

                {/* Preview Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Preview</h3>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                      {/* Preview Header */}
                      <div
                        className="p-4 text-white"
                        style={{ backgroundColor: previewColors.primaryColor }}
                      >
                        <h4 className="text-lg font-bold">Sample PDF Header</h4>
                        <p className="text-sm opacity-90">Your Company Name</p>
                      </div>

                      {/* Preview Content */}
                      <div className="p-4 space-y-3">
                        <div
                          className="p-3 rounded border-l-4"
                          style={{
                            borderColor: previewColors.secondaryColor,
                            backgroundColor: `${previewColors.secondaryColor}10`,
                          }}
                        >
                          <p className="text-sm font-medium">Important Information</p>
                          <p className="text-xs text-gray-600">Secondary color is used for highlights</p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="px-4 py-2 rounded text-white text-sm font-medium"
                            style={{ backgroundColor: previewColors.accentColor }}
                          >
                            Action Button
                          </button>
                          <div
                            className="px-3 py-2 rounded text-white text-xs font-medium inline-flex items-center"
                            style={{ backgroundColor: previewColors.accentColor }}
                          >
                            Status Badge
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4 border-t">
                  <button
                    type="submit"
                    disabled={updateBrandingMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center"
                  >
                    {updateBrandingMutation.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-5 w-5 mr-2" />
                        Save Branding
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
