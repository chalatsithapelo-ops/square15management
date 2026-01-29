import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { FileText, X, Loader2, Upload, Image } from "lucide-react";
import toast from "react-hot-toast";
import { SignedMinioImage, SignedMinioLink } from "~/components/SignedMinioUrl";

interface FileUploadProps {
  onFilesUploaded: (urls: string[]) => void;
  minimumFiles?: number;
  title?: string;
  description?: string;
  isPublic?: boolean;
  acceptedTypes?: string[];
}

export function FileUpload({
  onFilesUploaded,
  minimumFiles = 1,
  title = "Upload Files",
  description = `Please upload at least ${minimumFiles} file(s)`,
  isPublic = true,
  acceptedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
}: FileUploadProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [pendingFiles, setPendingFiles] = useState<Array<{ file: File; previewUrl?: string; name: string }>>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Validate file types
      const invalidFiles = files.filter((file) => !acceptedTypes.includes(file.type));
      
      if (invalidFiles.length > 0) {
        toast.error("Invalid file type. Please upload images or PDF/Word documents.");
        return;
      }

      // Validate file sizes (max 10MB per file)
      const maxSize = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = files.filter((file) => file.size > maxSize);
      
      if (oversizedFiles.length > 0) {
        toast.error("Some files exceed 10MB. Please select smaller files.");
        return;
      }

      // Add files to pending list
      const newFiles = files.map((file) => {
        const isImage = file.type.startsWith("image/");
        return {
          file,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
          name: file.name,
        };
      });

      setPendingFiles((prev) => [...prev, ...newFiles]);

      // Auto-upload
      uploadFiles([...pendingFiles, ...newFiles]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFiles = async (filesToUpload: Array<{ file: File; previewUrl?: string; name: string }>) => {
    console.log("Upload attempt - Token available:", !!token);
    console.log("Token value:", token ? `${token.substring(0, 20)}...` : "null");
    
    if (!token) {
      console.error("No token available for upload");
      toast.error("Please log in to upload files");
      return;
    }

    setUploading(true);
    const newUploadedUrls: string[] = [];

    try {
      for (const fileObj of filesToUpload) {
        const { file } = fileObj;

        console.log("Requesting presigned URL for:", file.name);
        
        // Get presigned URL
        const presignedData = await getPresignedUrlMutation.mutateAsync({
          token,
          fileName: file.name,
          fileType: file.type,
          isPublic,
        });

        console.log("Presigned URL received:", presignedData.presignedUrl);
        console.log("File URL:", presignedData.fileUrl);

        // Upload to MinIO
        const uploadResponse = await fetch(presignedData.presignedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        console.log("Upload response status:", uploadResponse.status);

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("Upload failed:", errorText);
          throw new Error(`Failed to upload ${file.name}: ${uploadResponse.statusText}`);
        }

        newUploadedUrls.push(presignedData.fileUrl);
      }

      // Update state
      const allUrls = [...uploadedUrls, ...newUploadedUrls];
      setUploadedUrls(allUrls);
      onFilesUploaded(allUrls);
      setPendingFiles([]);

      toast.success(`${newUploadedUrls.length} file(s) uploaded successfully!`);
    } catch (error: any) {
      console.error("Upload error:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast.error(error.message || "Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    const newPendingFiles = pendingFiles.filter((_, i) => i !== index);
    setPendingFiles(newPendingFiles);

    // Revoke object URL if it's an image
    const fileObj = pendingFiles[index];
    if (fileObj?.previewUrl) {
      URL.revokeObjectURL(fileObj.previewUrl);
    }
  };

  const removeUploadedFile = (index: number) => {
    const newUploadedUrls = uploadedUrls.filter((_, i) => i !== index);
    setUploadedUrls(newUploadedUrls);
    onFilesUploaded(newUploadedUrls);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const isMinimumMet = uploadedUrls.length >= minimumFiles;

  return (
    <div className="space-y-4">
      <div>
        <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {title}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {description}
        </p>

        {/* Upload Button */}
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="file-upload"
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploading
                ? "border-gray-300 bg-gray-50 cursor-not-allowed"
                : "border-gray-300 hover:border-purple-500 bg-gray-50 hover:bg-purple-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <Loader2 className="h-10 w-10 text-gray-400 animate-spin mb-3" />
              ) : (
                <Upload className="h-10 w-10 text-gray-400 mb-3" />
              )}
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Images, PDF, or Word documents (Max 10MB each)
              </p>
            </div>
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept={acceptedTypes.join(",")}
              multiple
              disabled={uploading}
            />
          </label>
        </div>

        {/* Pending Files */}
        {pendingFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Uploading...
            </p>
            {pendingFiles.map((fileObj, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {fileObj.previewUrl ? (
                    <img
                      src={fileObj.previewUrl}
                      alt={`Preview ${index + 1}`}
                      className="h-12 w-12 object-cover rounded"
                    />
                  ) : (
                    getFileIcon(fileObj.name)
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                      {fileObj.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(fileObj.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                  disabled={uploading}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Uploaded Files */}
        {uploadedUrls.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Uploaded Files ({uploadedUrls.length})
              {!isMinimumMet && (
                <span className="ml-2 text-xs text-red-600">
                  (Need at least {minimumFiles})
                </span>
              )}
            </p>
            {uploadedUrls.map((url, index) => {
              const fileName = url.split('/').pop() || `File ${index + 1}`;
              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
              
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {isImage ? (
                      <SignedMinioLink url={url} target="_blank" rel="noopener noreferrer">
                        <SignedMinioImage
                          url={url}
                          alt={`Upload ${index + 1}`}
                          className="h-12 w-12 object-cover rounded cursor-pointer hover:opacity-75"
                        />
                      </SignedMinioLink>
                    ) : (
                      <div className="h-12 w-12 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded">
                        {getFileIcon(fileName)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                        {fileName}
                      </p>
                      <SignedMinioLink
                        url={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        View file
                      </SignedMinioLink>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUploadedFile(index)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Validation Message */}
        {uploadedUrls.length > 0 && !isMinimumMet && (
          <p className="mt-2 text-sm text-red-600">
            Please upload at least {minimumFiles} file(s).
          </p>
        )}
      </div>
    </div>
  );
}
