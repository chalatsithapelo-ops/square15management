import { useState, useMemo } from "react";
import { Shield, Search, RotateCcw, Check, X, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

interface RolePermissionManagerProps {
  currentConfig: Record<string, string[]>;
  defaultConfig: Record<string, string[]>;
  allPermissions: string[];
  allRoles: string[];
  roleMetadata: Record<string, { label: string; color: string; description: string }>;
  onSave: (config: Record<string, string[]>) => Promise<void>;
  onReset: () => Promise<void>;
  isSaving: boolean;
}

// Group permissions by category based on their prefix
const groupPermissionsByCategory = (permissions: string[]): Record<string, string[]> => {
  const categories: Record<string, string[]> = {
    "System Administration": [],
    "User & HR Management": [],
    "Financial Management": [],
    "Project Management": [],
    "Operations": [],
    "CRM & Sales": [],
    "Analytics & Reports": [],
    "Customer Features": [],
  };

  permissions.forEach(permission => {
    if (permission.includes("SYSTEM") || permission.includes("COMPANY")) {
      categories["System Administration"].push(permission);
    } else if (permission.includes("EMPLOYEE") || permission.includes("PERFORMANCE") || permission.includes("LEAVE") || permission.includes("HR") || permission.includes("KPI")) {
      categories["User & HR Management"].push(permission);
    } else if (permission.includes("ACCOUNT") || permission.includes("FINANCIAL") || permission.includes("INVOICE") || permission.includes("PAYMENT") || permission.includes("LIABILITY") || permission.includes("ASSET")) {
      categories["Financial Management"].push(permission);
    } else if (permission.includes("PROJECT") || permission.includes("MILESTONE") || permission.includes("CHANGE_ORDER")) {
      categories["Project Management"].push(permission);
    } else if (permission.includes("ORDER") || permission.includes("QUOTATION") || permission.includes("ASSIGN")) {
      categories["Operations"].push(permission);
    } else if (permission.includes("LEAD") || permission.includes("CAMPAIGN") || permission.includes("SALES")) {
      categories["CRM & Sales"].push(permission);
    } else if (permission.includes("ANALYTICS") || permission.includes("DASHBOARD")) {
      categories["Analytics & Reports"].push(permission);
    } else if (permission.includes("OWN") || permission.includes("REVIEW")) {
      categories["Customer Features"].push(permission);
    } else {
      categories["Operations"].push(permission);
    }
  });

  // Remove empty categories
  Object.keys(categories).forEach(key => {
    if (categories[key].length === 0) {
      delete categories[key];
    }
  });

  return categories;
};

// Format permission name for display
const formatPermissionName = (permission: string): string => {
  return permission
    .split("_")
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
};

export function RolePermissionManager({
  currentConfig,
  defaultConfig,
  allPermissions,
  allRoles,
  roleMetadata,
  onSave,
  onReset,
  isSaving,
}: RolePermissionManagerProps) {
  const [localConfig, setLocalConfig] = useState<Record<string, string[]>>(currentConfig);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedRole, setSelectedRole] = useState<string | null>(allRoles[0] || null);

  const permissionCategories = useMemo(
    () => groupPermissionsByCategory(allPermissions),
    [allPermissions]
  );

  // Filter permissions based on search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return permissionCategories;

    const filtered: Record<string, string[]> = {};
    Object.entries(permissionCategories).forEach(([category, permissions]) => {
      const matchingPermissions = permissions.filter(perm =>
        formatPermissionName(perm).toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (matchingPermissions.length > 0) {
        filtered[category] = matchingPermissions;
      }
    });
    return filtered;
  }, [permissionCategories, searchTerm]);

  // Check if configuration has changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(localConfig) !== JSON.stringify(currentConfig);
  }, [localConfig, currentConfig]);

  // Check if a permission differs from default
  const isDifferentFromDefault = (role: string, permission: string): boolean => {
    const currentHas = localConfig[role]?.includes(permission) || false;
    const defaultHas = defaultConfig[role]?.includes(permission) || false;
    return currentHas !== defaultHas;
  };

  // Toggle permission for a role
  const togglePermission = (role: string, permission: string) => {
    setLocalConfig(prev => {
      const rolePermissions = prev[role] || [];
      const hasPermission = rolePermissions.includes(permission);

      if (hasPermission) {
        // Removing permission - check if it's critical
        const criticalPermissions = ["MANAGE_SYSTEM_SETTINGS", "MANAGE_COMPANY_SETTINGS"];
        if (role === "SENIOR_ADMIN" && criticalPermissions.includes(permission)) {
          toast.error(`Cannot remove ${formatPermissionName(permission)} from Senior Admin role`);
          return prev;
        }

        return {
          ...prev,
          [role]: rolePermissions.filter(p => p !== permission),
        };
      } else {
        return {
          ...prev,
          [role]: [...rolePermissions, permission],
        };
      }
    });
  };

  // Select all permissions for a role
  const selectAllForRole = (role: string) => {
    setLocalConfig(prev => ({
      ...prev,
      [role]: [...allPermissions],
    }));
    toast.success(`All permissions granted to ${roleMetadata[role]?.label || role}`);
  };

  // Deselect all permissions for a role
  const deselectAllForRole = (role: string) => {
    if (role === "SENIOR_ADMIN") {
      toast.error("Cannot remove all permissions from Senior Admin role");
      return;
    }

    setLocalConfig(prev => ({
      ...prev,
      [role]: [],
    }));
    toast.success(`All permissions removed from ${roleMetadata[role]?.label || role}`);
  };

  // Reset role to default
  const resetRoleToDefault = (role: string) => {
    setLocalConfig(prev => ({
      ...prev,
      [role]: defaultConfig[role] || [],
    }));
    toast.success(`${roleMetadata[role]?.label || role} reset to default permissions`);
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Handle save
  const handleSave = async () => {
    try {
      await onSave(localConfig);
      toast.success("Role permissions updated successfully!");
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to save permissions");
    }
  };

  // Handle reset to defaults
  const handleResetToDefaults = async () => {
    if (!confirm("Are you sure you want to reset all roles to their default permissions? This will discard all custom configurations.")) {
      return;
    }

    try {
      await onReset();
      setLocalConfig(defaultConfig);
      toast.success("All roles reset to default permissions!");
    } catch (error) {
      console.error("Error resetting permissions:", error);
      toast.error("Failed to reset permissions");
    }
  };

  // Discard local changes
  const handleDiscardChanges = () => {
    setLocalConfig(currentConfig);
    toast.success("Changes discarded");
  };

  if (!selectedRole) {
    return (
      <div className="text-center py-8 text-gray-500">
        No roles available
      </div>
    );
  }

  const rolePermissions = localConfig[selectedRole] || [];

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-gray-700" />
            Role Permission Matrix
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure permissions for each role. Changes take effect immediately after saving.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              <X className="h-4 w-4 mr-1" />
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={handleResetToDefaults}
            disabled={isSaving}
            className="inline-flex items-center px-3 py-2 border border-orange-300 rounded-lg text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset All to Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Warning about changes */}
      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">You have unsaved changes</p>
              <p className="mt-1">
                Remember to save your changes before leaving this page. Changes take effect immediately after saving.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Role selector and search */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Role
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {allRoles.map(role => (
              <option key={role} value={role}>
                {roleMetadata[role]?.label || role}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Permissions
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search permissions..."
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Role info and bulk actions */}
      {selectedRole && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleMetadata[selectedRole]?.color || "bg-gray-100 text-gray-800"}`}>
                  {roleMetadata[selectedRole]?.label || selectedRole}
                </span>
                <span className="ml-3 text-sm text-blue-700">
                  {rolePermissions.length} / {allPermissions.length} permissions
                </span>
              </div>
              <p className="text-sm text-blue-800">
                {roleMetadata[selectedRole]?.description || "No description available"}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                type="button"
                onClick={() => selectAllForRole(selectedRole)}
                className="text-xs px-2 py-1 border border-blue-300 rounded text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => deselectAllForRole(selectedRole)}
                disabled={selectedRole === "SENIOR_ADMIN"}
                className="text-xs px-2 py-1 border border-blue-300 rounded text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Deselect All
              </button>
              <button
                type="button"
                onClick={() => resetRoleToDefault(selectedRole)}
                className="text-xs px-2 py-1 border border-orange-300 rounded text-orange-700 hover:bg-orange-100 transition-colors"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission categories */}
      <div className="space-y-4">
        {Object.entries(filteredCategories).map(([category, permissions]) => {
          const isExpanded = expandedCategories[category] !== false; // Default to expanded
          const categoryPermissionCount = permissions.filter(p => rolePermissions.includes(p)).length;

          return (
            <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">{category}</span>
                  <span className="ml-3 text-sm text-gray-600">
                    {categoryPermissionCount} / {permissions.length} enabled
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {isExpanded && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {permissions.map(permission => {
                      const isEnabled = rolePermissions.includes(permission);
                      const isDifferent = isDifferentFromDefault(selectedRole, permission);

                      return (
                        <label
                          key={permission}
                          className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            isEnabled
                              ? "border-green-300 bg-green-50"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => togglePermission(selectedRole, permission)}
                            className="mt-0.5 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${isEnabled ? "text-green-900" : "text-gray-900"}`}>
                                {formatPermissionName(permission)}
                              </span>
                              {isDifferent && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Modified
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 font-mono">
                              {permission}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-gray-600 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Senior Admin role cannot have all permissions removed</li>
              <li>Changes take effect immediately after saving</li>
              <li>Users will need to refresh their session to see permission changes</li>
              <li>Modified permissions are highlighted with a "Modified" badge</li>
              <li>Use "Reset to Default" to restore a role's original permissions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
