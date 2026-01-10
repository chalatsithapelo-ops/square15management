import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  Plus,
  FileText,
  Upload,
  Trash2,
  Download,
  X,
  Calendar,
  User,
  Loader2,
} from "lucide-react";
import { Dialog } from "@headlessui/react";

const documentUploadSchema = z.object({
  employeeId: z.number().min(1, "Please select an employee"),
  documentType: z.enum([
    "CONTRACT",
    "ID_DOCUMENT",
    "QUALIFICATION",
    "CERTIFICATE",
    "PERFORMANCE_REVIEW",
    "WARNING",
    "OTHER",
  ]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

type DocumentUploadForm = z.infer<typeof documentUploadSchema>;

const documentTypeLabels: Record<string, string> = {
  CONTRACT: "Contract",
  ID_DOCUMENT: "ID Document",
  QUALIFICATION: "Qualification",
  CERTIFICATE: "Certificate",
  PERFORMANCE_REVIEW: "Performance Review",
  WARNING: "Warning",
  OTHER: "Other",
};

const documentTypeColors: Record<string, string> = {
  CONTRACT: "bg-purple-100 text-purple-800",
  ID_DOCUMENT: "bg-blue-100 text-blue-800",
  QUALIFICATION: "bg-green-100 text-green-800",
  CERTIFICATE: "bg-yellow-100 text-yellow-800",
  PERFORMANCE_REVIEW: "bg-orange-100 text-orange-800",
  WARNING: "bg-red-100 text-red-800",
  OTHER: "bg-gray-100 text-gray-800",
};

export function DocumentsTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const employeesQuery = useQuery(
    trpc.getEmployees.queryOptions({
      token: token!,
    })
  );

  const documentsQuery = useQuery(
    trpc.getHRDocuments.queryOptions({
      token: token!,
      employeeId: selectedEmployee || undefined,
      documentType: typeFilter as any,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<DocumentUploadForm>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      documentType: "CONTRACT",
    },
  });

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const uploadDocumentMutation = useMutation(
    trpc.uploadHRDocument.mutationOptions({
      onSuccess: () => {
        toast.success("Document uploaded successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getHRDocuments.queryKey() });
        setShowUploadForm(false);
        setSelectedFile(null);
        reset();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to upload document");
      },
    })
  );

  const deleteDocumentMutation = useMutation(
    trpc.deleteHRDocument.mutationOptions({
      onSuccess: () => {
        toast.success("Document deleted successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getHRDocuments.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete document");
      },
    })
  );

  const employees = employeesQuery.data || [];
  const documents = documentsQuery.data || [];

  const onSubmit = async (data: DocumentUploadForm) => {
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      setUploading(true);

      // Get presigned URL
      const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
        token: token!,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
      });

      // Upload file to MinIO
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Save document metadata
      await uploadDocumentMutation.mutateAsync({
        token: token!,
        employeeId: data.employeeId,
        documentType: data.documentType,
        title: data.title,
        description: data.description,
        fileUrl,
        fileName: selectedFile.name,
        expiryDate: data.expiryDate,
        notes: data.notes,
      });

      setUploading(false);
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Failed to upload document");
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDelete = (documentId: number) => {
    if (confirm("Are you sure you want to delete this document?")) {
      deleteDocumentMutation.mutate({
        token: token!,
        documentId,
      });
    }
  };

  const typeStats = Object.keys(documentTypeLabels).map((type) => ({
    type,
    label: documentTypeLabels[type],
    count: documents.filter((d) => d.documentType === type).length,
  }));

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {typeStats.map((stat) => (
          <button
            key={stat.type}
            onClick={() => setTypeFilter(typeFilter === stat.type ? null : stat.type)}
            className={`p-3 rounded-lg border-2 transition-all text-center ${
              typeFilter === stat.type
                ? "border-purple-600 bg-purple-50"
                : "border-gray-200 bg-white hover:border-purple-300"
            }`}
          >
            <div className="text-xl font-bold text-gray-900 mb-1">{stat.count}</div>
            <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${documentTypeColors[stat.type]}`}>
              {stat.label}
            </div>
          </button>
        ))}
      </div>

      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <select
          value={selectedEmployee || ""}
          onChange={(e) => setSelectedEmployee(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Employees</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowUploadForm(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Upload Document
        </button>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.map((doc) => (
          <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${documentTypeColors[doc.documentType]}`}>
                    {documentTypeLabels[doc.documentType]}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{doc.title}</h3>
                {doc.description && (
                  <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2 text-gray-400" />
                {doc.employee.firstName} {doc.employee.lastName}
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                Uploaded {new Date(doc.createdAt).toLocaleDateString()}
              </div>
              {doc.expiryDate && (
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  Expires {new Date(doc.expiryDate).toLocaleDateString()}
                </div>
              )}
              {doc.uploadedBy && (
                <div className="text-xs text-gray-500">
                  By {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                </div>
              )}
            </div>

            {doc.notes && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-600">{doc.notes}</p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                View
              </a>
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deleteDocumentMutation.isPending}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {documents.length === 0 && (
          <div className="col-span-full p-12 text-center bg-white rounded-xl border border-gray-200">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No documents found</p>
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      <Dialog
        open={showUploadForm}
        onClose={() => {
          if (!uploading) {
            setShowUploadForm(false);
            setSelectedFile(null);
          }
        }}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Upload Document
              </Dialog.Title>
              {!uploading && (
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setSelectedFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee *
                    </label>
                    <select
                      {...register("employeeId", { valueAsNumber: true })}
                      disabled={uploading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    >
                      <option value="">Select an employee</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} - {emp.role}
                        </option>
                      ))}
                    </select>
                    {errors.employeeId && (
                      <p className="mt-1 text-sm text-red-600">{errors.employeeId.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Document Type *
                    </label>
                    <select
                      {...register("documentType")}
                      disabled={uploading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    >
                      {Object.entries(documentTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      {...register("title")}
                      disabled={uploading}
                      placeholder="e.g., Employment Contract 2024"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                    {errors.title && (
                      <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      {...register("description")}
                      disabled={uploading}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Date (Optional)
                    </label>
                    <input
                      type="date"
                      {...register("expiryDate")}
                      disabled={uploading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      {...register("notes")}
                      disabled={uploading}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      File *
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full inline-flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      {selectedFile ? selectedFile.name : "Choose File"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadForm(false);
                    setSelectedFile(null);
                  }}
                  disabled={uploading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </>
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
