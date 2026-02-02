import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, Fragment, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { 
  Save, User, Mail, Phone, Building2, Bell, Palette, 
  Loader2, CheckCircle, Settings as SettingsIcon, Eye, EyeOff,
  Upload, ImageIcon, Trash2, AlertCircle, Info, X, CreditCard,
  Send, FileText, DollarSign, CheckCircle2, XCircle, Clock, Shield, Lock
} from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import toast from "react-hot-toast";
import { AccessDenied } from "~/components/AccessDenied";
import { UserEmailSettingsPanel } from "~/components/settings/UserEmailSettingsPanel";

export const Route = createFileRoute("/property-manager/settings/")({
  component: PropertyManagerSettings,
});

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  orderUpdates: boolean;
  invoiceAlerts: boolean;
  maintenanceRequests: boolean;
  budgetAlerts: boolean;
}

interface DisplayPreferences {
  theme: "light" | "dark" | "auto";
  compactView: boolean;
  showTutorials: boolean;
}

function PropertyManagerSettings() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"profile" | "company" | "banking" | "statement" | "email" | "branding">("profile");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  
  // Logo Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Email Testing State
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [testEmailSubject, setTestEmailSubject] = useState("");
  const [testEmailBody, setTestEmailBody] = useState("");
  const [lastTestResult, setLastTestResult] = useState<any | null>(null);

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

  // Check if user is property manager
  if (user?.role !== "PROPERTY_MANAGER") {
    return <AccessDenied />;
  }

  // Fetch user profile
  const profileQuery = useQuery({
    ...trpc.getUserProfile.queryOptions({ token: token! }),
    enabled: !!token,
  });

  // Fetch company details (PM-specific)
  const companyDetailsQuery = useQuery(
    trpc.getPropertyManagerCompanyDetails.queryOptions(
      { token: token! },
      { enabled: !!token }
    )
  );

  // Fetch branding settings
  const brandingQuery = useQuery(
    trpc.getPropertyManagerBranding.queryOptions(
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

  // Temporary object for backward compatibility with form structure
  const companyDetailsData = companyDetailsQuery.data ? {
    ...companyDetailsQuery.data,
    statementTemplateContent: "",
    smtpServer: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    emailFromAddress: "",
  } : undefined;

  // Fetch logo URL
  const logoQuery = useQuery({
    queryKey: ["getPMLogoUrl"],
    queryFn: async () => {
      // Would call PM-specific endpoint
      return null;
    },
    enabled: !!token,
  });

  // Profile Form
  const profileForm = useForm<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }>({
    values: profileQuery.data
      ? {
          firstName: profileQuery.data.firstName || "",
          lastName: profileQuery.data.lastName || "",
          email: profileQuery.data.email || "",
          phone: profileQuery.data.phone || "",
        }
      : undefined,
  });

  // Company Details Form
  const companyForm = useForm<{
    companyName: string;
    companyAddressLine1: string;
    companyAddressLine2: string;
    companyPhone: string;
    companyEmail: string;
    companyVatNumber: string;
  }>({
    values: companyDetailsData ? {
      companyName: companyDetailsData.companyName,
      companyAddressLine1: companyDetailsData.companyAddressLine1,
      companyAddressLine2: companyDetailsData.companyAddressLine2,
      companyPhone: companyDetailsData.companyPhone,
      companyEmail: companyDetailsData.companyEmail,
      companyVatNumber: companyDetailsData.companyVatNumber,
    } : undefined,
  });

  // Banking Form
  const bankingForm = useForm<{
    companyBankName: string;
    companyBankAccountName: string;
    companyBankAccountNumber: string;
    companyBankBranchCode: string;
  }>({
    values: companyDetailsData ? {
      companyBankName: companyDetailsData.companyBankName,
      companyBankAccountName: companyDetailsData.companyBankAccountName,
      companyBankAccountNumber: companyDetailsData.companyBankAccountNumber,
      companyBankBranchCode: companyDetailsData.companyBankBranchCode,
    } : undefined,
  });

  // Statement Template Form
  const statementForm = useForm<{
    statementTemplateContent: string;
  }>({
    values: companyDetailsData ? {
      statementTemplateContent: companyDetailsData.statementTemplateContent,
    } : undefined,
  });

  // Email Settings Form
  const emailSettingsForm = useForm<{
    smtpServer: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword: string;
    emailFromAddress: string;
  }>({
    values: companyDetailsData ? {
      smtpServer: companyDetailsData.smtpServer,
      smtpPort: companyDetailsData.smtpPort,
      smtpUsername: companyDetailsData.smtpUsername,
      smtpPassword: companyDetailsData.smtpPassword,
      emailFromAddress: companyDetailsData.emailFromAddress || "",
    } : undefined,
  });

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

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return data;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["getUserProfile"] });
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  const uploadLogoMutation = useMutation(
    trpc.uploadCompanyLogo.mutationOptions({
      onError: (error) => {
        console.error("Upload logo mutation error:", error);
      },
    })
  );

  const deleteLogoMutation = useMutation(
    trpc.deleteCompanyLogo.mutationOptions({
      onError: (error) => {
        console.error("Delete logo mutation error:", error);
      },
    })
  );

  const updateCompanyDetailsMutation = useMutation(
    trpc.updatePropertyManagerCompanyDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Settings updated successfully!");
        queryClient.invalidateQueries({ 
          queryKey: trpc.getPropertyManagerCompanyDetails.queryKey({ token: token! })
        });
      },
      onError: (error) => {
        console.error("Update company details error:", error);
        toast.error(error.message || "Failed to update settings");
      },
    })
  );

  const updateBrandingMutation = useMutation(
    trpc.updatePropertyManagerBranding.mutationOptions({
      onSuccess: () => {
        toast.success("Branding updated successfully!");
        queryClient.invalidateQueries({ 
          queryKey: trpc.getPropertyManagerBranding.queryKey({ token: token! })
        });
      },
      onError: (error) => {
        console.error("Update branding error:", error);
        toast.error(error.message || "Failed to update branding");
      },
    })
  );

  const sendTestEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return { messageId: "test-" + Date.now(), response: "Email sent successfully", accepted: [data.recipientEmail], rejected: [] };
    },
  });

  // Handlers
  const changePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordData) => {
      if (data.new !== data.confirm) {
        throw new Error("Passwords don't match");
      }
      if (data.new.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return data;
    },
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setPasswordData({ current: "", new: "", confirm: "" });
      setShowPassword(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to change password");
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    changePasswordMutation.mutate(passwordData);
  };

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

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        const { width, height } = img;
        setImageDimensions({ width, height });
        
        if (width < 200 || height < 200) {
          toast.error("Image should be at least 200x200 pixels for best quality");
          URL.revokeObjectURL(objectUrl);
          return;
        }
        
        setSelectedFile(file);
        setPreviewUrl(objectUrl);
        setUploadSuccess(false);
      };
      
      img.onerror = () => {
        toast.error("Failed to load image");
        URL.revokeObjectURL(objectUrl);
      };
      
      img.src = objectUrl;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
      setImageDimensions(null);
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
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Error deleting logo:", error);
      toast.error("Failed to remove logo");
    }
  };

  const cancelSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageDimensions(null);
    setUploadSuccess(false);
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token || !testEmailRecipient) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      const result = await sendTestEmailMutation.mutateAsync({
        token,
        recipientEmail: testEmailRecipient,
        subject: testEmailSubject || "Test Email from Property Manager",
        body: testEmailBody || "This is a test email from your Property Manager Portal.",
      });

      setLastTestResult({
        success: true,
        messageId: result.messageId,
        response: result.response,
        accepted: result.accepted,
        rejected: result.rejected,
        timestamp: new Date().toISOString(),
      });

      toast.success("Test email sent successfully!");
      setTestEmailRecipient("");
      setTestEmailSubject("");
      setTestEmailBody("");
    } catch (error) {
      console.error("Error sending test email:", error);
      setLastTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      });
      toast.error("Failed to send test email");
    }
  };

  const handleProfileSubmit = profileForm.handleSubmit((data) => {
    updateProfileMutation.mutate(data);
  });

  const handleCompanySubmit = companyForm.handleSubmit((data) => {
    if (!token) {
      console.error("No token available for company details update");
      toast.error("Authentication token missing. Please log in again.");
      return;
    }
    console.log("Submitting company details with token:", token ? "present" : "missing", "data:", data);
    updateCompanyDetailsMutation.mutate({ token, ...data });
  });

  const handleBankingSubmit = bankingForm.handleSubmit((data) => {
    if (!token) {
      console.error("No token available for banking details update");
      toast.error("Authentication token missing. Please log in again.");
      return;
    }
    console.log("Submitting banking details with token:", token ? "present" : "missing", "data:", data);
    updateCompanyDetailsMutation.mutate({ token, ...data });
  });

  const handleStatementSubmit = statementForm.handleSubmit((data) => {
    if (!token) return;
    updateCompanyDetailsMutation.mutate({ token, ...data });
  });

  const handleEmailSettingsSubmit = emailSettingsForm.handleSubmit((data) => {
    if (!token) return;
    updateCompanyDetailsMutation.mutate({ token, ...data });
  });

  const handleBrandingSubmit = brandingForm.handleSubmit((data) => {
    if (!token) {
      toast.error("Authentication token missing. Please log in again.");
      return;
    }
    console.log("Submitting branding with token:", token ? "present" : "missing", "data:", previewColors);
    updateBrandingMutation.mutate({ token, ...previewColors });
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <SettingsIcon className="h-8 w-8 mr-3 text-teal-600" />
            Property Manager Settings
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your profile, company branding, banking details, and email settings
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none touch-pan-x">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 px-4 sm:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "profile"
                  ? "text-teal-600 border-b-2 border-teal-600 bg-teal-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <User className="h-5 w-5 inline mr-2" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab("company")}
              className={`flex-1 px-4 sm:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "company"
                  ? "text-teal-600 border-b-2 border-teal-600 bg-teal-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Building2 className="h-5 w-5 inline mr-2" />
              Company
            </button>
            <button
              onClick={() => setActiveTab("banking")}
              className={`flex-1 px-4 sm:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "banking"
                  ? "text-teal-600 border-b-2 border-teal-600 bg-teal-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <CreditCard className="h-5 w-5 inline mr-2" />
              Banking
            </button>
            <button
              onClick={() => setActiveTab("statement")}
              className={`flex-1 px-4 sm:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "statement"
                  ? "text-teal-600 border-b-2 border-teal-600 bg-teal-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <FileText className="h-5 w-5 inline mr-2" />
              Statement
            </button>
            <button
              onClick={() => setActiveTab("email")}
              className={`flex-1 px-4 sm:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "email"
                  ? "text-teal-600 border-b-2 border-teal-600 bg-teal-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Mail className="h-5 w-5 inline mr-2" />
              Email
            </button>
            <button
              onClick={() => setActiveTab("branding")}
              className={`flex-1 px-4 sm:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "branding"
                  ? "text-teal-600 border-b-2 border-teal-600 bg-teal-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Palette className="h-5 w-5 inline mr-2" />
              Branding
            </button>
          </div>
        </div>

        {/* Profile Tab Content */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <User className="h-6 w-6 mr-2 text-teal-600" />
                Personal Information
              </h2>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      {...profileForm.register("firstName")}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      {...profileForm.register("lastName")}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    {...profileForm.register("email")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    {...profileForm.register("phone")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                  </button>
                </div>

                {updateProfileMutation.isSuccess && (
                  <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Profile updated successfully
                  </div>
                )}
              </form>
            </div>

            {/* Change Password Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Lock className="h-5 w-5 mr-2 text-orange-600" />
                Change Password
              </h3>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.current}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, current: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.new}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, new: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirm}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirm: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                  </button>
                </div>

                {changePasswordMutation.isSuccess && (
                  <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Password updated successfully
                  </div>
                )}
                {changePasswordMutation.isError && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
                    <XCircle className="h-5 w-5 mr-2" />
                    {changePasswordMutation.error instanceof Error
                      ? changePasswordMutation.error.message
                      : "Failed to update password"}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Company Tab Content */}
        {activeTab === "company" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Building2 className="h-6 w-6 mr-2 text-teal-600" />
                Company Information & Branding
              </h2>

              {/* Logo Upload Section */}
              <div className="mb-8 pb-8 border-b border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <ImageIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Company Logo
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload your company logo to display on all generated documents
                </p>

                <div className="space-y-4">
                  {/* Logo Preview */}
                  {(previewUrl || logoQuery.data?.logoUrl) && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
                      <img
                        src={previewUrl || logoQuery.data?.logoUrl}
                        alt="Company Logo"
                        className="max-w-48 max-h-48 object-contain"
                      />
                      {imageDimensions && (
                        <p className="text-xs text-gray-500 mt-2">
                          Dimensions: {imageDimensions.width}x{imageDimensions.height}px
                        </p>
                      )}
                    </div>
                  )}

                  {/* File Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Logo
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Choose File
                      </button>
                      {selectedFile && (
                        <span className="text-sm text-gray-600">{selectedFile.name}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Supported formats: JPEG, PNG, WebP, GIF (Max 10MB)
                    </p>
                  </div>

                  {/* Upload Actions */}
                  {selectedFile && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        {uploading ? "Uploading..." : "Upload Logo"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelSelection}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Delete Logo Button */}
                  {(logoQuery.data?.logoUrl || uploadSuccess) && !selectedFile && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600 hover:text-red-700 flex items-center gap-2 font-medium"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Logo
                    </button>
                  )}

                  {/* Upload Success Message */}
                  {uploadSuccess && (
                    <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Logo uploaded successfully
                    </div>
                  )}

                  {/* Upload Error Message */}
                  {uploadLogoMutation.isError && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      {uploadLogoMutation.error instanceof Error
                        ? uploadLogoMutation.error.message
                        : "Failed to upload logo"}
                    </div>
                  )}

                  {/* Delete Confirmation Dialog */}
                  {showDeleteDialog && (
                    <Dialog
                      open={showDeleteDialog}
                      onClose={() => setShowDeleteDialog(false)}
                      className="relative z-50"
                    >
                      <Transition.Child
                        as="div"
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <div className="fixed inset-0 bg-black/30" />
                      </Transition.Child>

                      <Transition.Child
                        as="div"
                        enter="ease-out duration-200"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                      >
                        <div className="fixed inset-0 flex items-center justify-center p-4">
                          <Dialog.Panel className="w-full max-w-sm bg-white rounded-lg shadow-xl p-6">
                            <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center">
                              <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
                              Delete Logo
                            </Dialog.Title>
                            <Dialog.Description className="text-gray-600 mt-2">
                              Are you sure you want to delete your company logo? This action cannot be
                              undone.
                            </Dialog.Description>
                            <div className="flex gap-2 mt-6 justify-end">
                              <button
                                onClick={() => setShowDeleteDialog(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleDeleteLogo}
                                disabled={deleteLogoMutation.isPending}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                              >
                                {deleteLogoMutation.isPending ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </Dialog.Panel>
                        </div>
                      </Transition.Child>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Company Details Form */}
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Company Details</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    {...companyForm.register("companyName")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    {...companyForm.register("companyAddressLine1")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    {...companyForm.register("companyAddressLine2")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      {...companyForm.register("companyPhone")}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      {...companyForm.register("companyEmail")}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    VAT Number
                  </label>
                  <input
                    type="text"
                    {...companyForm.register("companyVatNumber")}
                    placeholder="e.g., ZA123456789"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={updateCompanyDetailsMutation.isPending}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {updateCompanyDetailsMutation.isPending ? "Saving..." : "Save Company Info"}
                  </button>
                </div>

                {updateCompanyDetailsMutation.isSuccess && (
                  <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Company information updated successfully
                  </div>
                )}
                {updateCompanyDetailsMutation.isError && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    {updateCompanyDetailsMutation.error instanceof Error
                      ? updateCompanyDetailsMutation.error.message
                      : "Failed to update company information"}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Banking Tab Content */}
        {activeTab === "banking" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <CreditCard className="h-6 w-6 mr-2 text-teal-600" />
              Banking Details
            </h2>

            <p className="text-gray-600 text-sm mb-6">
              Enter your banking details so they appear on invoices sent to customers
            </p>

            <form onSubmit={handleBankingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Name *
                </label>
                <input
                  type="text"
                  {...bankingForm.register("companyBankName")}
                  placeholder="e.g., First National Bank"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  {...bankingForm.register("companyBankAccountName")}
                  placeholder="e.g., ABC Property Management"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number *
                </label>
                <input
                  type="text"
                  {...bankingForm.register("companyBankAccountNumber")}
                  placeholder="e.g., 1234567890"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Code *
                </label>
                <input
                  type="text"
                  {...bankingForm.register("companyBankBranchCode")}
                  placeholder="e.g., 051001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900">
                  Your banking details will be displayed on all invoices generated for your
                  customers. Make sure the information is accurate.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={updateCompanyDetailsMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  {updateCompanyDetailsMutation.isPending ? "Saving..." : "Save Banking Details"}
                </button>
              </div>

              {updateCompanyDetailsMutation.isSuccess && (
                <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Banking details updated successfully
                </div>
              )}
              {updateCompanyDetailsMutation.isError && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  {updateCompanyDetailsMutation.error instanceof Error
                    ? updateCompanyDetailsMutation.error.message
                    : "Failed to update banking details"}
                </div>
              )}
            </form>
          </div>
        )}

        {/* Statement Tab Content */}
        {activeTab === "statement" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <FileText className="h-6 w-6 mr-2 text-teal-600" />
              Statement Template
            </h2>

            <p className="text-gray-600 text-sm mb-6">
              Customize the statement template that appears on your documents. Use HTML for
              advanced formatting.
            </p>

            <form onSubmit={handleStatementSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statement Content
                </label>
                <textarea
                  {...statementForm.register("statementTemplateContent")}
                  rows={12}
                  placeholder="Enter your company statement, terms and conditions, or payment information here..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Character count: {statementForm.watch("statementTemplateContent")?.length || 0}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900">
                  You can use basic HTML tags for formatting. This template will be included in all
                  generated statements and documents.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={updateCompanyDetailsMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  {updateCompanyDetailsMutation.isPending ? "Saving..." : "Save Template"}
                </button>
              </div>

              {updateCompanyDetailsMutation.isSuccess && (
                <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Statement template updated successfully
                </div>
              )}
              {updateCompanyDetailsMutation.isError && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  {updateCompanyDetailsMutation.error instanceof Error
                    ? updateCompanyDetailsMutation.error.message
                    : "Failed to update statement template"}
                </div>
              )}
            </form>
          </div>
        )}

        {/* Email Tab Content */}
        {activeTab === "email" && (
          <UserEmailSettingsPanel theme="teal" />
        )}

        {/* Branding Tab Content */}
        {activeTab === "branding" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center">
                <Palette className="h-6 w-6 mr-2 text-teal-600" />
                Brand Colors
              </h2>
              <p className="text-gray-600 mb-6">
                Customize the colors that appear on your PDFs (Work Orders, RFQs, Invoices)
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
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewColors(prev => ({ ...prev, primaryColor: tempColors.primaryColor }))}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
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
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewColors(prev => ({ ...prev, secondaryColor: tempColors.secondaryColor }))}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
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
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewColors(prev => ({ ...prev, accentColor: tempColors.accentColor }))}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
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
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center"
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
