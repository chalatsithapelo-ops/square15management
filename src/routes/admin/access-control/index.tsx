import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { Shield, ArrowLeft, Loader2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";
import { RolePermissionManager } from "~/components/admin/RolePermissionManager";
import { CustomRoleManager } from "~/components/admin/CustomRoleManager";

export const Route = createFileRoute("/admin/access-control/")({
  component: AccessControlPage,
});

function AccessControlPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();

  // Fetch current configuration
  const configQuery = useQuery({
    ...trpc.getRolePermissionConfig.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const updateConfigMutation = useMutation(
    trpc.updateRolePermissionConfig.mutationOptions()
  );

  const resetConfigMutation = useMutation(
    trpc.resetRolePermissionConfig.mutationOptions()
  );

  // Check if user is senior admin
  if (user?.role !== "SENIOR_ADMIN") {
    return (
      <AccessDenied
        message="Only senior administrators can manage role permissions."
        returnPath="/admin/dashboard"
      />
    );
  }

  const handleSave = async (config: Record<string, string[]>) => {
    if (!token) return;
    
    await updateConfigMutation.mutateAsync({
      token,
      config,
    });

    // Refetch to get updated data
    await configQuery.refetch();
  };

  const handleReset = async () => {
    if (!token) return;

    await resetConfigMutation.mutateAsync({ token });

    // Refetch to get default configuration
    await configQuery.refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/admin/settings"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Settings
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Shield className="h-8 w-8 mr-3 text-green-600" />
                Access Control Management
              </h1>
              <p className="mt-2 text-gray-600">
                Configure role-based permissions to control access to features and data across the application
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Status */}
        {configQuery.data && (
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start">
                {configQuery.data.isUsingDynamicConfig ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {configQuery.data.isUsingDynamicConfig ? "Custom Configuration" : "Default Configuration"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {configQuery.data.isUsingDynamicConfig
                      ? "Using customized role permissions"
                      : "Using built-in default permissions"}
                  </p>
                </div>
              </div>

              {configQuery.data.lastModified && (
                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-gray-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Last Modified</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(configQuery.data.lastModified).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start">
                <Shield className="h-5 w-5 text-gray-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Total Roles</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {configQuery.data.allRoles.length} roles configured
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {configQuery.isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-gray-400 mb-4" />
              <p className="text-gray-600">Loading configuration...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {configQuery.isError && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
            <div className="flex items-start">
              <AlertCircle className="h-6 w-6 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-red-900">Failed to Load Configuration</h3>
                <p className="text-sm text-red-700 mt-1">
                  There was an error loading the role permission configuration. Please try refreshing the page.
                </p>
                <button
                  type="button"
                  onClick={() => configQuery.refetch()}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {configQuery.data && (
          <>
            {/* Custom Role Management */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <CustomRoleManager
                onRoleCreated={() => configQuery.refetch()}
                onRoleUpdated={() => configQuery.refetch()}
                onRoleDeleted={() => configQuery.refetch()}
              />
            </div>

            {/* Role Permission Matrix */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <RolePermissionManager
                currentConfig={configQuery.data.currentConfig}
                defaultConfig={configQuery.data.defaultConfig}
                allPermissions={configQuery.data.allPermissions}
                allRoles={configQuery.data.allRoles}
                roleMetadata={configQuery.data.roleMetadata}
                onSave={handleSave}
                onReset={handleReset}
                isSaving={updateConfigMutation.isPending || resetConfigMutation.isPending}
              />
            </div>
          </>
        )}

        {/* Security Notice */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Security Considerations</p>
              <ul className="list-disc list-inside space-y-1 text-yellow-700">
                <li>Changes to permissions take effect immediately for all users with the affected roles</li>
                <li>Users may need to log out and log back in to see all permission changes reflected</li>
                <li>Be cautious when modifying Senior Admin permissions as this could lock you out of critical features</li>
                <li>Always test permission changes with a non-production account before applying to production</li>
                <li>Keep a record of your permission configuration changes for audit purposes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
