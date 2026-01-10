import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Mail, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";

type Theme = "teal" | "green";

type FormValues = {
  smtpServer: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  emailFromAddress: string;
};

const themeClasses: Record<Theme, {
  icon: string;
  focusRing: string;
  primaryBtn: string;
  primaryBtnHover: string;
  testBtn: string;
  testBtnHover: string;
}> = {
  teal: {
    icon: "text-teal-600",
    focusRing: "focus:ring-teal-500",
    primaryBtn: "bg-teal-600",
    primaryBtnHover: "hover:bg-teal-700",
    testBtn: "bg-green-600",
    testBtnHover: "hover:bg-green-700",
  },
  green: {
    icon: "text-green-600",
    focusRing: "focus:ring-green-500",
    primaryBtn: "bg-green-600",
    primaryBtnHover: "hover:bg-green-700",
    testBtn: "bg-green-600",
    testBtnHover: "hover:bg-green-700",
  },
};

function inferSecureFromPort(port: number) {
  return Number(port) === 465;
}

export function UserEmailSettingsPanel({
  theme = "teal",
  title = "Email Settings",
  description = "Configure your SMTP settings to send emails directly through the app",
}: {
  theme?: Theme;
  title?: string;
  description?: string;
}) {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [testEmailSubject, setTestEmailSubject] = useState("");
  const [testEmailBody, setTestEmailBody] = useState("");

  const classes = themeClasses[theme];

  const emailStatusQuery = useQuery(
    trpc.getUserEmailStatus.queryOptions(
      { token: token! },
      { enabled: !!token }
    )
  );

  const isConfigured = !!emailStatusQuery.data?.isConfigured;

  const defaultValues = useMemo<FormValues>(() => {
    const smtpUser = emailStatusQuery.data?.smtpUser || user?.email || "";
    return {
      smtpServer: emailStatusQuery.data?.smtpHost || "smtp.gmail.com",
      smtpPort: emailStatusQuery.data?.smtpPort || 587,
      smtpUsername: smtpUser,
      smtpPassword: "",
      emailFromAddress: smtpUser,
    };
  }, [emailStatusQuery.data, user?.email]);

  const emailSettingsForm = useForm<FormValues>({ values: defaultValues });

  useEffect(() => {
    emailSettingsForm.reset(defaultValues);
  }, [defaultValues, emailSettingsForm]);

  const setupUserEmailMutation = useMutation(
    trpc.setupUserEmail.mutationOptions({
      onSuccess: () => {
        toast.success("Email settings updated successfully");
        queryClient.invalidateQueries({ queryKey: trpc.getUserEmailStatus.queryKey() });
        emailSettingsForm.setValue("smtpPassword", "");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update email settings");
      },
    })
  );

  const testUserEmailMutation = useMutation(
    trpc.testUserEmailConnection.mutationOptions({
      onSuccess: () => {
        toast.success("Test email sent successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send test email");
      },
    })
  );

  const handleEmailSettingsSubmit = emailSettingsForm.handleSubmit((data) => {
    if (!token) return;

    const normalizedUsername = (data.smtpUsername || "").trim();
    const normalizedFrom = (data.emailFromAddress || "").trim();

    if (!normalizedUsername) {
      toast.error("SMTP Username is required");
      return;
    }

    if (!normalizedFrom) {
      toast.error("From Email Address is required");
      return;
    }

    if (normalizedFrom.toLowerCase() !== normalizedUsername.toLowerCase()) {
      toast.error("From Email Address must match SMTP Username");
      return;
    }

    const smtpPort = Number(data.smtpPort);

    const smtpPassword = (data.smtpPassword || "").trim();
    const payload: any = {
      token,
      smtpHost: (data.smtpServer || "").trim(),
      smtpPort,
      smtpSecure: inferSecureFromPort(smtpPort),
      smtpUser: normalizedUsername,
    };

    if (smtpPassword) {
      payload.smtpPassword = smtpPassword;
    } else if (!isConfigured) {
      toast.error("SMTP Password is required");
      return;
    }

    setupUserEmailMutation.mutate(payload);
  });

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!testEmailRecipient.trim()) {
      toast.error("Recipient Email is required");
      return;
    }

    await testUserEmailMutation.mutateAsync({
      token,
      recipientEmail: testEmailRecipient.trim(),
      subject: testEmailSubject.trim() || undefined,
      body: testEmailBody.trim() || undefined,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-6 flex items-center">
          <Mail className={`h-6 w-6 mr-2 ${classes.icon}`} />
          {title}
        </h2>

        <p className="text-gray-600 text-sm mb-6">{description}</p>

        <form onSubmit={handleEmailSettingsSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Server *</label>
              <input
                type="text"
                {...emailSettingsForm.register("smtpServer")}
                placeholder="e.g., smtp.gmail.com"
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 ${classes.focusRing} focus:border-transparent`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Port *</label>
              <input
                type="number"
                {...emailSettingsForm.register("smtpPort", { valueAsNumber: true })}
                placeholder="e.g., 587"
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 ${classes.focusRing} focus:border-transparent`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Username *</label>
            <input
              type="email"
              {...emailSettingsForm.register("smtpUsername")}
              placeholder="e.g., your-email@gmail.com"
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 ${classes.focusRing} focus:border-transparent`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Password {isConfigured ? "" : "*"}</label>
            <input
              type="password"
              {...emailSettingsForm.register("smtpPassword")}
              placeholder={isConfigured ? "Leave blank to keep existing password" : "Enter your SMTP password"}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 ${classes.focusRing} focus:border-transparent`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Email Address *</label>
            <input
              type="email"
              {...emailSettingsForm.register("emailFromAddress")}
              placeholder="e.g., noreply@yourcompany.com"
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 ${classes.focusRing} focus:border-transparent`}
            />
            <p className="mt-1 text-xs text-gray-500">For most providers this must match your SMTP Username.</p>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={setupUserEmailMutation.isPending}
              className={`${classes.primaryBtn} ${classes.primaryBtnHover} disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors`}
            >
              {setupUserEmailMutation.isPending ? "Saving..." : "Save Email Settings"}
            </button>
          </div>

          {setupUserEmailMutation.isSuccess && (
            <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Email settings updated successfully
            </div>
          )}
          {setupUserEmailMutation.isError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              {setupUserEmailMutation.error instanceof Error
                ? setupUserEmailMutation.error.message
                : "Failed to update email settings"}
            </div>
          )}
        </form>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Send className={`h-5 w-5 mr-2 ${classes.icon}`} />
          Test Email Settings
        </h3>

        <form onSubmit={handleSendTestEmail} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Email *</label>
            <input
              type="email"
              value={testEmailRecipient}
              onChange={(e) => setTestEmailRecipient(e.target.value)}
              placeholder="e.g., test@example.com"
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 ${classes.focusRing} focus:border-transparent`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Subject</label>
            <input
              type="text"
              value={testEmailSubject}
              onChange={(e) => setTestEmailSubject(e.target.value)}
              placeholder="e.g., Test Email"
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 ${classes.focusRing} focus:border-transparent`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Body</label>
            <textarea
              value={testEmailBody}
              onChange={(e) => setTestEmailBody(e.target.value)}
              rows={5}
              placeholder="Enter your test email message..."
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 ${classes.focusRing} focus:border-transparent font-mono text-sm`}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={testUserEmailMutation.isPending}
              className={`${classes.testBtn} ${classes.testBtnHover} disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2`}
            >
              <Send className="h-4 w-4" />
              {testUserEmailMutation.isPending ? "Sending..." : "Send Test Email"}
            </button>
          </div>

          {testUserEmailMutation.isSuccess && (
            <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-start">
              <CheckCircle2 className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Test email sent successfully</p>
                <p className="text-sm">Check your inbox for the test message</p>
              </div>
            </div>
          )}
          {testUserEmailMutation.isError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Failed to send test email</p>
                <p className="text-sm">
                  {testUserEmailMutation.error instanceof Error
                    ? testUserEmailMutation.error.message
                    : "Please check your SMTP settings"}
                </p>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
