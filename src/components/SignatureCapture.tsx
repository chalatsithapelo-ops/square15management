import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { PenTool, RotateCcw, Check, Loader2, Upload } from "lucide-react";
import toast from "react-hot-toast";

interface SignatureCaptureProps {
  onSignatureCaptured: (url: string) => void;
  label?: string;
  description?: string;
}

export function SignatureCapture({
  onSignatureCaptured,
  label = "Customer Signature",
  description = "Please capture the customer's signature below",
}: SignatureCaptureProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Configure drawing style
    context.strokeStyle = "#000000";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setUploadedUrl(null);
    setSignatureDataUrl(null);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) {
      toast.error("Please draw a signature first");
      return;
    }

    try {
      setUploading(true);

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        }, "image/png");
      });

      // Generate filename with timestamp
      const fileName = `signature-${Date.now()}.png`;

      // Get presigned URL
      const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
        token: token!,
        fileName: fileName,
        fileType: "image/png",
        isPublic: false,
      });

      // Upload to MinIO
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": "image/png",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload signature");
      }

      // Save data URL for preview
      const dataUrl = canvas.toDataURL("image/png");
      setSignatureDataUrl(dataUrl);
      setUploadedUrl(fileUrl);
      
      toast.success("Signature captured successfully!");
      onSignatureCaptured(fileUrl);
      setUploading(false);
    } catch (error) {
      console.error("Error uploading signature:", error);
      toast.error("Failed to upload signature");
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>

      {!uploadedUrl ? (
        <>
          {/* Canvas for signature drawing */}
          <div className="mb-4">
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawingTouch}
                onTouchMove={drawTouch}
                onTouchEnd={stopDrawingTouch}
                className="w-full h-48 sm:h-56 cursor-crosshair touch-none"
                style={{ touchAction: "none" }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              <PenTool className="h-3 w-3 inline mr-1" />
              Draw the customer's signature in the box above
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={clearSignature}
              disabled={!hasSignature || uploading}
              className="flex-1 flex items-center justify-center px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear
            </button>
            <button
              type="button"
              onClick={saveSignature}
              disabled={!hasSignature || uploading}
              className="flex-1 flex items-center justify-center px-4 py-2.5 sm:py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Save Signature
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Signature preview after upload */}
          <div className="mb-4">
            <div className="border-2 border-green-300 rounded-lg overflow-hidden bg-green-50 p-4">
              {signatureDataUrl && (
                <img
                  src={signatureDataUrl}
                  alt="Captured signature"
                  className="w-full h-auto"
                />
              )}
            </div>
          </div>

          {/* Success message and recapture option */}
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm font-medium text-green-800">
                Signature captured successfully
              </span>
            </div>
            <button
              type="button"
              onClick={clearSignature}
              className="text-sm text-green-700 hover:text-green-800 font-medium"
            >
              Recapture
            </button>
          </div>
        </>
      )}
    </div>
  );
}
