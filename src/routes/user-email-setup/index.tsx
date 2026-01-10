import { createFileRoute, Link } from "@tanstack/react-router";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Settings, 
  Info,
  Send,
  Unplug,
  ArrowLeft,
  Shield,
  Key,
  Server
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/user-email-setup/")({
  component: UserEmailSetupPage,
});

const emailConfigSchema = z.object({
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.number().int().positive("Port must be a positive number"),
  smtpSecure: z.boolean(),
  smtpUser: z.string().email("Valid email address is required"),
  smtpPassword: z.string().min(1, "Password is required"),
});

type EmailConfigForm = z.infer<typeof emailConfigSchema>;

const commonProviders = [
  {
    name: "Gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    instructions: "Use an App Password instead of your regular password. Enable 2FA first, then generate an App Password in your Google Account settings.",
  },
  {
    name: "Outlook/Office 365",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    instructions: "Use your regular email password. If you have 2FA enabled, you may need to create an app-specific password.",
  },
  {
    name: "Yahoo Mail",
    host: "smtp.mail.yahoo.com",
    port: 587,
    secure: false,
    instructions: "Generate an App Password in your Yahoo Account Security settings.",
  },
  {
    name: "Custom SMTP",
    host: "",
    port: 587,
    secure: false,
    instructions: "Contact your email provider for SMTP settings.",
  },
];

function UserEmailSetupPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState("");
  const [showTestSection, setShowTestSection] = useState(false);

  // Query email status
  const emailStatusQuery = useQuery(
    trpc.getUserEmailStatus.queryOptions({
      token: token!,
    })
  );

  // Setup email mutation
  const setupEmailMutation = useMutation(
    trpc.setupUserEmail.mutationOptions({
      onSuccess: (data) => {
        toast.success("Email account configured successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getUserEmailStatus.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getCurrentUser.queryKey() });
        setShowTestSection(true);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to configure email account");
      },
    })
  );

  // Test email mutation
  const testEmailMutation = useMutation(
    trpc.testUserEmailConnection.mutationOptions({
      onSuccess: () => {
        toast.success("Test email sent successfully!");
        setTestEmail("");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send test email");
      },
    })
  );

  // Disconnect email mutation
  const disconnectEmailMutation = useMutation(
    trpc.disconnectUserEmail.mutationOptions({
      onSuccess: () => {
        toast.success("Email account disconnected successfully");
        queryClient.invalidateQueries({ queryKey: trpc.getUserEmailStatus.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getCurrentUser.queryKey() });
        setShowTestSection(false);
        reset();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to disconnect email account");
      },
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<EmailConfigForm>({
    resolver: zodResolver(emailConfigSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "",
      smtpPassword: "",
    },
  });

  const onSubmit = (data: EmailConfigForm) => {
    setupEmailMutation.mutate({
      token: token!,
      ...data,
    });
  };

  const handleTestEmail = () => {
    if (!testEmail) {
      toast.error("Please enter a recipient email address");
      return;
    }
    testEmailMutation.mutate({
      token: token!,
      recipientEmail: testEmail,
    });
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect your email account? You will need to reconfigure it to send emails.")) {
      disconnectEmailMutation.mutate({ token: token! });
    }
  };

  const handleProviderSelect = (provider: typeof commonProviders[0]) => {
    if (provider.host) {
      setValue("smtpHost", provider.host);
      setValue("smtpPort", provider.port);
      setValue("smtpSecure", provider.secure);
    }
  };

  if (!token || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  const isConfigured = emailStatusQuery.data?.isConfigured;
  const isLoading = emailStatusQuery.isLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to={user.role === "CUSTOMER" ? "/customer/dashboard" : user.role.includes("ADMIN") ? "/admin/dashboard" : "/artisan/dashboard"}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-6 w-6" />
              </Link>
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl">
                  <Mail className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Email Configuration</h1>
                  <p className="text-sm text-gray-600">Connect your personal email account</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Status & Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Status */}
            {isLoading ? (
              <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : isConfigured ? (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-white" />
                    <h2 className="text-lg font-semibold text-white">Email Connected</h2>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Email Address</p>
                      <p className="font-medium text-gray-900">{emailStatusQuery.data.smtpUser}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">SMTP Host</p>
                      <p className="font-medium text-gray-900">{emailStatusQuery.data.smtpHost}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Port</p>
                      <p className="font-medium text-gray-900">{emailStatusQuery.data.smtpPort}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Security</p>
                      <p className="font-medium text-gray-900">
                        {emailStatusQuery.data.smtpSecure ? "TLS/SSL" : "STARTTLS"}
                      </p>
                    </div>
                    {emailStatusQuery.data.configuredAt && (
                      <div>
                        <p className="text-sm text-gray-600">Configured</p>
                        <p className="font-medium text-gray-900">
                          {new Date(emailStatusQuery.data.configuredAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {emailStatusQuery.data.lastTestedAt && (
                      <div>
                        <p className="text-sm text-gray-600">Last Tested</p>
                        <p className="font-medium text-gray-900">
                          {new Date(emailStatusQuery.data.lastTestedAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Test Email Section */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Test Your Email</h3>
                    <div className="flex space-x-2">
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="Enter recipient email"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleTestEmail}
                        disabled={testEmailMutation.isPending || !testEmail}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {testEmailMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Test
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Disconnect Button */}
                  <div className="border-t pt-4 mt-4">
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnectEmailMutation.isPending}
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {disconnectEmailMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <Unplug className="h-4 w-4 mr-2" />
                          Disconnect Email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <Settings className="h-6 w-6 text-white" />
                    <h2 className="text-lg font-semibold text-white">Configure Your Email</h2>
                  </div>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                  {/* Provider Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Your Email Provider
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {commonProviders.map((provider) => (
                        <button
                          key={provider.name}
                          type="button"
                          onClick={() => handleProviderSelect(provider)}
                          className="px-4 py-3 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                        >
                          <p className="font-medium text-gray-900">{provider.name}</p>
                          {provider.host && (
                            <p className="text-xs text-gray-500 mt-1">{provider.host}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SMTP Host */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Server className="inline h-4 w-4 mr-1" />
                      SMTP Host *
                    </label>
                    <input
                      type="text"
                      {...register("smtpHost")}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.smtpHost && (
                      <p className="mt-1 text-sm text-red-600">{errors.smtpHost.message}</p>
                    )}
                  </div>

                  {/* SMTP Port */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Port *
                    </label>
                    <input
                      type="number"
                      {...register("smtpPort", { valueAsNumber: true })}
                      placeholder="587"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.smtpPort && (
                      <p className="mt-1 text-sm text-red-600">{errors.smtpPort.message}</p>
                    )}
                  </div>

                  {/* Security */}
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        {...register("smtpSecure")}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        <Shield className="inline h-4 w-4 mr-1" />
                        Use TLS/SSL (port 465)
                      </span>
                    </label>
                    <p className="mt-1 text-xs text-gray-500">
                      Leave unchecked for STARTTLS (port 587)
                    </p>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Mail className="inline h-4 w-4 mr-1" />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      {...register("smtpUser")}
                      placeholder="your.email@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.smtpUser && (
                      <p className="mt-1 text-sm text-red-600">{errors.smtpUser.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Key className="inline h-4 w-4 mr-1" />
                      Password / App Password *
                    </label>
                    <input
                      type="password"
                      {...register("smtpPassword")}
                      placeholder="Enter your email password or app password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.smtpPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.smtpPassword.message}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      For Gmail and other providers, use an App Password instead of your regular password
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={setupEmailMutation.isPending}
                      className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 transition-all font-medium"
                    >
                      {setupEmailMutation.isPending ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Testing & Configuring...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Test & Save Configuration
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Instructions */}
          <div className="space-y-6">
            {/* Why Connect */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Info className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Why Connect Your Email?</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Send emails from your own email address</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Recipients see your personal email in their inbox</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Build trust with personalized communication</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Track sent emails in your own email client</span>
                </li>
              </ul>
            </div>

            {/* Gmail Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-3">Gmail Setup Instructions</h3>
              <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
                <li>Enable 2-Factor Authentication on your Google Account</li>
                <li>Go to Google Account → Security → App Passwords</li>
                <li>Generate a new App Password for "Mail"</li>
                <li>Use the generated password (not your regular password)</li>
                <li>SMTP: smtp.gmail.com, Port: 587</li>
              </ol>
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-900">Security Notice</h3>
              </div>
              <p className="text-sm text-yellow-800">
                Your email credentials are securely stored and encrypted. We recommend using App Passwords 
                instead of your main email password for enhanced security.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
