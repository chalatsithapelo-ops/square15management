import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Mail, Send, Loader2, Users, Info, CheckCircle, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import { Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";

const bulkEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(10, "Message body must be at least 10 characters"),
});

type BulkEmailForm = z.infer<typeof bulkEmailSchema>;

interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Array<{ id: number; name: string; email: string }>;
  token: string;
}

const personalizationTokens = [
  { token: "{{customerName}}", description: "Customer's full name" },
  { token: "{{customerEmail}}", description: "Customer's email address" },
  { token: "{{customerPhone}}", description: "Customer's phone number" },
  { token: "{{address}}", description: "Customer's address" },
  { token: "{{serviceType}}", description: "Type of service requested" },
  { token: "{{description}}", description: "Service description" },
  { token: "{{estimatedValue}}", description: "Estimated project value" },
];

export function BulkEmailModal({
  isOpen,
  onClose,
  selectedLeads,
  token,
}: BulkEmailModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [sendResult, setSendResult] = useState<any>(null);
  const user = useAuthStore((state) => state.user);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<BulkEmailForm>({
    resolver: zodResolver(bulkEmailSchema),
    defaultValues: {
      subject: "",
      body: "",
    },
  });

  const sendBulkEmailMutation = useMutation(
    trpc.sendBulkLeadEmail.mutationOptions({
      onSuccess: (data) => {
        setSendResult(data);
        if (data.totalFailed === 0) {
          toast.success(`Successfully sent emails to ${data.totalSent} recipients!`);
        } else {
          toast.success(`Sent ${data.totalSent} emails. ${data.totalFailed} failed.`);
        }
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: trpc.getLeads.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getNotifications.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send bulk emails");
      },
    })
  );

  const onSubmit = (data: BulkEmailForm) => {
    setSendResult(null);
    sendBulkEmailMutation.mutate({
      token,
      leadIds: selectedLeads.map((lead) => lead.id),
      subject: data.subject,
      body: data.body,
    });
  };

  const handleClose = () => {
    if (!sendBulkEmailMutation.isPending) {
      reset();
      setSendResult(null);
      onClose();
    }
  };

  const insertToken = (token: string) => {
    const bodyField = document.querySelector('textarea[name="body"]') as HTMLTextAreaElement;
    if (bodyField) {
      const start = bodyField.selectionStart;
      const end = bodyField.selectionEnd;
      const text = bodyField.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      bodyField.value = before + token + after;
      bodyField.selectionStart = bodyField.selectionEnd = start + token.length;
      bodyField.focus();
      // Trigger change event for react-hook-form
      const event = new Event('input', { bubbles: true });
      bodyField.dispatchEvent(event);
    }
  };

  const subjectValue = watch("subject");
  const bodyValue = watch("body");

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
              <Dialog.Panel className="w-full max-w-4xl transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex-shrink-0">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-white">
                        Send Bulk Email
                      </Dialog.Title>
                      <p className="text-sm text-blue-100">
                        <Users className="inline h-4 w-4 mr-1" />
                        {selectedLeads.length} recipient{selectedLeads.length !== 1 ? "s" : ""} selected
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={sendBulkEmailMutation.isPending}
                    className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                  {sendResult ? (
                    // Show results after sending
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <h3 className="font-semibold text-green-900">
                            Successfully Sent: {sendResult.totalSent}
                          </h3>
                        </div>
                        {sendResult.successful.length > 0 && (
                          <ul className="text-sm text-green-800 space-y-1 ml-7">
                            {sendResult.successful.map((recipient: any, idx: number) => (
                              <li key={idx}>
                                {recipient.name} ({recipient.email})
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {sendResult.totalFailed > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <XCircle className="h-5 w-5 text-red-600" />
                            <h3 className="font-semibold text-red-900">
                              Failed to Send: {sendResult.totalFailed}
                            </h3>
                          </div>
                          {sendResult.failed.length > 0 && (
                            <ul className="text-sm text-red-800 space-y-1 ml-7">
                              {sendResult.failed.map((recipient: any, idx: number) => (
                                <li key={idx}>
                                  {recipient.name} ({recipient.email}) - {recipient.error}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end pt-4 border-t border-gray-200">
                        <button
                          onClick={handleClose}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Show form
                    <form onSubmit={handleSubmit(onSubmit)}>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left column: Form fields */}
                        <div className="lg:col-span-2 space-y-4">
                          {/* Recipients list */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-blue-900 mb-2">
                              Recipients ({selectedLeads.length})
                            </h3>
                            <div className="max-h-24 overflow-y-auto">
                              <div className="flex flex-wrap gap-2">
                                {selectedLeads.map((lead) => (
                                  <span
                                    key={lead.id}
                                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {lead.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Email Account Notice */}
                          {user?.hasPersonalEmail ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                <p className="text-sm text-green-800">
                                  These emails will be sent from your personal email account
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-center space-x-2">
                                <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                <p className="text-sm text-blue-800">
                                  These emails will be sent from the company email account.{" "}
                                  <Link to="/user-email-setup" className="underline font-medium">
                                    Connect your personal email
                                  </Link>
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Subject Field */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Subject *
                            </label>
                            <input
                              type="text"
                              {...register("subject")}
                              placeholder="Enter email subject (you can use tokens like {{customerName}})"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={sendBulkEmailMutation.isPending}
                            />
                            {errors.subject && (
                              <p className="mt-1 text-sm text-red-600">
                                {errors.subject.message}
                              </p>
                            )}
                          </div>

                          {/* Message Body Field */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Message *
                            </label>
                            <textarea
                              {...register("body")}
                              rows={12}
                              placeholder="Enter your message here... Use personalization tokens to customize for each recipient."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              disabled={sendBulkEmailMutation.isPending}
                            />
                            {errors.body && (
                              <p className="mt-1 text-sm text-red-600">
                                {errors.body.message}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                              Your message will be formatted with company branding and your signature.
                            </p>
                          </div>
                        </div>

                        {/* Right column: Personalization tokens */}
                        <div className="space-y-4">
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-3">
                              <Info className="h-4 w-4 text-amber-600" />
                              <h3 className="text-sm font-semibold text-amber-900">
                                Personalization Tokens
                              </h3>
                            </div>
                            <p className="text-xs text-amber-800 mb-3">
                              Click a token to insert it at the cursor position:
                            </p>
                            <div className="space-y-2">
                              {personalizationTokens.map((item) => (
                                <button
                                  key={item.token}
                                  type="button"
                                  onClick={() => insertToken(item.token)}
                                  disabled={sendBulkEmailMutation.isPending}
                                  className="w-full text-left px-3 py-2 bg-white hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors disabled:opacity-50 group"
                                >
                                  <code className="text-xs font-mono text-amber-900 font-semibold">
                                    {item.token}
                                  </code>
                                  <p className="text-xs text-amber-700 mt-1">
                                    {item.description}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">
                              Example
                            </h3>
                            <div className="text-xs text-gray-700 space-y-2">
                              <p className="font-mono bg-white p-2 rounded border border-gray-200">
                                Dear {`{{customerName}}`},
                              </p>
                              <p className="text-gray-600">becomes:</p>
                              <p className="font-mono bg-white p-2 rounded border border-gray-200">
                                Dear John Smith,
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={handleClose}
                          disabled={sendBulkEmailMutation.isPending}
                          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={sendBulkEmailMutation.isPending || selectedLeads.length === 0}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 rounded-lg disabled:opacity-50 transition-all"
                        >
                          {sendBulkEmailMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending to {selectedLeads.length} recipient{selectedLeads.length !== 1 ? "s" : ""}...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send to {selectedLeads.length} Recipient{selectedLeads.length !== 1 ? "s" : ""}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
