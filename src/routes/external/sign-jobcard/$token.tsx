import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute("/external/sign-jobcard/$token")({
  component: ExternalSignJobCardPage,
});

function ExternalSignJobCardPage() {
  const { token } = useParams({ from: "/external/sign-jobcard/$token" });
  const trpc = useTRPC();

  const [clientRepName, setClientRepName] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const orderQuery = useQuery(
    trpc.getOrderForSigning.queryOptions(
      { signatureToken: token },
      { enabled: !!token, retry: false }
    )
  );

  const submitMutation = useMutation(
    trpc.submitRemoteSignature.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message);
        setSubmitted(true);
      },
      onError: (err) => toast.error(err.message || "Failed to submit signature"),
    })
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.strokeStyle = "#000000";
      context.lineWidth = 2;
      context.lineCap = "round";
      context.lineJoin = "round";
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [orderQuery.data]);

  const getPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ("touches" in e) e.preventDefault();
    const pos = getPosition(e);
    if (!pos) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.beginPath();
    context.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ("touches" in e) e.preventDefault();
    if (!isDrawing) return;
    const pos = getPosition(e);
    if (!pos) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.lineTo(pos.x, pos.y);
    context.stroke();
  };

  const stopDrawing = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e && "touches" in e) e.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmit = async () => {
    if (!clientRepName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!hasSignature) {
      toast.error("Please draw your signature");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureDataUrl = canvas.toDataURL("image/png");

    submitMutation.mutate({
      signatureToken: token,
      signatureDataUrl,
      clientRepName: clientRepName.trim(),
    });
  };

  // Loading state
  if (orderQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
      </div>
    );
  }

  // Error / invalid token
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-lg font-semibold text-gray-900">Invalid or Expired Link</h1>
          <p className="mt-2 text-sm text-gray-600">
            This signature request link is invalid or has expired. Please contact the property management team for a new link.
          </p>
        </div>
      </div>
    );
  }

  const data = orderQuery.data;

  // Already signed
  if (data.alreadySigned) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-lg font-semibold text-gray-900">Already Signed</h1>
          <p className="mt-2 text-sm text-gray-600">
            This job card (Order {data.order.orderNumber}) has already been signed
            {data.order.clientRepName ? ` by ${data.order.clientRepName}` : ""}
            {data.order.clientRepSignDate
              ? ` on ${new Date(data.order.clientRepSignDate).toLocaleDateString("en-ZA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}`
              : ""}
            .
          </p>
          <p className="mt-2 text-sm text-gray-500">Thank you!</p>
        </div>
      </div>
    );
  }

  // Successfully submitted
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Toaster position="top-center" />
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-lg font-semibold text-green-800">Signature Submitted</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your signature for Order {data.order.orderNumber} has been recorded successfully. 
            The job card has been updated.
          </p>
          <p className="mt-4 text-sm text-gray-500">You can close this page now. Thank you!</p>
        </div>
      </div>
    );
  }

  const order = data.order;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <Toaster position="top-center" />
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-green-800 text-white p-5 rounded-t-lg">
          <h1 className="text-xl font-bold">Job Card Signature</h1>
          <p className="text-green-100 text-sm mt-1">Order {order.orderNumber}</p>
        </div>

        {/* Order Details */}
        <div className="bg-white border border-gray-200 border-t-0 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Job Details</h2>
          <div className="space-y-2 text-sm">
            {"customerName" in order && order.customerName && (
              <div className="flex">
                <span className="font-medium text-gray-700 w-28 flex-shrink-0">Customer:</span>
                <span className="text-gray-900">{order.customerName}</span>
              </div>
            )}
            {"address" in order && order.address && (
              <div className="flex">
                <span className="font-medium text-gray-700 w-28 flex-shrink-0">Address:</span>
                <span className="text-gray-900">{order.address}</span>
              </div>
            )}
            {"serviceType" in order && order.serviceType && (
              <div className="flex">
                <span className="font-medium text-gray-700 w-28 flex-shrink-0">Service:</span>
                <span className="text-gray-900">{order.serviceType}</span>
              </div>
            )}
            {"description" in order && order.description && (
              <div className="flex">
                <span className="font-medium text-gray-700 w-28 flex-shrink-0">Description:</span>
                <span className="text-gray-900 whitespace-pre-wrap">{order.description}</span>
              </div>
            )}
            {"artisanName" in order && order.artisanName && (
              <div className="flex">
                <span className="font-medium text-gray-700 w-28 flex-shrink-0">Artisan:</span>
                <span className="text-gray-900">{order.artisanName}</span>
              </div>
            )}
            {"startTime" in order && order.startTime && (
              <div className="flex">
                <span className="font-medium text-gray-700 w-28 flex-shrink-0">Started:</span>
                <span className="text-gray-900">
                  {new Date(order.startTime).toLocaleString("en-ZA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            )}
            {"endTime" in order && order.endTime && (
              <div className="flex">
                <span className="font-medium text-gray-700 w-28 flex-shrink-0">Completed:</span>
                <span className="text-gray-900">
                  {new Date(order.endTime).toLocaleString("en-ZA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Signature Section */}
        <div className="bg-white border border-gray-200 border-t-0 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Signature</h2>
          
          <p className="text-sm text-gray-600 mb-4">
            By signing below, you confirm that the work described above has been completed to your satisfaction.
          </p>

          {/* Name Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name *</label>
            <input
              type="text"
              value={clientRepName}
              onChange={(e) => setClientRepName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Signature Canvas */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Draw Your Signature *</label>
              {hasSignature && (
                <button
                  onClick={clearSignature}
                  className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                >
                  ↺ Clear
                </button>
              )}
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white relative" style={{ touchAction: "none" }}>
              <canvas
                ref={canvasRef}
                className="w-full cursor-crosshair"
                style={{ height: "200px" }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-gray-400 text-sm">Draw your signature here</p>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !hasSignature || !clientRepName.trim()}
            className="w-full bg-green-700 text-white py-3 px-4 rounded-lg font-medium text-sm hover:bg-green-800 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              "Submit Signature"
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 border border-gray-200 border-t-0 rounded-b-lg p-4">
          <p className="text-xs text-gray-500 text-center">
            This is a secure electronic signature page. Your signature will be recorded and attached to the job card.
          </p>
        </div>
      </div>
    </div>
  );
}
