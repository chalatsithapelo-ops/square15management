import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  Search,
  Filter,
  Plus,
} from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/contractor-management/")({
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
  component: ContractorManagementAdminPage,
});

const createContractorSchema = z
  .object({
    propertyManagerId: z.number().int().positive().optional(),

    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),

    companyName: z.string().optional(),
    registrationNumber: z.string().optional(),

    serviceType: z.string().min(1, "Service type is required"),
    serviceCategory: z.string().optional(),
    specializations: z.string().optional(),

    hourlyRate: z.coerce.number().optional(),
    dailyRate: z.coerce.number().optional(),
    projectRate: z.coerce.number().optional(),

    bankName: z.string().optional(),
    bankAccountHolder: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankCode: z.string().optional(),

    notes: z.string().optional(),

    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.password && v.password.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password must be at least 6 characters",
        path: ["password"],
      });
    }

    if (v.confirmPassword && v.confirmPassword.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirm password",
        path: ["confirmPassword"],
      });
    }

    if ((v.password || v.confirmPassword) && v.password !== v.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

type CreateContractorValues = z.infer<typeof createContractorSchema>;

function ContractorManagementAdminPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const isAdminUser = !!user && (user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN");

  const [searchQuery, setSearchQuery] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [propertyManagerFilter, setPropertyManagerFilter] = useState<string>("");
  const [editingContractor, setEditingContractor] = useState<any | null>(null);

  const form = useForm<CreateContractorValues>({
    resolver: zodResolver(createContractorSchema),
    defaultValues: {
      serviceType: "GENERAL_MAINTENANCE",
    },
  });

  const createContractorMutation = useMutation(
    trpc.createContractor.mutationOptions({
      onSuccess: async (res: any) => {
        toast.success(res?.message ?? "Contractor created");
        await queryClient.invalidateQueries({
          queryKey: trpc.getContractors.queryKey(),
        });
        form.reset();
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Failed to create contractor");
      },
    })
  );

  const updateContractorMutation = useMutation(
    trpc.updateContractor.mutationOptions({
      onSuccess: async (res: any) => {
        toast.success(res?.message ?? "Contractor updated");
        await queryClient.invalidateQueries({
          queryKey: trpc.getContractors.queryKey(),
        });
        setEditingContractor(null);
        form.reset({ serviceType: "GENERAL_MAINTENANCE" });
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Failed to update contractor");
      },
    })
  );

  const deleteContractorMutation = useMutation(
    trpc.deleteContractor.mutationOptions({
      onSuccess: async (res: any) => {
        toast.success(res?.message ?? "Contractor deleted");
        await queryClient.invalidateQueries({
          queryKey: trpc.getContractors.queryKey(),
        });
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Failed to delete contractor");
      },
    })
  );

  const propertyManagersQuery = useQuery({
    ...trpc.getPropertyManagers.queryOptions({
      token: token!,
    }),
    enabled: !!token && isAdminUser,
  });

  const propertyManagers = propertyManagersQuery.data?.propertyManagers ?? [];

  const selectedPropertyManagerId = useMemo(() => {
    const n = Number(propertyManagerFilter);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [propertyManagerFilter]);

  const contractorsQuery = useQuery({
    ...trpc.getContractors.queryOptions({
      token: token!,
      propertyManagerId: selectedPropertyManagerId,
      serviceType: serviceTypeFilter || undefined,
      status: statusFilter || undefined,
      searchQuery: searchQuery || undefined,
    }),
    enabled: !!token && isAdminUser,
  });

  const forbiddenError: any =
    (propertyManagersQuery.isError && (propertyManagersQuery.error as any)?.data?.code === "FORBIDDEN"
      ? propertyManagersQuery.error
      : null) ||
    (contractorsQuery.isError && (contractorsQuery.error as any)?.data?.code === "FORBIDDEN"
      ? contractorsQuery.error
      : null);

  const contractors = contractorsQuery.data?.contractors ?? [];

  if (!isAdminUser) {
    return <AccessDenied message="You do not have permission to access Contractor Management." />;
  }

  if (forbiddenError) {
    return <AccessDenied message={forbiddenError?.message || "Access denied"} />;
  }

  const onSubmit: SubmitHandler<CreateContractorValues> = async (values) => {
    if (!token) return;

    const isEditing = !!editingContractor?.id;
    if (!isEditing && !values.password) {
      form.setError("password", { type: "manual", message: "Password is required" });
      return;
    }

    const specializations = (values.specializations || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (isEditing) {
      await updateContractorMutation.mutateAsync({
        token,
        contractorId: editingContractor.id,
        propertyManagerId:
          values.propertyManagerId === undefined ? undefined : values.propertyManagerId,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        companyName: values.companyName,
        registrationNumber: values.registrationNumber,
        serviceType: values.serviceType,
        serviceCategory: values.serviceCategory,
        specializations,
        hourlyRate: values.hourlyRate,
        dailyRate: values.dailyRate,
        projectRate: values.projectRate,
        bankName: values.bankName,
        bankAccountHolder: values.bankAccountHolder,
        bankAccountNumber: values.bankAccountNumber,
        bankCode: values.bankCode,
        notes: values.notes,
        newPassword: values.password,
      });
      return;
    }

    await createContractorMutation.mutateAsync({
      token,
      propertyManagerId: values.propertyManagerId,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      companyName: values.companyName,
      registrationNumber: values.registrationNumber,
      serviceType: values.serviceType,
      serviceCategory: values.serviceCategory,
      specializations,
      hourlyRate: values.hourlyRate,
      dailyRate: values.dailyRate,
      projectRate: values.projectRate,
      bankName: values.bankName,
      bankAccountHolder: values.bankAccountHolder,
      bankAccountNumber: values.bankAccountNumber,
      bankCode: values.bankCode,
      notes: values.notes,
      password: values.password!,
      confirmPassword: values.confirmPassword,
    });
  };

  const serviceTypes = [
    "PLUMBING",
    "ELECTRICAL",
    "HVAC",
    "CARPENTRY",
    "PAINTING",
    "ROOFING",
    "GENERAL_MAINTENANCE",
  ];

  const statuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "TERMINATED"];

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
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-xl shadow-md">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Contractor Management</h1>
                <p className="text-sm text-gray-600">Onboard contractors and manage assignments</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* In-depth onboarding */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {editingContractor ? "Edit Contractor" : "Onboard Contractor"}
              </h2>
              <p className="text-sm text-gray-600">Create login + profile + banking + assignment</p>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-gray-600">
              <Plus className="h-4 w-4" />
              In-depth onboarding
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Assignment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Manager (optional)</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={form.watch("propertyManagerId") ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      form.setValue("propertyManagerId", v ? Number(v) : undefined);
                    }}
                  >
                    <option value="">
                      {propertyManagersQuery.isLoading ? "Loading..." : "Not linked"}
                    </option>
                    {propertyManagers.map((pm: any) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.firstName} {pm.lastName} — {pm.pmCompanyName || pm.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("firstName")} />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("lastName")} />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.lastName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    disabled={!!editingContractor}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("phone")} />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Service Profile</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("serviceType")}>
                    {serviceTypes.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.serviceType && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.serviceType.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service category (optional)</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("serviceCategory")} />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Specializations (optional, comma-separated)
                  </label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("specializations")} />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Company & Rates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("companyName")} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration number</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("registrationNumber")} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hourly rate</label>
                  <input type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("hourlyRate")} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily rate</label>
                  <input type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("dailyRate")} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project rate</label>
                  <input type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("projectRate")} />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Banking</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank name</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("bankName")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account holder</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("bankAccountHolder")} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account number</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("bankAccountNumber")} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch code</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("bankCode")} />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Login Credentials</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingContractor ? "New password (optional)" : "Password"}
                  </label>
                  <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("password")} />
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.password.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingContractor ? "Confirm new password" : "Confirm password"}
                  </label>
                  <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg" {...form.register("confirmPassword")} />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Notes</h3>
              <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} {...form.register("notes")} />
            </section>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingContractor(null);
                  form.reset({ serviceType: "GENERAL_MAINTENANCE" });
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {editingContractor ? "Cancel" : "Reset"}
              </button>
              <button
                type="submit"
                disabled={createContractorMutation.isPending || updateContractorMutation.isPending}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createContractorMutation.isPending || updateContractorMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingContractor ? "Save Changes" : "Create Contractor"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Filters + List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Contractors</h2>
              <p className="text-sm text-gray-600">All contractors (filterable by Property Manager)</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Manager</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={propertyManagerFilter}
                  onChange={(e) => setPropertyManagerFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {propertyManagers.map((pm: any) => (
                    <option key={pm.id} value={String(pm.id)}>
                      {pm.firstName} {pm.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {serviceTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4 flex items-center gap-2 text-sm text-gray-600">
                <Filter className="h-4 w-4" />
                Filters apply instantly
              </div>
            </div>
          </div>

          {contractorsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Company</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Service</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Subscription</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Portal</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contractors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-600">
                        No contractors found
                      </td>
                    </tr>
                  ) : (
                    contractors.map((c: any) => (
                      <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {c.firstName} {c.lastName}
                          <div className="text-xs text-gray-500">{c.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.companyName || "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                            {c.serviceType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {c.subscription ? (
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-gray-900">{c.subscription.package.displayName}</span>
                              <span className="text-xs text-gray-600">R{c.subscription.package.basePrice}/mo</span>
                              <span className="text-xs text-gray-500">{c.subscription.currentUsers}/{c.subscription.maxUsers} users</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">No subscription</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {c.subscription ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              c.subscription.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                              c.subscription.status === 'TRIAL' ? 'bg-blue-100 text-blue-800' :
                              c.subscription.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {c.subscription.status}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">NONE</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.portalAccessEnabled ? "Enabled" : "Disabled"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-blue-600 hover:underline"
                              onClick={() => {
                                setEditingContractor(c);
                                form.reset({
                                  propertyManagerId: c.propertyManager?.id ?? undefined,
                                  firstName: c.firstName,
                                  lastName: c.lastName,
                                  email: c.email,
                                  phone: c.phone ?? "",
                                  companyName: c.companyName ?? "",
                                  registrationNumber: c.registrationNumber ?? "",
                                  serviceType: c.serviceType,
                                  serviceCategory: c.serviceCategory ?? "",
                                  specializations: (c.specializations ?? []).join(", "),
                                  hourlyRate: c.hourlyRate ?? undefined,
                                  dailyRate: c.dailyRate ?? undefined,
                                  projectRate: c.projectRate ?? undefined,
                                  bankName: c.bankName ?? "",
                                  bankAccountHolder: c.bankAccountHolder ?? "",
                                  bankAccountNumber: c.bankAccountNumber ?? "",
                                  bankCode: c.bankCode ?? "",
                                  notes: c.notes ?? "",
                                  password: "",
                                  confirmPassword: "",
                                });
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:underline disabled:opacity-50"
                              disabled={deleteContractorMutation.isPending}
                              onClick={async () => {
                                if (!token) return;
                                const ok = window.confirm(
                                  `Delete contractor ${c.firstName} ${c.lastName}? This cannot be undone.`
                                );
                                if (!ok) return;
                                await deleteContractorMutation.mutateAsync({
                                  token,
                                  contractorId: c.id,
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
