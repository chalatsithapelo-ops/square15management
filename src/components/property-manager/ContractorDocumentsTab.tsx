import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { Upload, FileText, Trash2, Download, Calendar, AlertCircle, Loader2 } from "lucide-react";
import { Dialog } from "@headlessui/react";

interface ContractorDocumentsTabProps {
  contractorId: number;
}

export function ContractorDocumentsTab({ contractorId }: ContractorDocumentsTabProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [formData, setFormData] = useState({
    documentType: "LICENSE",
    title: "",
    description: "",
    expiryDate: "",
    fileUrl: "",
    fileName: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch documents
  const documentsQuery = useQuery(
    trpc.getContractorDocuments.queryOptions({
      token: token!,
      contractorId,
    })
  );

  const documents = documentsQuery.data?.documents || [];

  // Upload document mutation
  const uploadDocumentMutation = useMutation(
    trpc.uploadContractorDocument.mutationOptions({
      onSuccess: () => {
        toast.success("Document uploaded successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getContractorDocuments.queryKey(),
        });
        setShowUploadForm(false);
        resetForm();
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to upload document");
      },
    })
  );

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Authentication required");
      return;
    }

    if (!formData.title) {
      toast.error("Please provide a title");
      return;
    }

    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);

    try {
      // Convert file to base64
      const base64 = await convertFileToBase64(selectedFile);
      
      // Create file URL from base64 (you can modify this to upload to cloud storage)
      const fileUrl = base64;

      uploadDocumentMutation.mutate({
        token,
        contractorId,
        documentType: formData.documentType,
        title: formData.title,
        description: formData.description,
        fileUrl: fileUrl,
        fileName: selectedFile.name,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined,
      });
    } catch (error) {
      toast.error("Failed to process file");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      // Auto-populate title if empty
      if (!formData.title) {
        setFormData({ ...formData, title: file.name.replace(/\.[^/.]+$/, "") });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      documentType: "LICENSE",
      title: "",
      description: "",
      expiryDate: "",
      fileUrl: "",
      fileName: "",
    });
    setSelectedFile(null);
  };

  const documentTypes = [
    { value: "LICENSE", label: "License" },
    { value: "INSURANCE", label: "Insurance" },
    { value: "CERTIFICATION", label: "Certification" },
    { value: "CONTRACT", label: "Contract" },
    { value: "TAX_CLEARANCE", label: "Tax Clearance" },
    { value: "ID_DOCUMENT", label: "ID Document" },
    { value: "BANK_STATEMENT", label: "Bank Statement" },
    { value: "OTHER", label: "Other" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900">Documents</h3>
        <button
          onClick={() => setShowUploadForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Documents List */}
      {documentsQuery.isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((doc: any) => (
            <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-gray-900">{doc.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Type: <span className="font-medium">{doc.documentType.replace(/_/g, " ")}</span>
                  </p>
                  {doc.description && (
                    <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                  )}
                  {doc.expiryDate && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Document Modal */}
      <Dialog open={showUploadForm} onClose={() => setShowUploadForm(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-lg shadow-xl p-6">
            <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">
              Upload Document
            </Dialog.Title>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type *
                </label>
                <select
                  value={formData.documentType}
                  onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File *
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                    required
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Supported formats: PDF, Word, Excel, Images (Max 10MB)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Date (if applicable)
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadForm(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadDocumentMutation.isPending || uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploadDocumentMutation.isPending || uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload"
                  )}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
