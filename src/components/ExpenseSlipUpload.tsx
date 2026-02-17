import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { Camera, X, Loader2, Upload, FileText } from "lucide-react";
import toast from "react-hot-toast";

export type ExpenseSlip = {
  url: string;
  category: "MATERIALS" | "TOOLS" | "TRANSPORTATION" | "OTHER";
  description?: string;
  amount?: number;
};

interface ExpenseSlipUploadProps {
  onSlipsUploaded: (slips: ExpenseSlip[]) => void;
  minimumSlips?: number;
  title?: string;
  description?: string;
  isPublic?: boolean;
  initialSlips?: ExpenseSlip[];
}

const CATEGORY_OPTIONS = [
  { value: "MATERIALS" as const, label: "Materials" },
  { value: "TOOLS" as const, label: "Tools" },
  { value: "TRANSPORTATION" as const, label: "Transportation" },
  { value: "OTHER" as const, label: "Other" },
];

type PendingSlip = {
  file: File;
  previewUrl: string;
  category: "MATERIALS" | "TOOLS" | "TRANSPORTATION" | "OTHER";
  description: string;
  amount: string;
  aiSuggestion: "MATERIALS" | "TOOLS" | "TRANSPORTATION" | "OTHER" | null;
  loadingAiSuggestion: boolean;
};

export function ExpenseSlipUpload({
  onSlipsUploaded,
  minimumSlips = 1,
  title = "Upload Expense Slips",
  description = "Upload expense documentation and categorize each slip",
  isPublic = false,
  initialSlips,
}: ExpenseSlipUploadProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [pendingSlips, setPendingSlips] = useState<PendingSlip[]>([]);
  const [uploadedSlips, setUploadedSlips] = useState<ExpenseSlip[]>(initialSlips || []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const suggestCategoryMutation = useMutation(
    trpc.suggestExpenseCategory.mutationOptions()
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newPendingSlips = files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        category: "MATERIALS" as const,
        description: "",
        amount: "",
        aiSuggestion: null,
        loadingAiSuggestion: false,
      }));
      setPendingSlips((prev) => [...prev, ...newPendingSlips]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSlip = (index: number) => {
    setPendingSlips((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateSlipCategory = (index: number, category: "MATERIALS" | "TOOLS" | "TRANSPORTATION" | "OTHER") => {
    setPendingSlips((prev) =>
      prev.map((slip, i) => (i === index ? { ...slip, category } : slip))
    );
  };

  const updateSlipDescription = (index: number, description: string) => {
    setPendingSlips((prev) =>
      prev.map((slip, i) => (i === index ? { ...slip, description } : slip))
    );
  };

  const updateSlipAmount = (index: number, amount: string) => {
    setPendingSlips((prev) =>
      prev.map((slip, i) => (i === index ? { ...slip, amount } : slip))
    );
  };

  const requestAiSuggestion = async (index: number) => {
    const slip = pendingSlips[index];
    
    setPendingSlips(prev => 
      prev.map((s, i) => i === index ? { ...s, loadingAiSuggestion: true } : s)
    );
    
    try {
      // Convert file to buffer
      const arrayBuffer = await slip.file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const result = await suggestCategoryMutation.mutateAsync({
        token: token!,
        imageDataBuffer: buffer,
      });
      
      setPendingSlips(prev => 
        prev.map((s, i) => i === index ? { ...s, aiSuggestion: result.suggestedCategory, loadingAiSuggestion: false } : s)
      );
      toast.success(`AI suggests: ${CATEGORY_OPTIONS.find(c => c.value === result.suggestedCategory)?.label}`);
    } catch (error) {
      console.error("Error getting AI suggestion:", error);
      toast.error("Could not get AI suggestion. Please categorize manually.");
      setPendingSlips(prev => 
        prev.map((s, i) => i === index ? { ...s, loadingAiSuggestion: false } : s)
      );
    }
  };

  const applyAiSuggestion = (index: number) => {
    const slip = pendingSlips[index];
    if (slip.aiSuggestion) {
      updateSlipCategory(index, slip.aiSuggestion);
      toast.success("AI suggestion applied");
    }
  };

  const handleUpload = async () => {
    if (pendingSlips.length < minimumSlips) {
      toast.error(`Please select at least ${minimumSlips} expense slip${minimumSlips !== 1 ? "s" : ""}`);
      return;
    }

    try {
      setUploading(true);
      const slips: ExpenseSlip[] = [];

      for (const pendingSlip of pendingSlips) {
        try {
          // Get presigned URL
          const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
            token: token!,
            fileName: pendingSlip.file.name,
            fileType: pendingSlip.file.type,
            isPublic,
          });

          // Upload file to MinIO
          const uploadResponse = await fetch(presignedUrl, {
            method: "PUT",
            body: pendingSlip.file,
            headers: {
              "Content-Type": pendingSlip.file.type,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${pendingSlip.file.name}`);
          }

          // Build expense slip object
          const slip: ExpenseSlip = {
            url: fileUrl,
            category: pendingSlip.category,
            description: pendingSlip.description || undefined,
            amount: pendingSlip.amount ? parseFloat(pendingSlip.amount) : undefined,
          };

          slips.push(slip);
        } catch (error) {
          console.error(`Error uploading ${pendingSlip.file.name}:`, error);
          toast.error(`Failed to upload ${pendingSlip.file.name}`);
          setUploading(false);
          return;
        }
      }

      const mergedSlips = [...uploadedSlips, ...slips];
      setUploadedSlips(mergedSlips);
      toast.success(`Successfully uploaded ${slips.length} expense slip${slips.length !== 1 ? "s" : ""}`);
      onSlipsUploaded(mergedSlips);

      // Clean up preview URLs
      pendingSlips.forEach((slip) => URL.revokeObjectURL(slip.previewUrl));
      setPendingSlips([]);
      setUploading(false);
    } catch (error) {
      console.error("Error uploading expense slips:", error);
      toast.error("Failed to upload expense slips");
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload Button */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FileText className="h-5 w-5 mr-2" />
          {uploadedSlips.length > 0 ? "Add More Files" : "Select Files"}
        </button>
        <span className="text-sm text-gray-600 text-center sm:text-left">
          {uploadedSlips.length > 0
            ? `${uploadedSlips.length} uploaded${pendingSlips.length > 0 ? `, ${pendingSlips.length} pending` : ""}`
            : `${pendingSlips.length} selected / ${minimumSlips} minimum`
          }
        </span>
      </div>

      {/* Pending Slips with Category Selection */}
      {pendingSlips.length > 0 && (
        <div className="mb-4 space-y-4">
          {pendingSlips.map((slip, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4 relative">
              <button
                type="button"
                onClick={() => removeSlip(index)}
                disabled={uploading}
                className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
                aria-label="Remove slip"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {/* Preview */}
                <div>
                  {slip.file.type.startsWith("image/") ? (
                    <img
                      src={slip.previewUrl}
                      alt={`Slip ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                      <FileText className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <p className="text-xs text-gray-600 mt-2 truncate">{slip.file.name}</p>
                </div>

                {/* Metadata */}
                <div className="space-y-3">
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={slip.category}
                      onChange={(e) =>
                        updateSlipCategory(
                          index,
                          e.target.value as "MATERIALS" | "TOOLS" | "TRANSPORTATION" | "OTHER"
                        )
                      }
                      disabled={uploading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 text-sm"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* AI Suggestion */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AI Suggestion
                    </label>
                    {slip.aiSuggestion ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                        <div className="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                          <span className="font-medium text-blue-900">
                            {CATEGORY_OPTIONS.find(c => c.value === slip.aiSuggestion)?.label}
                          </span>
                        </div>
                        {slip.category !== slip.aiSuggestion && (
                          <button
                            type="button"
                            onClick={() => applyAiSuggestion(index)}
                            disabled={uploading}
                            className="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestAiSuggestion(index)}
                        disabled={uploading || slip.loadingAiSuggestion}
                        className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {slip.loadingAiSuggestion ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Get AI Suggestion
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (R) - Optional
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slip.amount}
                      onChange={(e) => updateSlipAmount(index, e.target.value)}
                      disabled={uploading}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 text-sm"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description - Optional
                    </label>
                    <input
                      type="text"
                      value={slip.description}
                      onChange={(e) => updateSlipDescription(index, e.target.value)}
                      disabled={uploading}
                      placeholder="Brief description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Action Button */}
      {pendingSlips.length > 0 && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || pendingSlips.length < minimumSlips}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 mr-2" />
              Upload {pendingSlips.length} Slip{pendingSlips.length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}

      {/* Uploaded Slips Display */}
      {uploadedSlips.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800 mb-2">
            ✓ {uploadedSlips.length} expense slip{uploadedSlips.length !== 1 ? "s" : ""} uploaded successfully
          </p>
          <div className="space-y-1">
            {uploadedSlips.map((slip, index) => (
              <div key={index} className="text-xs text-green-700">
                • {slip.category}
                {slip.amount && ` - R${slip.amount.toFixed(2)}`}
                {slip.description && ` - ${slip.description}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
