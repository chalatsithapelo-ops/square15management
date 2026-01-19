import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, Loader2, Plus, Search } from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";
import { useState } from "react";

export const Route = createFileRoute("/admin/property-management/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || (user.role !== "JUNIOR_ADMIN" && user.role !== "SENIOR_ADMIN")) {
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: PropertyManagementPage,
});

const createPropertyManagerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  password: z.string().optional(),

  pmCompanyName: z.string().optional(),
  pmCompanyAddressLine1: z.string().optional(),
  pmCompanyAddressLine2: z.string().optional(),
  pmCompanyPhone: z.string().optional(),
  pmCompanyEmail: z.string().optional(),
  pmCompanyVatNumber: z.string().optional(),
  pmCompanyBankName: z.string().optional(),
  pmCompanyBankAccountName: z.string().optional(),
  pmCompanyBankAccountNumber: z.string().optional(),
  pmCompanyBankBranchCode: z.string().optional(),

  pmBrandPrimaryColor: z.string().optional(),
  pmBrandSecondaryColor: z.string().optional(),
  pmBrandAccentColor: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.password && v.password.length < 6) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Password must be at least 6 characters",
      path: ["password"],
    });
  }
});

type CreatePropertyManagerValues = z.infer<typeof createPropertyManagerSchema>;

function PropertyManagementPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [editingPropertyManager, setEditingPropertyManager] = useState<any | null>(null);

  // Permissions: keep simple & consistent with other admin tools
  if (!user || (user.role !== "JUNIOR_ADMIN" && user.role !== "SENIOR_ADMIN")) {
    return <AccessDenied message="You do not have permission to access Property Management." />;
  }

  const propertyManagersQuery = useQuery({
    ...trpc.getPropertyManagers.queryOptions({
      token: token!,
      searchQuery: searchQuery || undefined,
    }),
    enabled: !!token,
  });

  if (propertyManagersQuery.isError && (propertyManagersQuery.error as any)?.data?.code === "FORBIDDEN") {
    return <AccessDenied message={(propertyManagersQuery.error as any)?.message || "Access denied"} />;
  }

  const createPropertyManagerMutation = useMutation(
    trpc.createPropertyManager.mutationOptions({
      onSuccess: async (res: any) => {
        toast.success(res?.message ?? "Property Manager created");
        await queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagers.queryKey(),
        });
        form.reset();
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Failed to create Property Manager");
      },
    })
  );

  const updatePropertyManagerMutation = useMutation(
    trpc.updatePropertyManager.mutationOptions({
      onSuccess: async (res: any) => {
        toast.success(res?.message ?? "Property Manager updated");
        await queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagers.queryKey(),
        });
        setEditingPropertyManager(null);
        form.reset({
          pmBrandPrimaryColor: "#2D5016",
          pmBrandSecondaryColor: "#F4C430",
          pmBrandAccentColor: "#5A9A47",
        });
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Failed to update Property Manager");
      },
    })
  );

  const deletePropertyManagerMutation = useMutation(
    trpc.deletePropertyManager.mutationOptions({
      onSuccess: async (res: any) => {
        toast.success(res?.message ?? "Property Manager deleted");
        await queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagers.queryKey(),
        });
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Failed to delete Property Manager");
      },
    })
  );

  const form = useForm<CreatePropertyManagerValues>({
    resolver: zodResolver(createPropertyManagerSchema),
    defaultValues: {
      pmBrandPrimaryColor: "#2D5016",
      pmBrandSecondaryColor: "#F4C430",
      pmBrandAccentColor: "#5A9A47",
    },
  });

  const onSubmit = async (values: CreatePropertyManagerValues) => {
    if (!token) return;

    const isEditing = !!editingPropertyManager?.id;
    if (!isEditing && !values.password) {
      form.setError("password", { type: "manual", message: "Password is required" });
      return;
    }

    if (isEditing) {
      await updatePropertyManagerMutation.mutateAsync({
        token,
        propertyManagerId: editingPropertyManager.id,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        pmCompanyName: values.pmCompanyName,
        pmCompanyAddressLine1: values.pmCompanyAddressLine1,
        pmCompanyAddressLine2: values.pmCompanyAddressLine2,
        pmCompanyPhone: values.pmCompanyPhone,
        pmCompanyEmail: values.pmCompanyEmail,
        pmCompanyVatNumber: values.pmCompanyVatNumber,
        pmCompanyBankName: values.pmCompanyBankName,
        pmCompanyBankAccountName: values.pmCompanyBankAccountName,
        pmCompanyBankAccountNumber: values.pmCompanyBankAccountNumber,
        pmCompanyBankBranchCode: values.pmCompanyBankBranchCode,
        pmBrandPrimaryColor: values.pmBrandPrimaryColor,
        pmBrandSecondaryColor: values.pmBrandSecondaryColor,
        pmBrandAccentColor: values.pmBrandAccentColor,
        newPassword: values.password,
      });
      return;
    }

    await createPropertyManagerMutation.mutateAsync({
      token,
      ...values,
      password: values.password!,
    });
  };

  const propertyManagers = propertyManagersQuery.data?.propertyManagers ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/admin/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-2 rounded-xl shadow-md">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Property Management</h1>
                <p className="text-sm text-gray-600">Onboard and manage Property Manager accounts</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Create / Onboard */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPropertyManager ? "Edit Property Manager" : "Onboard Property Manager"}
              </h2>
              <p className="text-sm text-gray-600">Create login + company details + branding</p>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-gray-600">
              <Plus className="h-4 w-4" />
              In-depth onboarding
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Account */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Account</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("firstName")}
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("lastName")}
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.lastName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    disabled={!!editingPropertyManager}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("phone")}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingPropertyManager ? "New password (optional)" : "Password"}
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("password")}
                  />
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.password.message}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Company */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Company Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyName")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address line 1</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyAddressLine1")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address line 2</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyAddressLine2")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company phone</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyPhone")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyEmail")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VAT number</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyVatNumber")}
                  />
                </div>
              </div>
            </section>

            {/* Banking */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Banking Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyBankName")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyBankAccountName")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account number</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyBankAccountNumber")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch code</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmCompanyBankBranchCode")}
                  />
                </div>
              </div>
            </section>

            {/* Branding */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Branding</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmBrandPrimaryColor")}
                    placeholder="#2D5016"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secondary</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmBrandSecondaryColor")}
                    placeholder="#F4C430"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Accent</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    {...form.register("pmBrandAccentColor")}
                    placeholder="#5A9A47"
                  />
                </div>
              </div>
            </section>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingPropertyManager(null);
                  form.reset({
                    pmBrandPrimaryColor: "#2D5016",
                    pmBrandSecondaryColor: "#F4C430",
                    pmBrandAccentColor: "#5A9A47",
                  });
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {editingPropertyManager ? "Cancel" : "Reset"}
              </button>
              <button
                type="submit"
                disabled={createPropertyManagerMutation.isPending || updatePropertyManagerMutation.isPending}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {createPropertyManagerMutation.isPending || updatePropertyManagerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingPropertyManager ? "Save Changes" : "Create Property Manager"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Property Managers</h2>
              <p className="text-sm text-gray-600">All onboarded Property Managers</p>
            </div>
            <div className="w-full md:w-96">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Name, email, or company..."
                />
              </div>
            </div>
          </div>

          {propertyManagersQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Company</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Subscription</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {propertyManagers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-600">
                        No Property Managers found
                      </td>
                    </tr>
                  ) : (
                    propertyManagers.map((pm: any) => (
                      <tr key={pm.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {pm.firstName} {pm.lastName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{pm.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{pm.pmCompanyName || "-"}</td>
                        <td className="px-4 py-3 text-sm">
                          {pm.subscriptions?.[0] ? (
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-gray-900">{pm.subscriptions[0].package.displayName}</span>
                              <span className="text-xs text-gray-600">R{pm.subscriptions[0].package.basePrice}/mo</span>
                              <span className="text-xs text-gray-500">{pm.subscriptions[0].currentUsers}/{pm.subscriptions[0].maxUsers} users</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">No subscription</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {pm.subscriptions?.[0] ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              pm.subscriptions[0].status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                              pm.subscriptions[0].status === 'TRIAL' ? 'bg-blue-100 text-blue-800' :
                              pm.subscriptions[0].status === 'SUSPENDED' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {pm.subscriptions[0].status}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">NONE</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {pm.createdAt ? new Date(pm.createdAt).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-blue-600 hover:underline"
                              onClick={() => {
                                setEditingPropertyManager(pm);
                                form.reset({
                                  firstName: pm.firstName,
                                  lastName: pm.lastName,
                                  email: pm.email,
                                  phone: pm.phone ?? "",
                                  password: "",
                                  pmCompanyName: pm.pmCompanyName ?? "",
                                  pmCompanyAddressLine1: pm.pmCompanyAddressLine1 ?? "",
                                  pmCompanyAddressLine2: pm.pmCompanyAddressLine2 ?? "",
                                  pmCompanyPhone: pm.pmCompanyPhone ?? "",
                                  pmCompanyEmail: pm.pmCompanyEmail ?? "",
                                  pmCompanyVatNumber: pm.pmCompanyVatNumber ?? "",
                                  pmCompanyBankName: pm.pmCompanyBankName ?? "",
                                  pmCompanyBankAccountName: pm.pmCompanyBankAccountName ?? "",
                                  pmCompanyBankAccountNumber: pm.pmCompanyBankAccountNumber ?? "",
                                  pmCompanyBankBranchCode: pm.pmCompanyBankBranchCode ?? "",
                                  pmBrandPrimaryColor: pm.pmBrandPrimaryColor ?? "#2D5016",
                                  pmBrandSecondaryColor: pm.pmBrandSecondaryColor ?? "#F4C430",
                                  pmBrandAccentColor: pm.pmBrandAccentColor ?? "#5A9A47",
                                });
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:underline disabled:opacity-50"
                              disabled={deletePropertyManagerMutation.isPending}
                              onClick={async () => {
                                if (!token) return;
                                const ok = window.confirm(
                                  `Delete Property Manager ${pm.firstName} ${pm.lastName}? This cannot be undone.`
                                );
                                if (!ok) return;
                                await deletePropertyManagerMutation.mutateAsync({
                                  token,
                                  propertyManagerId: pm.id,
                                });
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
