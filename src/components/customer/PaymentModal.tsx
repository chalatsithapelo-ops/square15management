import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CreditCard, Upload, AlertCircle, DollarSign, X, FileText, Image as ImageIcon } from "lucide-react";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedRentAmount?: number;
}

const paymentSchema = z.object({
  paymentType: z.enum(["RENT", "UTILITIES", "CLAIM"]),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "CARD", "EFT"]),
  transactionReference: z.string().optional(),
  paymentDate: z.string().min(1, "Payment date is required"),
  paymentMonth: z.string().optional(),
  deviationReason: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormInput = z.infer<typeof paymentSchema>;

interface UploadedFile {
  file: File;
  preview?: string;
  url?: string;
  uploading: boolean;
  error?: string;
}

export function PaymentModal({ isOpen, onClose, expectedRentAmount }: PaymentModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<PaymentFormInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentType: "RENT",
      paymentMethod: "BANK_TRANSFER",
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  const amount = watch("amount");
  const paymentType = watch("paymentType");

  const showDeviationWarning = paymentType === "RENT" && expectedRentAmount && amount && Math.abs(amount - expectedRentAmount) > 0.01;

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const submitPaymentMutation = useMutation(
    trpc.submitCustomerPayment.mutationOptions({
      onSuccess: () => {
        toast.success("Payment submitted successfully! Awaiting property manager approval.");
        queryClient.invalidateQueries({
          queryKey: trpc.getCustomerPayments.queryKey(),
        });
        handleClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to submit payment.");
        console.error(error);
      },
    })
  );

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!token) {
      toast.error("Please log in to upload files");
      return;
    }

    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const maxSize = 10 * 1024 * 1024; // 10MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name}: Invalid file type. Only images and documents allowed.`);
        continue;
      }

      if (file.size > maxSize) {
        toast.error(`${file.name}: File too large. Maximum size is 10MB.`);
        continue;
      }

      const newFile: UploadedFile = {
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        uploading: true,
      };

      setUploadedFiles(prev => [...prev, newFile]);

      try {
        // Get presigned URL
        const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
          token,
          fileName: file.name,
          fileType: file.type,
          isPublic: true,
        });

        // Upload to MinIO
        const uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        // Update file with URL
        setUploadedFiles(prev => prev.map(f => 
          f.file === file ? { ...f, url: fileUrl, uploading: false } : f
        ));

        toast.success(`${file.name} uploaded successfully!`);
      } catch (error) {
        console.error('Upload error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        
        setUploadedFiles(prev => prev.map(f => 
          f.file === file ? { ...f, uploading: false, error: errorMessage } : f
        ));
        
        toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const file = prev[index];
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const onSubmit: SubmitHandler<PaymentFormInput> = (data) => {
    if (!token) {
      toast.error("Authentication required.");
      return;
    }

    const successfulUploads = uploadedFiles.filter(f => f.url && !f.error);
    if (successfulUploads.length === 0) {
      toast.error("Please upload at least one proof of payment.");
      return;
    }

    const uploadingFiles = uploadedFiles.filter(f => f.uploading);
    if (uploadingFiles.length > 0) {
      toast.error("Please wait for all files to finish uploading.");
      return;
    }

    if (showDeviationWarning && !data.deviationReason) {
      toast.error("Please provide a reason for the payment amount deviation.");
      return;
    }

    submitPaymentMutation.mutate({
      token,
      ...data,
      proofOfPayment: successfulUploads.map(f => f.url!),
      expectedAmount: expectedRentAmount,
    });
  };

  const handleClose = () => {
    reset();
    uploadedFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setUploadedFiles([]);
    onClose();
  };

  const isSubmitting = submitPaymentMutation.isPending;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-2 sm:p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-full sm:max-w-3xl transform rounded-lg sm:rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                <div className="p-4 sm:p-6 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-purple-600 to-pink-600">
                  <Dialog.Title
                    as="h3"
                    className="text-lg sm:text-xl font-bold text-white flex items-center"
                  >
                    <CreditCard className="h-6 w-6 mr-2" />
                    Submit Payment
                  </Dialog.Title>
                  <p className="text-sm text-purple-100 mt-1">Upload your proof of payment for property manager approval</p>
                </div>
                
                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Column 1: Payment Details */}
                    <div className="space-y-4">
                      {/* Payment Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Type *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['RENT', 'UTILITIES', 'CLAIM'] as const).map((type) => (
                            <label key={type} className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              watch("paymentType") === type
                                ? "border-purple-600 bg-purple-50 text-purple-600" 
                                : "border-gray-300 hover:border-purple-300"
                            }`}>
                              <input
                                type="radio"
                                value={type}
                                {...register("paymentType")}
                                className="sr-only"
                              />
                              <span className="text-sm font-medium capitalize">{type.toLowerCase()}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Amount */}
                      <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                          Payment Amount (R) *
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <DollarSign className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="number"
                            id="amount"
                            step="0.01"
                            {...register("amount", { valueAsNumber: true })}
                            className="block w-full pl-10 pr-3 py-2 rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            disabled={isSubmitting}
                            placeholder="0.00"
                          />
                        </div>
                        {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
                        {expectedRentAmount && paymentType === "RENT" && (
                          <p className="mt-1 text-sm text-gray-500">
                            Expected rent: R{expectedRentAmount.toFixed(2)}
                          </p>
                        )}
                      </div>

                      {/* Deviation Warning */}
                      {showDeviationWarning && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-start">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-yellow-800">
                                Amount differs from expected rent
                              </p>
                              <p className="text-xs text-yellow-700 mt-1">
                                Please provide a reason for the deviation below.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Deviation Reason */}
                      {showDeviationWarning && (
                        <div>
                          <label htmlFor="deviationReason" className="block text-sm font-medium text-gray-700">
                            Reason for Deviation *
                          </label>
                          <textarea
                            id="deviationReason"
                            rows={3}
                            {...register("deviationReason")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            disabled={isSubmitting}
                            placeholder="Explain why the amount differs from expected rent..."
                          />
                        </div>
                      )}

                      {/* Payment Month (for rent) */}
                      {paymentType === "RENT" && (
                        <div>
                          <label htmlFor="paymentMonth" className="block text-sm font-medium text-gray-700">
                            Payment Month
                          </label>
                          <input
                            type="month"
                            id="paymentMonth"
                            {...register("paymentMonth")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            disabled={isSubmitting}
                          />
                        </div>
                      )}

                      {/* Payment Method */}
                      <div>
                        <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
                          Payment Method *
                        </label>
                        <select
                          id="paymentMethod"
                          {...register("paymentMethod")}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          disabled={isSubmitting}
                        >
                          <option value="BANK_TRANSFER">Bank Transfer / EFT</option>
                          <option value="CASH">Cash</option>
                          <option value="CARD">Card Payment</option>
                          <option value="EFT">Instant EFT</option>
                        </select>
                      </div>

                      {/* Transaction Reference */}
                      <div>
                        <label htmlFor="transactionReference" className="block text-sm font-medium text-gray-700">
                          Transaction Reference
                        </label>
                        <input
                          type="text"
                          id="transactionReference"
                          {...register("transactionReference")}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          disabled={isSubmitting}
                          placeholder="e.g., Reference number, transaction ID"
                        />
                      </div>

                      {/* Payment Date */}
                      <div>
                        <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700">
                          Payment Date *
                        </label>
                        <input
                          type="date"
                          id="paymentDate"
                          {...register("paymentDate")}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          disabled={isSubmitting}
                        />
                        {errors.paymentDate && <p className="mt-1 text-sm text-red-600">{errors.paymentDate.message}</p>}
                      </div>
                    </div>

                    {/* Column 2: Proof of Payment & Notes */}
                    <div className="space-y-4">
                      {/* File Upload Area */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Proof of Payment * <span className="text-gray-500 font-normal">(Images & Documents)</span>
                        </label>
                        
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                            isDragging 
                              ? 'border-purple-500 bg-purple-50' 
                              : 'border-gray-300 hover:border-purple-400'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-2">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="h-8 w-8 text-gray-400" />
                              <FileText className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="text-sm text-gray-600">
                              <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-purple-600 hover:text-purple-500">
                                <span>Click to upload</span>
                                <input
                                  id="file-upload"
                                  type="file"
                                  multiple
                                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf,.doc,.docx"
                                  className="sr-only"
                                  onChange={(e) => handleFileSelect(e.target.files)}
                                  disabled={isSubmitting}
                                />
                              </label>
                              <span className="text-gray-500"> or drag and drop</span>
                            </div>
                            <p className="text-xs text-gray-500">
                              JPG, PNG, WEBP, GIF, PDF, DOC, DOCX up to 10MB
                            </p>
                          </div>
                        </div>

                        {/* Uploaded Files */}
                        {uploadedFiles.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {uploadedFiles.map((file, index) => (
                              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                {file.preview ? (
                                  <img src={file.preview} alt={file.file.name} className="h-12 w-12 object-cover rounded" />
                                ) : (
                                  <FileText className="h-12 w-12 text-gray-400" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {file.file.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {(file.file.size / 1024).toFixed(1)} KB
                                  </p>
                                  {file.uploading && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <Loader2 className="h-3 w-3 animate-spin text-purple-600" />
                                      <span className="text-xs text-purple-600">Uploading...</span>
                                    </div>
                                  )}
                                  {file.error && (
                                    <p className="text-xs text-red-600 mt-1">{file.error}</p>
                                  )}
                                  {file.url && !file.uploading && (
                                    <p className="text-xs text-green-600 mt-1">✓ Uploaded</p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                                  disabled={file.uploading}
                                >
                                  <X className="h-4 w-4 text-gray-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start">
                          <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-blue-800">
                              Important Information
                            </p>
                            <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
                              <li>Your payment will be reviewed by the property manager</li>
                              <li>You'll be notified once it's approved or if more info is needed</li>
                              <li>Ensure your proof of payment is clear and readable</li>
                              <li>You can upload multiple files (receipts, bank statements, etc.)</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                          Additional Notes (Optional)
                        </label>
                        <textarea
                          id="notes"
                          rows={4}
                          {...register("notes")}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          disabled={isSubmitting}
                          placeholder="Add any additional notes or context about this payment..."
                        />
                      </div>
                    </div>
                  </div>
                </form>

                {/* Footer Actions */}
                <div className="flex-shrink-0 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="inline-flex justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      onClick={handleSubmit(onSubmit)}
                      className="inline-flex items-center justify-center rounded-lg border border-transparent bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
                      disabled={isSubmitting || uploadedFiles.some(f => f.uploading)}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 mr-2" />
                          Submit Payment
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

