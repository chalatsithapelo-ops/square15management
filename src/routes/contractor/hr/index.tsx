import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useState } from "react";
import {
  ArrowLeft,
  Users,
  Target,
  Calendar,
  FileText,
  DollarSign,
  Award,
  BarChart3,
} from "lucide-react";
import { EmployeesTab } from "~/components/hr/EmployeesTab";
import { PerformanceTab } from "~/components/hr/PerformanceTab";
import { KPITrackingTab } from "~/components/hr/KPITrackingTab";
import { LeaveManagementTab } from "~/components/hr/LeaveManagementTab";
import { DocumentsTab } from "~/components/hr/DocumentsTab";
import { RemunerationsTab } from "~/components/hr/RemunerationsTab";
import { PayslipsTab } from "~/components/hr/PayslipsTab";
import { HRMetricsDashboard } from "~/components/hr/HRMetricsDashboard";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { AccessDenied } from "~/components/AccessDenied";
import { RequireSubscriptionFeature } from "~/components/RequireSubscriptionFeature";
import { isContractorRole } from "~/utils/roles";

export const Route = createFileRoute("/contractor/hr/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || !isContractorRole(user.role)) {
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: HRToolPage,
});

const tabs = [
  { id: "employees", label: "Employees", icon: Users },
  { id: "performance", label: "Performance", icon: Award },
  { id: "kpis", label: "KPI Tracking", icon: Target },
  { id: "leave", label: "Leave Management", icon: Calendar },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "remunerations", label: "Remunerations", icon: DollarSign },
  { id: "payslips", label: "Payslips", icon: DollarSign },
  { id: "reporting", label: "Reporting", icon: BarChart3 },
] as const;

type TabId = typeof tabs[number]["id"];

function HRToolPage() {
  return (
    <RequireSubscriptionFeature feature="hasHR" returnPath="/contractor/dashboard">
      <HRToolPageInner />
    </RequireSubscriptionFeature>
  );
}

function HRToolPageInner() {
  const { user, token } = useAuthStore();
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState<TabId>("employees");

  // Check user permissions
  const userPermissionsQuery = useQuery(
    trpc.getUserPermissions.queryOptions({
      token: token!,
    })
  );

  const userPermissions = userPermissionsQuery.data?.permissions || [];
  const hasViewAllEmployees = userPermissions.includes("VIEW_ALL_EMPLOYEES");

  // Show loading state while checking permissions
  if (userPermissionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show access denied if user doesn't have permission
  if (!hasViewAllEmployees) {
    return <AccessDenied message="You do not have permission to access the HR Tool." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/contractor/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-2 rounded-xl shadow-md">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Human Resources</h1>
                <p className="text-sm text-gray-600">
                  Employee management, KPIs, and leave tracking
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${
                      isActive
                        ? "border-purple-600 text-purple-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "employees" && <EmployeesTab />}
        {activeTab === "performance" && <PerformanceTab />}
        {activeTab === "kpis" && <KPITrackingTab />}
        {activeTab === "leave" && <LeaveManagementTab />}
        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "remunerations" && <RemunerationsTab />}
        {activeTab === "payslips" && <PayslipsTab />}
        {activeTab === "reporting" && <HRMetricsDashboard />}
      </main>
    </div>
  );
}
