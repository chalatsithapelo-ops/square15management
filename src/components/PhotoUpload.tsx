import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { Camera, X, Loader2, Upload } from "lucide-react";
import toast from "react-hot-toast";

interface PhotoUploadProps {
  onPhotosUploaded: (urls: string[]) => void;
  minimumPhotos?: number;
  title?: string;
  description?: string;
  isPublic?: boolean;
  initialUrls?: string[];
}

export function PhotoUpload({
  onPhotosUploaded,
  minimumPhotos = 3,
  title = "Upload Photos",
  description = `Please upload at least ${minimumPhotos} photos`,
  isPublic = true,
  initialUrls,
}: PhotoUploadProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [pendingPhotos, setPendingPhotos] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>(initialUrls || []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Validate file types
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
      const invalidFiles = files.filter((file) => !validTypes.includes(file.type));
      
      if (invalidFiles.length > 0) {
        toast.error("Only image files (JPEG, PNG, WEBP, GIF) are allowed");
        return;
      }

      // Validate file sizes (max 10MB per file)
      const maxSize = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = files.filter((file) => file.size > maxSize);
      
      if (oversizedFiles.length > 0) {
        toast.error("File size must be less than 10MB");
        return;
      }

      // Create objects with both file and preview URL
      const newPhotos = files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setPendingPhotos((prev) => [...prev, ...newPhotos]);
      toast.success(`${files.length} photo${files.length !== 1 ? "s" : ""} selected`);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setPendingPhotos((prev) => {
      // Revoke the object URL to free memory
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpload = async () => {
    if (pendingPhotos.length < minimumPhotos && uploadedUrls.length === 0) {
      toast.error(`Please select at least ${minimumPhotos} photos`);
      return;
    }

    if (!token) {
      toast.error("Authentication required. Please log in again.");
      return;
    }

    try {
      setUploading(true);
      const urls: string[] = [...uploadedUrls]; // Keep existing uploads
      let successCount = 0;

      for (const photo of pendingPhotos) {
        try {
          // Get presigned URL
          const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
            token,
            fileName: photo.file.name,
            fileType: photo.file.type,
            isPublic,
          });

          // Upload file to MinIO
          const uploadResponse = await fetch(presignedUrl, {
            method: "PUT",
            body: photo.file,
            headers: {
              "Content-Type": photo.file.type,
            },
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`Upload failed for ${photo.file.name}:`, {
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              body: errorText,
            });
            throw new Error(`Failed to upload ${photo.file.name}: ${uploadResponse.statusText}`);
          }

          urls.push(fileUrl);
          successCount++;
        } catch (error) {
          console.error(`Error uploading ${photo.file.name}:`, error);
          
          // Provide more detailed error message
          if (error instanceof Error) {
            if (error.message.includes("Network")) {
              toast.error(`Network error uploading ${photo.file.name}. Check your connection.`);
            } else if (error.message.includes("401") || error.message.includes("403")) {
              toast.error("Authentication error. Please log in again.");
            } else {
              toast.error(`Failed to upload ${photo.file.name}: ${error.message}`);
            }
          } else {
            toast.error(`Failed to upload ${photo.file.name}`);
          }
          
          setUploading(false);
          return;
        }
      }

      setUploadedUrls(urls);
      toast.success(`Successfully uploaded ${successCount} photo${successCount !== 1 ? 's' : ''}`);
      onPhotosUploaded(urls);
      
      // Clean up preview URLs
      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setPendingPhotos([]);
      setUploading(false);
    } catch (error) {
      console.error("Error uploading photos:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to upload photos: ${errorMessage}`);
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
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
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
          <Camera className="h-5 w-5 mr-2" />
          {uploadedUrls.length > 0 ? "Add More Photos" : "Select Photos"}
        </button>
        <span className="text-sm text-gray-600 text-center sm:text-left">
          {uploadedUrls.length > 0 
            ? `${uploadedUrls.length} uploaded` 
            : `${pendingPhotos.length} selected / ${minimumPhotos} minimum`
          }
        </span>
      </div>

      {/* Preview Grid */}
      {pendingPhotos.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {pendingPhotos.map((photo, index) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={photo.previewUrl}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                  className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 p-1 sm:p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Action Button */}
      {pendingPhotos.length > 0 && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || (pendingPhotos.length + uploadedUrls.length < minimumPhotos)}
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
              Upload {pendingPhotos.length} Photo{pendingPhotos.length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}

      {/* Uploaded Photos Display */}
      {uploadedUrls.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800">
            ✓ {uploadedUrls.length} photo{uploadedUrls.length !== 1 ? "s" : ""} uploaded successfully
          </p>
        </div>
      )}
    </div>
  );
}
