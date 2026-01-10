import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertTriangle,
  Loader2,
  Shield,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";

interface CustomRole {
  name: string;
  label: string;
  color: string;
  description: string;
  defaultRoute: string;
  permissions: string[];
}

interface CustomRoleManagerProps {
  onRoleCreated?: () => void;
  onRoleUpdated?: () => void;
  onRoleDeleted?: () => void;
}

const AVAILABLE_COLORS = [
  { value: "bg-red-100 text-red-800", label: "Red" },
  { value: "bg-orange-100 text-orange-800", label: "Orange" },
  { value: "bg-amber-100 text-amber-800", label: "Amber" },
  { value: "bg-yellow-100 text-yellow-800", label: "Yellow" },
  { value: "bg-lime-100 text-lime-800", label: "Lime" },
  { value: "bg-green-100 text-green-800", label: "Green" },
  { value: "bg-emerald-100 text-emerald-800", label: "Emerald" },
  { value: "bg-teal-100 text-teal-800", label: "Teal" },
  { value: "bg-cyan-100 text-cyan-800", label: "Cyan" },
  { value: "bg-sky-100 text-sky-800", label: "Sky" },
  { value: "bg-blue-100 text-blue-800", label: "Blue" },
  { value: "bg-indigo-100 text-indigo-800", label: "Indigo" },
  { value: "bg-violet-100 text-violet-800", label: "Violet" },
  { value: "bg-purple-100 text-purple-800", label: "Purple" },
  { value: "bg-fuchsia-100 text-fuchsia-800", label: "Fuchsia" },
  { value: "bg-pink-100 text-pink-800", label: "Pink" },
  { value: "bg-rose-100 text-rose-800", label: "Rose" },
];

const AVAILABLE_ROUTES = [
  { value: "/admin/dashboard", label: "Admin Dashboard" },
  { value: "/admin/operations", label: "Operations" },
  { value: "/admin/crm", label: "CRM" },
  { value: "/admin/accounts", label: "Accounts" },
  { value: "/admin/hr", label: "HR Management" },
  { value: "/admin/projects/dashboard", label: "Projects Dashboard" },
  { value: "/admin/sales-dashboard", label: "Sales Dashboard" },
];

export function CustomRoleManager({
  onRoleCreated,
  onRoleUpdated,
  onRoleDeleted,
}: CustomRoleManagerProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const [isCreating, setIsCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    label: "",
    color: AVAILABLE_COLORS[0].value,
    description: "",
    defaultRoute: AVAILABLE_ROUTES[0].value,
  });

  // Fetch custom roles
  const customRolesQuery = useQuery({
    ...trpc.getCustomRoles.queryOptions({ token: token! }),
    enabled: !!token,
  });

  // Fetch employees to show user counts per role
  const employeesQuery = useQuery({
    ...trpc.getEmployees.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const createMutation = useMutation(trpc.createCustomRole.mutationOptions());
  const updateMutation = useMutation(trpc.updateCustomRole.mutationOptions());
  const deleteMutation = useMutation(trpc.deleteCustomRole.mutationOptions());

  // Get user count for a role
  const getUserCount = (roleName: string) => {
    if (!employeesQuery.data) return 0;
    return employeesQuery.data.employees.filter(e => e.role === roleName).length;
  };

  const resetForm = () => {
    setFormData({
      name: "",
      label: "",
      color: AVAILABLE_COLORS[0].value,
      description: "",
      defaultRoute: AVAILABLE_ROUTES[0].value,
    });
    setIsCreating(false);
    setEditingRole(null);
  };

  const handleCreate = async () => {
    if (!token) return;

    if (!formData.name || !formData.label || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createMutation.mutateAsync({
        token,
        name: formData.name,
        label: formData.label,
        color: formData.color,
        description: formData.description,
        defaultRoute: formData.defaultRoute,
        permissions: [],
      });

      toast.success("Custom role created successfully!");
      resetForm();
      customRolesQuery.refetch();
      onRoleCreated?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to create custom role");
    }
  };

  const handleUpdate = async () => {
    if (!token || !editingRole) return;

    try {
      await updateMutation.mutateAsync({
        token,
        name: editingRole.name,
        label: formData.label,
        color: formData.color,
        description: formData.description,
        defaultRoute: formData.defaultRoute,
      });

      toast.success("Custom role updated successfully!");
      resetForm();
      customRolesQuery.refetch();
      onRoleUpdated?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update custom role");
    }
  };

  const handleDelete = async (roleName: string) => {
    if (!token) return;

    const userCount = getUserCount(roleName);
    if (userCount > 0) {
      toast.error(
        `Cannot delete role: ${userCount} user(s) currently have this role assigned`
      );
      return;
    }

    if (
      !confirm(
        "Are you sure you want to delete this custom role? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ token, name: roleName });
      toast.success("Custom role deleted successfully!");
      customRolesQuery.refetch();
      onRoleDeleted?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete custom role");
    }
  };

  const startEdit = (role: CustomRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      label: role.label,
      color: role.color,
      description: role.description,
      defaultRoute: role.defaultRoute,
    });
    setIsCreating(false);
  };

  const customRoles = customRolesQuery.data?.customRoles || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-gray-700" />
            Custom Roles
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Create custom roles to match your organization's structure
          </p>
        </div>
        {!isCreating && !editingRole && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Custom Role
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingRole) && (
        <div className="bg-white border-2 border-green-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {editingRole ? "Edit Custom Role" : "Create New Custom Role"}
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Name (Identifier) *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value.toUpperCase().replace(/[^A-Z_]/g, "") })
                }
                placeholder="PROJECT_COORDINATOR"
                disabled={!!editingRole}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Uppercase letters and underscores only. Cannot be changed after creation.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Label *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Project Coordinator"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Badge Color *
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {AVAILABLE_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: colorOption.value })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      colorOption.value
                    } ${
                      formData.color === colorOption.value
                        ? "ring-2 ring-offset-2 ring-gray-400"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {colorOption.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the responsibilities and access level of this role..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Route (After Login) *
              </label>
              <select
                value={formData.defaultRoute}
                onChange={(e) => setFormData({ ...formData, defaultRoute: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {AVAILABLE_ROUTES.map((route) => (
                  <option key={route.value} value={route.value}>
                    {route.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                onClick={editingRole ? handleUpdate : handleCreate}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="h-4 w-4 mr-1" />
                {editingRole ? "Update Role" : "Create Role"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Roles List */}
      {customRolesQuery.isLoading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400 mb-4" />
            <p className="text-gray-600">Loading custom roles...</p>
          </div>
        </div>
      ) : customRoles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12">
          <div className="text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Custom Roles</h3>
            <p className="text-gray-600 mb-6">
              Create custom roles to better match your organization's structure
            </p>
            {!isCreating && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Your First Custom Role
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customRoles.map((role) => {
            const userCount = getUserCount(role.name);
            return (
              <div
                key={role.name}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${role.color}`}>
                        {role.label}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        <Users className="h-3 w-3 mr-1" />
                        {userCount} {userCount === 1 ? "user" : "users"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono mb-2">{role.name}</p>
                    <p className="text-sm text-gray-700">{role.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Default Route: <span className="font-mono">{role.defaultRoute}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Permissions: {role.permissions.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      type="button"
                      onClick={() => startEdit(role)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit role"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(role.name)}
                      disabled={userCount > 0 || deleteMutation.isPending}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={userCount > 0 ? "Cannot delete role with assigned users" : "Delete role"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {userCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-amber-700 flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      This role is assigned to {userCount} user(s). Reassign users before deleting.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Custom Roles</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Custom roles appear in the permission configuration alongside built-in roles</li>
              <li>Configure permissions for custom roles using the Permission Matrix below</li>
              <li>Role names cannot be changed after creation</li>
              <li>Custom roles cannot be deleted while assigned to users</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
