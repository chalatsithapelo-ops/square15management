import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import {
  Mail, Save, Loader2, CheckCircle, AlertCircle, Eye, EyeOff,
  Send, RefreshCw, Server, Info, Shield, Zap, XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

type PollerType = "finance" | "orders" | "quotes";

const POLLER_META: Record<PollerType, { label: string; description: string; color: string; icon: string }> = {
  finance: {
    label: "Finance / Bank Feed",
    description: "Polls for bank notification emails — auto-categorises transactions from FNB, ABSA, Standard Bank, Nedbank, Capitec, Investec",
    color: "emerald",
    icon: "💰",
  },
  orders: {
    label: "Orders",
    description: "AI-powered extraction of order requests from emails — creates orders in pending review status",
    color: "blue",
    icon: "📦",
  },
  quotes: {
    label: "Quotes / Quotations",
    description: "AI-powered extraction of quotation requests from emails — creates draft quotations for review",
    color: "purple",
    icon: "📝",
  },
};

interface PollerCardProps {
  type: PollerType;
  data: {
    host: string;
    port: string;
    user: string;
    password: string;
    enabled: boolean;
    isConfigured: boolean;
  };
  onSaved: () => void;
  theme?: string;
}

function PollerCard({ type, data, onSaved, theme = "blue" }: PollerCardProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const meta = POLLER_META[type];

  const [host, setHost] = useState(data.host || "mail.square15.co.za");
  const [port, setPort] = useState(data.port || "993");
  const [user, setUser] = useState(data.user || "");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(data.enabled);
  const [showPassword, setShowPassword] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Re-sync when data changes
  if (data && !initialized) {
    setHost(data.host || "mail.square15.co.za");
    setPort(data.port || "993");
    setUser(data.user || "");
    setEnabled(data.enabled);
    setInitialized(true);
  }

  const updateMutation = useMutation(
    trpc.updateEmailAutomationSettings.mutationOptions()
  );

  const testMutation = useMutation(
    trpc.testEmailAutomationConnection.mutationOptions()
  );

  const handleSave = async () => {
    const pw = password || data.password;
    if (!pw || pw.includes("*")) {
      toast.error("Please enter the email password");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        token: token || "",
        poller: type,
        host,
        port,
        user,
        password: pw,
        enabled,
      });
      toast.success(`${meta.label} settings saved!`);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    }
  };

  const handleTest = async () => {
    const pw = password || data.password;
    if (!user || !pw || pw.includes("*")) {
      toast.error("Please enter email and password before testing");
      return;
    }
    try {
      const result = await testMutation.mutateAsync({
        token: token || "",
        host,
        port,
        user,
        password: pw,
      });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Connection test failed");
    }
  };

  const themeClasses = {
    emerald: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800", btn: "bg-emerald-600 hover:bg-emerald-700" },
    blue: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100 text-blue-800", btn: "bg-blue-600 hover:bg-blue-700" },
    purple: { border: "border-purple-200", bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-800", btn: "bg-purple-600 hover:bg-purple-700" },
  };

  const tc = themeClasses[meta.color as keyof typeof themeClasses] || themeClasses.blue;

  return (
    <div className={`bg-white rounded-xl border ${data.isConfigured ? tc.border : "border-gray-200"} p-5`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <h3 className="text-base font-semibold text-gray-900">{meta.label}</h3>
          {data.isConfigured && data.enabled && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tc.badge}`}>
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </span>
          )}
          {data.isConfigured && !data.enabled && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Paused
            </span>
          )}
          {!data.isConfigured && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Not configured
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-500">Enabled</span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </label>
      </div>

      <p className="text-xs text-gray-500 mb-4">{meta.description}</p>

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">IMAP Host</label>
          <div className="relative">
            <Server className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="mail.example.co.za"
              className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">IMAP Port</label>
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="993"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="email"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder={`${type}@yourdomain.co.za`}
              className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
          <div className="relative">
            <Shield className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={data.isConfigured ? "••••••••  (unchanged)" : "Enter password"}
              className="w-full rounded-lg border border-gray-300 pl-8 pr-10 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending || !user}
          className={`inline-flex items-center px-4 py-2 ${tc.btn} text-white rounded-lg disabled:opacity-50 text-sm font-medium transition-colors`}
        >
          {updateMutation.isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</>
          ) : (
            <><Save className="h-3.5 w-3.5 mr-1.5" /> Save</>
          )}
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={testMutation.isPending || !user}
          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {testMutation.isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Testing...</>
          ) : (
            <><Send className="h-3.5 w-3.5 mr-1.5" /> Test Connection</>
          )}
        </button>
      </div>

      {/* Test result feedback */}
      {testMutation.isSuccess && testMutation.data && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${testMutation.data.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          <div className="flex items-center gap-2">
            {testMutation.data.success ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
            {testMutation.data.message}
          </div>
        </div>
      )}
      {testMutation.isError && (
        <div className="mt-3 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            {(testMutation.error as any)?.message || "Connection test failed"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main exported component ──────────────────────────────────────────
interface EmailAutomationSectionProps {
  /** Color theme for buttons — e.g. "blue", "teal", "green" */
  theme?: string;
  /** Whether to show the "Restart Pollers" admin button */
  showRestart?: boolean;
}

export function EmailAutomationSection({ theme = "blue", showRestart = false }: EmailAutomationSectionProps) {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    ...trpc.getEmailAutomationSettings.queryOptions({ token: token || "" }),
    enabled: !!token,
  });

  const restartMutation = useMutation(
    trpc.restartEmailPollers.mutationOptions()
  );

  const handleRestart = async () => {
    try {
      const result = await restartMutation.mutateAsync({ token: token || "" });
      toast.success(
        `Pollers restarted:\n${result.results.join("\n")}`,
        { duration: 5000 }
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to restart pollers");
    }
  };

  const refetch = () => {
    settingsQuery.refetch();
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading email automation settings...</span>
        </div>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load email automation settings</span>
        </div>
      </div>
    );
  }

  const data = settingsQuery.data;
  if (!data) return null;

  const configuredCount = [data.finance, data.orders, data.quotes].filter((p) => p.isConfigured && p.enabled).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Section Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center">
              <Zap className="h-6 w-6 mr-2 text-amber-500" />
              Email Automation (IMAP Pollers)
              {configuredCount > 0 && (
                <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {configuredCount}/3 Active
                </span>
              )}
            </h2>
            <p className="text-gray-600 text-sm">
              Configure the email accounts used for automated processing of bank feeds, orders, and quotation requests.
              Each poller checks its inbox every 5 minutes for new emails.
            </p>
          </div>
          {showRestart && (
            <button
              type="button"
              onClick={handleRestart}
              disabled={restartMutation.isPending}
              className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {restartMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Restarting...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1.5" /> Restart Pollers</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">How it works</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600">
              <li><strong>Finance</strong> — receives bank SMS/email notifications; auto-categorises income &amp; expenses</li>
              <li><strong>Orders</strong> — receives work order requests via email; AI extracts details and creates pending orders</li>
              <li><strong>Quotes</strong> — receives quotation requests via email; AI extracts details and creates draft quotations</li>
            </ul>
            <p className="mt-2 text-xs text-blue-500">
              Use separate email accounts (e.g. finance@, orders@, quotes@). After saving, click "Test Connection" to verify.
              {showRestart && " Use 'Restart Pollers' to apply changes without a server restart."}
            </p>
          </div>
        </div>
      </div>

      {/* Poller cards */}
      <div className="space-y-4">
        <PollerCard type="finance" data={data.finance} onSaved={refetch} theme={theme} />
        <PollerCard type="orders" data={data.orders} onSaved={refetch} theme={theme} />
        <PollerCard type="quotes" data={data.quotes} onSaved={refetch} theme={theme} />
      </div>

      {/* Restart result */}
      {restartMutation.isSuccess && restartMutation.data && (
        <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
          <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
            <CheckCircle className="h-4 w-4 mr-1.5" />
            Pollers Restarted
          </h4>
          <ul className="text-sm text-green-700 space-y-1">
            {restartMutation.data.results.map((r: string, i: number) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
