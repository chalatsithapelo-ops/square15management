import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Mail, Send, Loader2, CheckCircle, Info, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import { Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";

const emailSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(10, "Message body must be at least 10 characters"),
  ccEmails: z.string().optional(),
});

type EmailForm = z.infer<typeof emailSchema>;

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  recipientEmail: string;
  leadId?: number;
  token: string;
}

export function SendEmailModal({
  isOpen,
  onClose,
  recipientName,
  recipientEmail,
  leadId,
  token,
}: SendEmailModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      subject: "",
      body: "",
      ccEmails: "",
    },
  });

  const sendEmailMutation = useMutation(
    trpc.sendLeadEmail.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Email sent successfully to ${data.sentTo}!`);
        reset();
        onClose();
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: trpc.getLeads.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getNotifications.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send email");
      },
    })
  );

  const generateEmailMutation = useMutation(
    trpc.generateEmailContent.mutationOptions({
      onSuccess: (data) => {
        // Populate form fields with generated content
        setValue("subject", data.subject);
        setValue("body", data.fullEmail);
        setShowAIModal(false);
        toast.success("Email content generated successfully!");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate email content");
      },
    })
  );

  const handleAIGenerate = (emailType: string, tone: string) => {
    setAiGenerating(true);
    
    const generatePromise = generateEmailMutation.mutateAsync({
      token,
      emailType: emailType as any,
      recipientName,
      context: {
        leadDetails: `Customer interested in our services`,
      },
      tone: tone as any,
    });

    toast.promise(
      generatePromise,
      {
        loading: "Generating email content with AI...",
        success: "Email content generated!",
        error: "Failed to generate content",
      }
    ).finally(() => {
      setAiGenerating(false);
    });
  };

  const onSubmit = (data: EmailForm) => {
    // Parse CC emails if provided
    const ccEmails = data.ccEmails
      ? data.ccEmails
          .split(",")
          .map((email) => email.trim())
          .filter((email) => email.length > 0)
      : undefined;

    sendEmailMutation.mutate({
      token,
      recipientEmail,
      recipientName,
      subject: data.subject,
      body: data.body,
      leadId,
      ccEmails,
    });
  };

  const handleClose = () => {
    if (!sendEmailMutation.isPending) {
      reset();
      onClose();
    }
  };

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
              <Dialog.Panel className="w-full max-w-2xl transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh] relative">
                {/* Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex-shrink-0">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-white">
                        Send Email
                      </Dialog.Title>
                      <p className="text-sm text-blue-100">
                        To: {recipientName} ({recipientEmail})
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={sendEmailMutation.isPending}
                    className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    {user?.hasPersonalEmail ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <p className="text-sm text-green-800">
                            This email will be sent from your personal email account
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center space-x-2">
                          <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <p className="text-sm text-blue-800">
                            This email will be sent from the company email account.{" "}
                            <Link to="/user-email-setup" className="underline font-medium">
                              Connect your personal email
                            </Link>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* AI Generation Button */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            <h3 className="text-sm font-semibold text-purple-900">AI Email Assistant</h3>
                          </div>
                          <p className="text-xs text-purple-700">
                            Let AI generate professional email content for you
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAIModal(true)}
                          disabled={sendEmailMutation.isPending || aiGenerating}
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 rounded-lg disabled:opacity-50 transition-all shadow-sm"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate with AI
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Subject Field */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Subject *
                        </label>
                        <input
                          type="text"
                          {...register("subject")}
                          placeholder="Enter email subject"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={sendEmailMutation.isPending}
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
                          rows={10}
                          placeholder="Enter your message here..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          disabled={sendEmailMutation.isPending}
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

                      {/* CC Field */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CC (Optional)
                        </label>
                        <input
                          type="text"
                          {...register("ccEmails")}
                          placeholder="email1@example.com, email2@example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={sendEmailMutation.isPending}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Separate multiple email addresses with commas
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={sendEmailMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendEmailMutation.isPending}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 rounded-lg disabled:opacity-50 transition-all"
                    >
                      {sendEmailMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Email
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* AI Generation Modal */}
                {showAIModal && (
                  <div className="absolute inset-0 bg-white z-10 rounded-2xl overflow-y-auto">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Generate Email with AI</h3>
                          <p className="text-sm text-gray-600 mt-1">Select the type and tone for your email</p>
                        </div>
                        <button
                          onClick={() => setShowAIModal(false)}
                          disabled={aiGenerating}
                          className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Email Type
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { value: "LEAD_FOLLOW_UP", label: "Lead Follow-Up", icon: "📧" },
                              { value: "QUOTATION_SUBMISSION", label: "Quotation", icon: "📋" },
                              { value: "INVOICE_REMINDER", label: "Invoice Reminder", icon: "💰" },
                              { value: "PROJECT_UPDATE", label: "Project Update", icon: "🏗️" },
                              { value: "MEETING_REQUEST", label: "Meeting Request", icon: "📅" },
                              { value: "THANK_YOU", label: "Thank You", icon: "🙏" },
                            ].map((type) => (
                              <button
                                key={type.value}
                                type="button"
                                onClick={() => {
                                  const tone = "PROFESSIONAL";
                                  handleAIGenerate(type.value, tone);
                                }}
                                disabled={aiGenerating}
                                className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all disabled:opacity-50 text-left"
                              >
                                <span className="text-2xl">{type.icon}</span>
                                <span className="text-sm font-medium text-gray-900">{type.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Tone (Optional - defaults to Professional)
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { value: "PROFESSIONAL", label: "Professional", desc: "Polished & business-like" },
                              { value: "FRIENDLY", label: "Friendly", desc: "Warm & personable" },
                              { value: "URGENT", label: "Urgent", desc: "Conveys importance" },
                              { value: "FORMAL", label: "Formal", desc: "Traditional business" },
                            ].map((tone) => (
                              <div
                                key={tone.value}
                                className="p-3 border border-gray-200 rounded-lg bg-gray-50"
                              >
                                <div className="text-sm font-medium text-gray-900">{tone.label}</div>
                                <div className="text-xs text-gray-600 mt-1">{tone.desc}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs text-blue-800">
                            💡 Tip: After generating, you can edit the content before sending
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
