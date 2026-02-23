import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, Fragment } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { Upload, Loader2, ImageIcon, CheckCircle, Building2, CreditCard, Save, Trash2, AlertCircle, Info, X, FileText, Hash, Mail, Send, CheckCircle2, XCircle, Clock, Shield, Palette, Layout, Globe, Eye, EyeOff } from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import toast from "react-hot-toast";
import { AccessDenied } from "~/components/AccessDenied";
import { Link } from "@tanstack/react-router";
import { UserEmailSettingsPanel } from "~/components/settings/UserEmailSettingsPanel";

export const Route = createFileRoute("/admin/settings/")({
  component: AdminSettings,
});

function AdminSettings() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [testEmailSubject, setTestEmailSubject] = useState("");
  const [testEmailBody, setTestEmailBody] = useState("");
  const [lastTestResult, setLastTestResult] = useState<{
    success: boolean;
    messageId?: string;
    response?: string;
    accepted?: string[];
    rejected?: string[];
    timestamp?: string;
    error?: string;
  } | null>(null);

  // Get current logo URL
  const logoQuery = useQuery({
    ...trpc.getCompanyLogoUrl.queryOptions(),
    refetchInterval: uploadSuccess ? false : 30000,
  });

  // Get company details
  const companyDetailsQuery = useQuery({
    ...trpc.getCompanyDetails.queryOptions(),
  });

  const uploadLogoMutation = useMutation(
    trpc.uploadCompanyLogo.mutationOptions()
  );

  const deleteLogoMutation = useMutation(
    trpc.deleteCompanyLogo.mutationOptions()
  );

  const updateCompanyDetailsMutation = useMutation(
    trpc.updateCompanyDetails.mutationOptions()
  );

  const sendTestEmailMutation = useMutation(
    trpc.sendTestEmail.mutationOptions()
  );

  const sendTestStatementEmailMutation = useMutation(
    trpc.sendTestStatementEmail.mutationOptions()
  );

  const sendTestInvoiceEmailMutation = useMutation(
    trpc.sendTestInvoiceEmail.mutationOptions()
  );

  const sendTestOrderNotificationEmailMutation = useMutation(
    trpc.sendTestOrderNotificationEmail.mutationOptions()
  );

  // Company Information Form
  const companyInfoForm = useForm<{
    companyName: string;
    companyAddressLine1: string;
    companyAddressLine2: string;
    companyPhone: string;
    companyEmail: string;
    companyVatNumber: string;
  }>({
    values: companyDetailsQuery.data ? {
      companyName: companyDetailsQuery.data.companyName,
      companyAddressLine1: companyDetailsQuery.data.companyAddressLine1,
      companyAddressLine2: companyDetailsQuery.data.companyAddressLine2,
      companyPhone: companyDetailsQuery.data.companyPhone,
      companyEmail: companyDetailsQuery.data.companyEmail,
      companyVatNumber: companyDetailsQuery.data.companyVatNumber,
    } : undefined,
  });

  // Banking Details Form
  const bankingForm = useForm<{
    companyBankName: string;
    companyBankAccountName: string;
    companyBankAccountNumber: string;
    companyBankBranchCode: string;
  }>({
    values: companyDetailsQuery.data ? {
      companyBankName: companyDetailsQuery.data.companyBankName,
      companyBankAccountName: companyDetailsQuery.data.companyBankAccountName,
      companyBankAccountNumber: companyDetailsQuery.data.companyBankAccountNumber,
      companyBankBranchCode: companyDetailsQuery.data.companyBankBranchCode,
    } : undefined,
  });

  // Statement Template Form
  const statementTemplateForm = useForm<{
    statementTemplateContent: string;
  }>({
    values: companyDetailsQuery.data ? {
      statementTemplateContent: companyDetailsQuery.data.statementTemplateContent,
    } : undefined,
  });

  // Document Prefixes Form
  const documentPrefixesForm = useForm<{
    invoicePrefix: string;
    orderPrefix: string;
    quotationPrefix: string;
  }>({
    values: companyDetailsQuery.data ? {
      invoicePrefix: companyDetailsQuery.data.invoicePrefix,
      orderPrefix: companyDetailsQuery.data.orderPrefix,
      quotationPrefix: companyDetailsQuery.data.quotationPrefix,
    } : undefined,
  });

  // Check if user has access to settings
  // Senior Admin: Full access to edit
  // Contractor: View-only access to company branding
  const canEdit = user?.role === "SENIOR_ADMIN";
  const canView = user?.role === "SENIOR_ADMIN" || user?.role === "CONTRACTOR";
  
  if (!canView) {
    return <AccessDenied message="You do not have permission to access Company Settings." />;
  }

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

      // Create an image to check dimensions
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        const { width, height } = img;
        setImageDimensions({ width, height });
        
        // Warn if dimensions are too small
        if (width < 200 || height < 200) {
          toast.error("Image should be at least 200x200 pixels for best quality");
          URL.revokeObjectURL(objectUrl);
          return;
        }
        
        // Warn if dimensions are very large
        if (width > 2000 || height > 2000) {
          toast("Large image detected. Consider using a smaller size for faster loading.", {
            icon: "⚠️",
            duration: 4000,
          });
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

    const uploadPromise = (async () => {
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
        throw new Error("Failed to upload logo to storage");
      }

      return logoUrl;
    })();

    try {
      setUploading(true);
      
      await toast.promise(uploadPromise, {
        loading: "Uploading company logo...",
        success: "Company logo uploaded successfully!",
        error: "Failed to upload logo. Please try again.",
      });

      setUploadSuccess(true);
      await logoQuery.refetch();
      
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setImageDimensions(null);
    } catch (error) {
      console.error("Error uploading logo:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!token) return;

    const deletePromise = deleteLogoMutation.mutateAsync({ token });

    try {
      await toast.promise(deletePromise, {
        loading: "Removing company logo...",
        success: "Company logo removed successfully!",
        error: "Failed to remove logo. Please try again.",
      });

      await logoQuery.refetch();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Error deleting logo:", error);
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

  const onSaveCompanyInfo = async (data: {
    companyName: string;
    companyAddressLine1: string;
    companyAddressLine2: string;
    companyPhone: string;
    companyEmail: string;
    companyVatNumber: string;
  }) => {
    if (!token) return;

    try {
      await updateCompanyDetailsMutation.mutateAsync({
        token,
        ...data,
      });
      
      toast.success("Company information updated successfully!");
      await companyDetailsQuery.refetch();
    } catch (error) {
      console.error("Error updating company info:", error);
      toast.error("Failed to update company information");
    }
  };

  const onSaveBankingDetails = async (data: {
    companyBankName: string;
    companyBankAccountName: string;
    companyBankAccountNumber: string;
    companyBankBranchCode: string;
  }) => {
    if (!token) return;

    try {
      await updateCompanyDetailsMutation.mutateAsync({
        token,
        ...data,
      });
      
      toast.success("Banking details updated successfully!");
      await companyDetailsQuery.refetch();
    } catch (error) {
      console.error("Error updating banking details:", error);
      toast.error("Failed to update banking details");
    }
  };

  const onSaveStatementTemplate = async (data: {
    statementTemplateContent: string;
  }) => {
    if (!token) return;

    try {
      await updateCompanyDetailsMutation.mutateAsync({
        token,
        ...data,
      });
      
      toast.success("Statement template updated successfully!");
      await companyDetailsQuery.refetch();
    } catch (error) {
      console.error("Error updating statement template:", error);
      toast.error("Failed to update statement template");
    }
  };

  const onSaveDocumentPrefixes = async (data: {
    invoicePrefix: string;
    orderPrefix: string;
    quotationPrefix: string;
  }) => {
    if (!token) return;

    try {
      await updateCompanyDetailsMutation.mutateAsync({
        token,
        ...data,
      });
      
      toast.success("Document prefixes updated successfully!");
      await companyDetailsQuery.refetch();
    } catch (error) {
      console.error("Error updating document prefixes:", error);
      toast.error("Failed to update document prefixes");
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token || !testEmailRecipient) return;

    const sendPromise = sendTestEmailMutation.mutateAsync({
      token,
      recipientEmail: testEmailRecipient,
      subject: testEmailSubject || undefined,
      body: testEmailBody || undefined,
    });

    try {
      const result = await toast.promise(sendPromise, {
        loading: "Sending test email...",
        success: "Test email sent successfully!",
        error: "Failed to send test email",
      });

      setLastTestResult({
        success: true,
        messageId: result.messageId,
        response: result.response,
        accepted: result.accepted,
        rejected: result.rejected,
        timestamp: result.timestamp,
      });

      // Clear form after successful send
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
    }
  };

  const handleSendTestStatementEmail = async () => {
    if (!token || !testEmailRecipient) return;

    const sendPromise = sendTestStatementEmailMutation.mutateAsync({
      token,
      recipientEmail: testEmailRecipient,
    });

    try {
      const result = await toast.promise(sendPromise, {
        loading: "Sending test statement email...",
        success: "Test statement email sent successfully!",
        error: "Failed to send test statement email",
      });

      setLastTestResult({
        success: true,
        messageId: `statement-test-${Date.now()}`,
        response: result.message,
        accepted: [testEmailRecipient],
        rejected: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error sending test statement email:", error);
      setLastTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleSendTestInvoiceEmail = async () => {
    if (!token || !testEmailRecipient) return;

    const sendPromise = sendTestInvoiceEmailMutation.mutateAsync({
      token,
      recipientEmail: testEmailRecipient,
    });

    try {
      const result = await toast.promise(sendPromise, {
        loading: "Sending test invoice email...",
        success: "Test invoice email sent successfully!",
        error: "Failed to send test invoice email",
      });

      setLastTestResult({
        success: true,
        messageId: `invoice-test-${Date.now()}`,
        response: result.message,
        accepted: [testEmailRecipient],
        rejected: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error sending test invoice email:", error);
      setLastTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleSendTestOrderEmail = async () => {
    if (!token || !testEmailRecipient) return;

    const sendPromise = sendTestOrderNotificationEmailMutation.mutateAsync({
      token,
      recipientEmail: testEmailRecipient,
    });

    try {
      const result = await toast.promise(sendPromise, {
        loading: "Sending test order notification email...",
        success: "Test order notification email sent successfully!",
        error: "Failed to send test order notification email",
      });

      setLastTestResult({
        success: true,
        messageId: `order-test-${Date.now()}`,
        response: result.message,
        accepted: [testEmailRecipient],
        rejected: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error sending test order notification email:", error);
      setLastTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your company branding, information, and banking details
          </p>
        </div>

        {/* Access Control Management Link */}
        {user?.role === "SENIOR_ADMIN" && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <Shield className="h-6 w-6 text-purple-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Access Control Management
                  </h2>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  Configure role-based permissions dynamically to control access to features and data across the application. 
                  Customize permissions for each role without code changes.
                </p>
                <Link
                  to="/admin/access-control"
                  className="inline-flex items-center px-4 py-2 border border-purple-300 rounded-lg text-sm font-medium text-purple-700 bg-white hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Manage Role Permissions
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Logo Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
                <ImageIcon className="h-5 w-5 mr-2 text-gray-700" />
                Company Logo
              </h2>
              <p className="text-sm text-gray-600">
                Upload your company logo for invoices, orders, job cards, and quotations
              </p>
            </div>

            {/* Read-only notice for contractors */}
            {!canEdit && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">View-only Access</p>
                    <p className="text-amber-700">
                      You can view company settings but only administrators can make changes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
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

            {logoQuery.isLoading && !selectedFile && (
              <div className="mb-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
                  <div className="flex items-start space-x-4">
                    <div className="w-32 h-32 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-20 bg-gray-200 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {logoQuery.data?.logoUrl && !selectedFile && !logoQuery.isLoading && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Current Logo
                </label>
                <div className="flex items-start space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowLogoModal(true)}
                    className="relative w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:border-green-500 transition-colors cursor-pointer group"
                  >
                    <img
                      src={logoQuery.data.logoUrl}
                      alt="Company Logo"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                        View Full Size
                      </span>
                    </div>
                  </button>
                  <div className="flex-1 space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <p className="text-sm font-medium text-green-800">
                          Active on all PDFs
                        </p>
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setShowDeleteDialog(true)}
                        className="inline-flex items-center px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!logoQuery.data?.logoUrl && !selectedFile && !logoQuery.isLoading && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      No logo uploaded
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Upload a logo to display it on all documents
                    </p>
                  </div>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedFile && canEdit && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="h-5 w-5 mr-2" />
                {logoQuery.data?.logoUrl ? "Upload New Logo" : "Upload Logo"}
              </button>
            )}

            {selectedFile && previewUrl && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    New Logo Preview
                  </label>
                  <div className="flex items-start space-x-4">
                    <div className="relative w-32 h-32 border-2 border-green-300 rounded-lg overflow-hidden bg-gray-50">
                      <img
                        src={previewUrl}
                        alt="Logo Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          <strong>File:</strong> {selectedFile.name}
                        </p>
                        <p className="text-sm text-blue-800 mt-1">
                          <strong>Size:</strong> {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                        {imageDimensions && (
                          <p className="text-sm text-blue-800 mt-1">
                            <strong>Dimensions:</strong> {imageDimensions.width} × {imageDimensions.height} px
                          </p>
                        )}
                      </div>
                      {imageDimensions && imageDimensions.width >= 400 && imageDimensions.height >= 400 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                            <p className="text-xs text-green-800">
                              Good quality for documents
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    onClick={cancelSelection}
                    disabled={uploading}
                    className="inline-flex items-center px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {uploadSuccess && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-sm font-medium text-green-800">
                    Logo uploaded successfully!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Company Information Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
                <Building2 className="h-5 w-5 mr-2 text-gray-700" />
                Company Information
              </h2>
              <p className="text-sm text-gray-600">
                Update your company details that appear on all documents
              </p>
            </div>

            {companyDetailsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <form onSubmit={companyInfoForm.handleSubmit(onSaveCompanyInfo)} className="space-y-4">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    {...companyInfoForm.register("companyName", { required: "Company name is required" })}
                    readOnly={!canEdit}
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${!canEdit ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  />
                  {companyInfoForm.formState.errors.companyName && (
                    <p className="mt-1 text-sm text-red-600">
                      {companyInfoForm.formState.errors.companyName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="companyAddressLine1" className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1
                  </label>
                  <input
                    id="companyAddressLine1"
                    type="text"
                    {...companyInfoForm.register("companyAddressLine1", { required: "Address is required" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {companyInfoForm.formState.errors.companyAddressLine1 && (
                    <p className="mt-1 text-sm text-red-600">
                      {companyInfoForm.formState.errors.companyAddressLine1.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="companyAddressLine2" className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2
                  </label>
                  <input
                    id="companyAddressLine2"
                    type="text"
                    {...companyInfoForm.register("companyAddressLine2")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    id="companyPhone"
                    type="tel"
                    {...companyInfoForm.register("companyPhone", { required: "Phone number is required" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {companyInfoForm.formState.errors.companyPhone && (
                    <p className="mt-1 text-sm text-red-600">
                      {companyInfoForm.formState.errors.companyPhone.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="companyEmail"
                    type="email"
                    {...companyInfoForm.register("companyEmail", { 
                      required: "Email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address"
                      }
                    })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {companyInfoForm.formState.errors.companyEmail && (
                    <p className="mt-1 text-sm text-red-600">
                      {companyInfoForm.formState.errors.companyEmail.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="companyVatNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    VAT Number
                  </label>
                  <input
                    id="companyVatNumber"
                    type="text"
                    {...companyInfoForm.register("companyVatNumber", { required: "VAT number is required" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {companyInfoForm.formState.errors.companyVatNumber && (
                    <p className="mt-1 text-sm text-red-600">
                      {companyInfoForm.formState.errors.companyVatNumber.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={updateCompanyDetailsMutation.isPending}
                  className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updateCompanyDetailsMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      Save Company Information
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Banking Details Section - Full Width */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-gray-700" />
              Banking Details
            </h2>
            <p className="text-sm text-gray-600">
              Update your banking information that appears on invoices
            </p>
          </div>

          {companyDetailsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <form onSubmit={bankingForm.handleSubmit(onSaveBankingDetails)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="companyBankName" className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <input
                  id="companyBankName"
                  type="text"
                  {...bankingForm.register("companyBankName", { required: "Bank name is required" })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {bankingForm.formState.errors.companyBankName && (
                  <p className="mt-1 text-sm text-red-600">
                    {bankingForm.formState.errors.companyBankName.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="companyBankAccountName" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name
                </label>
                <input
                  id="companyBankAccountName"
                  type="text"
                  {...bankingForm.register("companyBankAccountName", { required: "Account name is required" })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {bankingForm.formState.errors.companyBankAccountName && (
                  <p className="mt-1 text-sm text-red-600">
                    {bankingForm.formState.errors.companyBankAccountName.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="companyBankAccountNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number
                </label>
                <input
                  id="companyBankAccountNumber"
                  type="text"
                  {...bankingForm.register("companyBankAccountNumber", { required: "Account number is required" })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {bankingForm.formState.errors.companyBankAccountNumber && (
                  <p className="mt-1 text-sm text-red-600">
                    {bankingForm.formState.errors.companyBankAccountNumber.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="companyBankBranchCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Code
                </label>
                <input
                  id="companyBankBranchCode"
                  type="text"
                  {...bankingForm.register("companyBankBranchCode", { required: "Branch code is required" })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {bankingForm.formState.errors.companyBankBranchCode && (
                  <p className="mt-1 text-sm text-red-600">
                    {bankingForm.formState.errors.companyBankBranchCode.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={updateCompanyDetailsMutation.isPending}
                  className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updateCompanyDetailsMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      Save Banking Details
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Statement Template Section - Full Width */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gray-700" />
              Statement Template
            </h2>
            <p className="text-sm text-gray-600">
              Customize the message that appears on customer statements
            </p>
          </div>

          {companyDetailsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <form onSubmit={statementTemplateForm.handleSubmit(onSaveStatementTemplate)} className="space-y-4">
              <div>
                <label htmlFor="statementTemplateContent" className="block text-sm font-medium text-gray-700 mb-1">
                  Template Content
                </label>
                <textarea
                  id="statementTemplateContent"
                  rows={6}
                  {...statementTemplateForm.register("statementTemplateContent")}
                  placeholder="Enter the message that will appear on customer statements. This can include payment instructions, terms and conditions, or any other important information..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                />
                <p className="mt-2 text-xs text-gray-500">
                  This message will be displayed on all generated statements. You can include payment instructions, terms, or any other important information for your customers.
                </p>
              </div>

              <button
                type="submit"
                disabled={updateCompanyDetailsMutation.isPending}
                className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateCompanyDetailsMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Save Statement Template
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Document Prefixes Section - Full Width */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
              <Hash className="h-5 w-5 mr-2 text-gray-700" />
              Document Number Prefixes
            </h2>
            <p className="text-sm text-gray-600">
              Customize the prefixes for invoice, order, and quotation numbers to match your business naming conventions
            </p>
          </div>

          {/* Information box */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">About document prefixes:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Prefixes appear before the sequential number (e.g., INV-00001, ORD-000001)</li>
                  <li>Use short, memorable codes (2-5 characters recommended)</li>
                  <li>Changes only affect new documents; existing documents keep their numbers</li>
                  <li>Common examples: INV, INVOICE, ORD, ORDER, QUO, QUOTE</li>
                </ul>
              </div>
            </div>
          </div>

          {companyDetailsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <form onSubmit={documentPrefixesForm.handleSubmit(onSaveDocumentPrefixes)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="invoicePrefix" className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Prefix
                  </label>
                  <input
                    id="invoicePrefix"
                    type="text"
                    {...documentPrefixesForm.register("invoicePrefix", { 
                      required: "Invoice prefix is required",
                      pattern: {
                        value: /^[A-Z0-9]+$/,
                        message: "Only uppercase letters and numbers allowed"
                      },
                      maxLength: {
                        value: 10,
                        message: "Maximum 10 characters"
                      }
                    })}
                    placeholder="INV"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  />
                  {documentPrefixesForm.formState.errors.invoicePrefix && (
                    <p className="mt-1 text-sm text-red-600">
                      {documentPrefixesForm.formState.errors.invoicePrefix.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Example: INV-00001
                  </p>
                </div>

                <div>
                  <label htmlFor="orderPrefix" className="block text-sm font-medium text-gray-700 mb-1">
                    Order Prefix
                  </label>
                  <input
                    id="orderPrefix"
                    type="text"
                    {...documentPrefixesForm.register("orderPrefix", { 
                      required: "Order prefix is required",
                      pattern: {
                        value: /^[A-Z0-9]+$/,
                        message: "Only uppercase letters and numbers allowed"
                      },
                      maxLength: {
                        value: 10,
                        message: "Maximum 10 characters"
                      }
                    })}
                    placeholder="ORD"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  />
                  {documentPrefixesForm.formState.errors.orderPrefix && (
                    <p className="mt-1 text-sm text-red-600">
                      {documentPrefixesForm.formState.errors.orderPrefix.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Example: ORD-000001
                  </p>
                </div>

                <div>
                  <label htmlFor="quotationPrefix" className="block text-sm font-medium text-gray-700 mb-1">
                    Quotation Prefix
                  </label>
                  <input
                    id="quotationPrefix"
                    type="text"
                    {...documentPrefixesForm.register("quotationPrefix", { 
                      required: "Quotation prefix is required",
                      pattern: {
                        value: /^[A-Z0-9]+$/,
                        message: "Only uppercase letters and numbers allowed"
                      },
                      maxLength: {
                        value: 10,
                        message: "Maximum 10 characters"
                      }
                    })}
                    placeholder="QUO"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  />
                  {documentPrefixesForm.formState.errors.quotationPrefix && (
                    <p className="mt-1 text-sm text-red-600">
                      {documentPrefixesForm.formState.errors.quotationPrefix.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Example: QUO-00001
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={updateCompanyDetailsMutation.isPending}
                className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateCompanyDetailsMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Save Document Prefixes
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* PDF Template & Theme Settings */}
        <PdfSettingsSection />

        {/* Resend Email API Configuration */}
        <ResendConfigSection />

        {/* Personal Email Settings (per-user SMTP) */}
        <div className="mt-6">
          <UserEmailSettingsPanel
            theme="green"
            title="Personal Email Settings"
            description="Connect your own email account (Gmail, company email, or any SMTP provider) so emails can be sent from your address"
          />
        </div>

        {/* Email Testing & Monitoring Section - Full Width */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
              <Mail className="h-5 w-5 mr-2 text-gray-700" />
              Email Testing & Monitoring
            </h2>
            <p className="text-sm text-gray-600">
              Send test emails to verify delivery, check spam scores, and monitor email configuration
            </p>
          </div>

          {/* Current Email Configuration Info */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Current Email Configuration:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><strong>SMTP Host:</strong> {companyDetailsQuery.data ? "smtp.gmail.com" : "Loading..."}</li>
                  <li><strong>From Address:</strong> {companyDetailsQuery.data?.companyEmail || "Loading..."}</li>
                  <li><strong>Company Name:</strong> {companyDetailsQuery.data?.companyName || "Loading..."}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Test Email Form - replaced with comprehensive testing */}
          <div className="space-y-6">
            <div>
              <label htmlFor="testEmailRecipient" className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="testEmailRecipient"
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="recipient@example.com"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the email address where you want to receive test emails
              </p>
            </div>

            {/* Test Email Type Buttons */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Select Test Email Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* General Test Email */}
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendTestEmailMutation.isPending || !testEmailRecipient}
                  className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendTestEmailMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-5 w-5 mr-2" />
                      General Test Email
                    </>
                  )}
                </button>

                {/* Statement Test Email */}
                <button
                  type="button"
                  onClick={handleSendTestStatementEmail}
                  disabled={sendTestStatementEmailMutation.isPending || !testEmailRecipient}
                  className="flex items-center justify-center px-4 py-3 border border-purple-300 rounded-lg text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendTestStatementEmailMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5 mr-2" />
                      Statement Notification
                    </>
                  )}
                </button>

                {/* Invoice Test Email */}
                <button
                  type="button"
                  onClick={handleSendTestInvoiceEmail}
                  disabled={sendTestInvoiceEmailMutation.isPending || !testEmailRecipient}
                  className="flex items-center justify-center px-4 py-3 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendTestInvoiceEmailMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5 mr-2" />
                      Invoice Notification
                    </>
                  )}
                </button>

                {/* Order Test Email */}
                <button
                  type="button"
                  onClick={handleSendTestOrderEmail}
                  disabled={sendTestOrderNotificationEmailMutation.isPending || !testEmailRecipient}
                  className="flex items-center justify-center px-4 py-3 border border-green-300 rounded-lg text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendTestOrderNotificationEmailMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Order Status Update
                    </>
                  )}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Click any button above to send a test email of that type. Each test email contains realistic sample data and is clearly marked as a test.
              </p>
            </div>

            {/* Advanced Options - Collapsible */}
            <details className="border border-gray-200 rounded-lg">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
                Advanced Options (Custom Email)
              </summary>
              <div className="px-4 py-3 border-t border-gray-200 space-y-4">
                <div>
                  <label htmlFor="testEmailSubject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject (Optional)
                  </label>
                  <input
                    id="testEmailSubject"
                    type="text"
                    value={testEmailSubject}
                    onChange={(e) => setTestEmailSubject(e.target.value)}
                    placeholder="Leave empty to use default test subject"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="testEmailBody" className="block text-sm font-medium text-gray-700 mb-1">
                    Body Content (Optional - HTML supported)
                  </label>
                  <textarea
                    id="testEmailBody"
                    rows={4}
                    value={testEmailBody}
                    onChange={(e) => setTestEmailBody(e.target.value)}
                    placeholder="Leave empty to use default test email content with configuration details"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Only applies to the "General Test Email" button above
                  </p>
                </div>
              </div>
            </details>
          </div>

          {/* Last Test Result */}
          {lastTestResult && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Last Test Result</h3>
              
              {lastTestResult.success ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800 mb-2">
                        Email sent successfully!
                      </p>
                      <div className="space-y-2 text-sm text-green-700">
                        {lastTestResult.messageId && (
                          <div>
                            <span className="font-medium">Message ID:</span>
                            <span className="ml-2 font-mono text-xs">{lastTestResult.messageId}</span>
                          </div>
                        )}
                        {lastTestResult.response && (
                          <div>
                            <span className="font-medium">SMTP Response:</span>
                            <span className="ml-2">{lastTestResult.response}</span>
                          </div>
                        )}
                        {lastTestResult.accepted && lastTestResult.accepted.length > 0 && (
                          <div>
                            <span className="font-medium">Accepted:</span>
                            <span className="ml-2">{lastTestResult.accepted.join(", ")}</span>
                          </div>
                        )}
                        {lastTestResult.rejected && lastTestResult.rejected.length > 0 && (
                          <div className="flex items-start">
                            <XCircle className="h-4 w-4 text-red-600 mr-1 mt-0.5" />
                            <div>
                              <span className="font-medium">Rejected:</span>
                              <span className="ml-2">{lastTestResult.rejected.join(", ")}</span>
                            </div>
                          </div>
                        )}
                        {lastTestResult.timestamp && (
                          <div className="flex items-center text-xs text-green-600 mt-3 pt-3 border-t border-green-200">
                            <Clock className="h-4 w-4 mr-1" />
                            {new Date(lastTestResult.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <p className="text-xs text-green-700">
                      <strong>Next steps:</strong> Check your inbox (and spam folder) to verify the email arrived correctly. 
                      If the email appears in spam, consider reviewing your SPF, DKIM, and DMARC records.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <XCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800 mb-2">
                        Failed to send email
                      </p>
                      {lastTestResult.error && (
                        <div className="text-sm text-red-700 mb-3">
                          <span className="font-medium">Error:</span>
                          <p className="mt-1 font-mono text-xs bg-red-100 p-2 rounded">
                            {lastTestResult.error}
                          </p>
                        </div>
                      )}
                      {lastTestResult.timestamp && (
                        <div className="flex items-center text-xs text-red-600 mt-3 pt-3 border-t border-red-200">
                          <Clock className="h-4 w-4 mr-1" />
                          {new Date(lastTestResult.timestamp).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-red-200">
                    <p className="text-xs text-red-700">
                      <strong>Troubleshooting tips:</strong>
                    </p>
                    <ul className="list-disc list-inside text-xs text-red-700 mt-2 space-y-1">
                      <li>Verify your SMTP credentials are correct</li>
                      <li>Check that your SMTP host and port are accessible</li>
                      <li>Ensure your email account allows SMTP access</li>
                      <li>For Gmail, you may need to enable "Less secure app access" or use an App Password</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Email Monitoring Tips */}
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
              <Info className="h-4 w-4 mr-2 text-gray-600" />
              Email Delivery Best Practices
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
              <li>Regularly test email delivery to different providers (Gmail, Outlook, etc.)</li>
              <li>Monitor your sender reputation using tools like Google Postmaster Tools</li>
              <li>Set up SPF, DKIM, and DMARC records for your domain to improve deliverability</li>
              <li>Keep your email content professional and avoid spam trigger words</li>
              <li>Monitor bounce rates and remove invalid email addresses from your lists</li>
              <li>Consider using a dedicated email service provider for better deliverability</li>
            </ul>
          </div>
        </div>

        {/* Delete Logo Confirmation Dialog */}
        <Transition appear show={showDeleteDialog} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteDialog(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4 text-center">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 flex items-center"
                    >
                      <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                      Remove Company Logo
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to remove the company logo? This will remove it from all future documents until you upload a new one.
                      </p>
                    </div>

                    <div className="mt-6 flex space-x-3 justify-end">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        onClick={() => setShowDeleteDialog(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-lg border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleDeleteLogo}
                        disabled={deleteLogoMutation.isPending}
                      >
                        {deleteLogoMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Removing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Logo
                          </>
                        )}
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Logo Preview Modal */}
        <Transition appear show={showLogoModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowLogoModal(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-75" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white p-4 shadow-xl transition-all max-w-3xl">
                    <button
                      type="button"
                      className="absolute top-2 right-2 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                      onClick={() => setShowLogoModal(false)}
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </button>
                    <div className="mt-8">
                      {logoQuery.data?.logoUrl && (
                        <img
                          src={logoQuery.data.logoUrl}
                          alt="Company Logo - Full Size"
                          className="max-h-[70vh] max-w-full mx-auto object-contain"
                        />
                      )}
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-600">Company Logo - Full Size Preview</p>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
}

// ===== PDF Template & Theme Settings Component =====
const THEME_SWATCHES: Record<string, { primary: string; accent: string; label: string }> = {
  olive: { primary: "#556B2F", accent: "#8FBC8F", label: "Olive" },
  blue: { primary: "#1E3A5F", accent: "#4A90D9", label: "Blue" },
  green: { primary: "#2D5016", accent: "#5A9A47", label: "Green" },
  teal: { primary: "#0D4F4F", accent: "#2BBDB1", label: "Teal" },
  charcoal: { primary: "#2C2C2C", accent: "#888888", label: "Charcoal" },
  red: { primary: "#8B1A1A", accent: "#D4534D", label: "Red" },
};

function PdfSettingsSection() {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const pdfSettingsQuery = useQuery({
    ...trpc.getPdfSettings.queryOptions({ token: token || "" }),
    enabled: !!token,
  });

  const updatePdfSettingsMutation = useMutation(
    trpc.updatePdfSettings.mutationOptions()
  );

  const [selectedLayout, setSelectedLayout] = useState<string>("");
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState<string>("");
  const [companyTagline, setCompanyTagline] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  // Initialize form values from query data
  if (pdfSettingsQuery.data && !initialized) {
    setSelectedLayout(pdfSettingsQuery.data.templateLayout);
    setSelectedTheme(pdfSettingsQuery.data.colorTheme);
    setPaymentTerms(pdfSettingsQuery.data.paymentTerms);
    setCompanyTagline(pdfSettingsQuery.data.companyTagline);
    setInitialized(true);
  }

  const handleSave = async () => {
    try {
      await updatePdfSettingsMutation.mutateAsync({
        token: token || "",
        templateLayout: selectedLayout as "classic" | "modern",
        colorTheme: selectedTheme,
        paymentTerms,
        companyTagline,
      });
      toast.success("PDF settings saved successfully!");
      pdfSettingsQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to save PDF settings");
    }
  };

  if (pdfSettingsQuery.isLoading) {
    return (
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading PDF settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
          <FileText className="h-6 w-6 mr-2 text-indigo-600" />
          PDF Document Settings
        </h2>
        <p className="text-gray-600 text-sm">
          Customize the layout, color theme, and content of your quotation and invoice PDFs.
        </p>
      </div>

      {/* Layout Template Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <Layout className="h-4 w-4 mr-1.5 text-gray-500" />
          Document Layout
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setSelectedLayout("classic")}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              selectedLayout === "classic"
                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">Classic</span>
              {selectedLayout === "classic" && (
                <CheckCircle className="h-5 w-5 text-indigo-600" />
              )}
            </div>
            <p className="text-xs text-gray-500">
              Professional SA accounting layout with FROM/TO sections, detailed line items (Excl. Price, Disc%, VAT%), banking details, and payment terms.
            </p>
            {/* Mini preview */}
            <div className="mt-3 border border-gray-200 rounded-lg p-2 bg-white">
              <div className="flex justify-between mb-1.5">
                <div className="w-8 h-3 bg-gray-300 rounded-sm" />
                <div className="w-12 h-3 bg-gray-200 rounded-sm" />
              </div>
              <div className="flex gap-2 mb-1.5">
                <div className="flex-1 space-y-0.5">
                  <div className="w-full h-1.5 bg-gray-100 rounded-sm" />
                  <div className="w-3/4 h-1.5 bg-gray-100 rounded-sm" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="w-full h-1.5 bg-gray-100 rounded-sm" />
                  <div className="w-3/4 h-1.5 bg-gray-100 rounded-sm" />
                </div>
              </div>
              <div className="w-full h-2 bg-gray-300 rounded-sm mb-1" />
              <div className="space-y-0.5">
                <div className="w-full h-1 bg-gray-100 rounded-sm" />
                <div className="w-full h-1 bg-gray-100 rounded-sm" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLayout("modern")}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              selectedLayout === "modern"
                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">Modern</span>
              {selectedLayout === "modern" && (
                <CheckCircle className="h-5 w-5 text-indigo-600" />
              )}
            </div>
            <p className="text-xs text-gray-500">
              Branded banner style with colored header, logo, BILL TO box, and colored totals bar. Ideal for modern branding.
            </p>
            {/* Mini preview */}
            <div className="mt-3 border border-gray-200 rounded-lg p-2 bg-white">
              <div className="w-full h-4 bg-indigo-400 rounded-sm mb-1.5" />
              <div className="flex gap-2 mb-1.5">
                <div className="flex-1">
                  <div className="w-full h-6 border border-gray-200 rounded-sm p-0.5">
                    <div className="w-1/2 h-1.5 bg-gray-200 rounded-sm" />
                  </div>
                </div>
                <div className="flex-1" />
              </div>
              <div className="w-full h-2 bg-indigo-400 rounded-sm mb-1" />
              <div className="space-y-0.5">
                <div className="w-full h-1 bg-gray-100 rounded-sm" />
                <div className="w-full h-1 bg-gray-100 rounded-sm" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Color Theme Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <Palette className="h-4 w-4 mr-1.5 text-gray-500" />
          Color Theme
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Object.entries(THEME_SWATCHES).map(([key, theme]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedTheme(key)}
              className={`relative rounded-xl border-2 p-3 text-center transition-all ${
                selectedTheme === key
                  ? "border-indigo-500 ring-2 ring-indigo-200 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex justify-center gap-1.5 mb-2">
                <div
                  className="w-6 h-6 rounded-full border border-gray-200"
                  style={{ backgroundColor: theme.primary }}
                />
                <div
                  className="w-6 h-6 rounded-full border border-gray-200"
                  style={{ backgroundColor: theme.accent }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700">{theme.label}</span>
              {selectedTheme === key && (
                <div className="absolute -top-1 -right-1">
                  <CheckCircle className="h-4 w-4 text-indigo-600 bg-white rounded-full" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Company Tagline */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Company Tagline
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Displayed below your company name on PDF documents.
        </p>
        <input
          type="text"
          value={companyTagline}
          onChange={(e) => setCompanyTagline(e.target.value)}
          placeholder="e.g. Unsurpassed Services"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      {/* Payment Terms */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Payment Terms
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Will appear on all quotation and invoice PDFs. Supports multiple lines.
        </p>
        <textarea
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          rows={4}
          placeholder={`e.g.\n1. 50% deposit required before work commences\n2. Balance due within 30 days of invoice date\n3. Late payments subject to 2% monthly interest`}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500 resize-y"
        />
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={updatePdfSettingsMutation.isPending}
          className="inline-flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {updatePdfSettingsMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save PDF Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ResendConfigSection() {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const resendQuery = useQuery({
    ...trpc.getResendSettings.queryOptions({ token: token || "" }),
    enabled: !!token,
  });

  const updateMutation = useMutation(
    trpc.updateResendSettings.mutationOptions()
  );

  const testMutation = useMutation(
    trpc.testResendConnection.mutationOptions()
  );

  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialize form values from query data
  if (resendQuery.data && !initialized) {
    setApiKey(resendQuery.data.resendApiKey);
    setFromEmail(resendQuery.data.resendFromEmail);
    setInitialized(true);
  }

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        token: token || "",
        resendApiKey: apiKey,
        resendFromEmail: fromEmail,
      });
      toast.success("Resend email settings saved successfully!");
      resendQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to save Resend settings");
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error("Please enter a recipient email address");
      return;
    }
    try {
      const result = await testMutation.mutateAsync({
        token: token || "",
        recipientEmail: testEmail,
      });
      toast.success(result.message || "Test email sent successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send test email");
    }
  };

  if (resendQuery.isLoading) {
    return (
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading email API settings...</span>
        </div>
      </div>
    );
  }

  const isConfigured = resendQuery.data?.isConfigured;

  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
          <Globe className="h-6 w-6 mr-2 text-blue-600" />
          Email Delivery (Resend API)
          {isConfigured && (
            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </span>
          )}
        </h2>
        <p className="text-gray-600 text-sm">
          Resend uses HTTP to deliver emails, bypassing SMTP port restrictions from hosting providers like DigitalOcean.
          This is the recommended method for sending system emails (notifications, invoices, statements, etc.).
        </p>
      </div>

      {/* Setup Instructions */}
      {!isConfigured && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center">
            <Info className="h-4 w-4 mr-1.5" />
            Setup Instructions
          </h3>
          <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
            <li>Go to <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">resend.com</a> and create a free account (100 emails/day)</li>
            <li>Add your domain (e.g., square15.co.za) under <strong>Domains</strong> and add the DNS records they provide</li>
            <li>Create an API key under <strong>API Keys</strong></li>
            <li>Paste the API key and your from email address below</li>
          </ol>
        </div>
      )}

      {/* API Key */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Resend API Key
        </label>
        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-12 text-sm font-mono focus:border-blue-500 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* From Email */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          From Email Address
        </label>
        <p className="text-xs text-gray-500 mb-2">
          The email address that will appear as the sender. Your domain must be verified in Resend.
        </p>
        <input
          type="email"
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          placeholder="e.g. thapelochalatsi@square15.co.za"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending || !apiKey}
          className="inline-flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Email API Settings
            </>
          )}
        </button>
      </div>

      {/* Test Email Section */}
      {isConfigured && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <Send className="h-4 w-4 mr-1.5 text-gray-500" />
            Send Test Email
          </h3>
          <div className="flex gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Recipient email address"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testMutation.isPending || !testEmail}
              className="inline-flex items-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors whitespace-nowrap"
            >
              {testMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}