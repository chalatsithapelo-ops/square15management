import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useLocation } from "@tanstack/react-router";
import {
  Search,
  Filter,
  Edit,
  Mail,
  Phone,
  DollarSign,
  Clock,
  Calendar,
  X,
  Eye,
  EyeOff,
  Trash2,
  CalendarCheck,
  Users,
} from "lucide-react";
import { Dialog } from "@headlessui/react";
import { Link } from "@tanstack/react-router";
import {
  getRoleLabel,
  getRoleColor,
  ROLES,
} from "~/utils/roles";

const employeeUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  phone: z.string().optional(),
  role: z.string().min(1, "Role is required"),
  hourlyRate: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
  dailyRate: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
  monthlySalary: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
  monthlyPaymentDay: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().min(1, "Payment day must be between 1 and 31").max(31, "Payment day must be between 1 and 31").optional()),
});

type EmployeeUpdateForm = z.infer<typeof employeeUpdateSchema>;

const employeeCreateSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  role: z.string().min(1, "Role is required"),
  customRole: z.string().optional(),
  hourlyRate: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
  dailyRate: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
  monthlySalary: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
  monthlyPaymentDay: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().min(1, "Payment day must be between 1 and 31").max(31, "Payment day must be between 1 and 31").optional()),
});

type EmployeeCreateForm = z.infer<typeof employeeCreateSchema>;

export function EmployeesTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCustomRole, setShowCustomRole] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    employee: any | null;
  }>({ isOpen: false, employee: null });

  // Detect which portal we're in
  const isContractorPortal = location.pathname.startsWith('/contractor');
  const basePath = isContractorPortal ? '/contractor' : '/admin';

  const currentUserQuery = useQuery(
    trpc.getCurrentUser.queryOptions({
      token: token!,
    })
  );

  const userPermissionsQuery = useQuery(
    trpc.getUserPermissions.queryOptions({
      token: token!,
    })
  );

  const distinctRolesQuery = useQuery(
    trpc.getDistinctRoles.queryOptions({
      token: token!,
    })
  );

  const roleConfigQuery = useQuery({
    ...trpc.getRolePermissionConfig.queryOptions({
      token: token!,
    }),
    enabled: !!token,
  });

  const employeesQuery = useQuery(
    trpc.getEmployees.queryOptions({
      token: token!,
      role: roleFilter as any,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EmployeeUpdateForm>({
    resolver: zodResolver(employeeUpdateSchema),
  });

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: errorsCreate },
    reset: resetCreate,
  } = useForm<EmployeeCreateForm>({
    resolver: zodResolver(employeeCreateSchema),
  });

  const updateEmployeeMutation = useMutation(
    trpc.updateEmployeeDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Employee updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getEmployees.queryKey() });
        setEditingEmployee(null);
        reset();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update employee");
      },
    })
  );

  const createEmployeeMutation = useMutation(
    trpc.createEmployee.mutationOptions({
      onSuccess: () => {
        toast.success("Employee created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getEmployees.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getDistinctRoles.queryKey() });
        setShowAddForm(false);
        resetCreate();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create employee");
      },
    })
  );

  const deleteEmployeeMutation = useMutation(
    trpc.deleteEmployee.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message || "Employee deleted successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getEmployees.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getDistinctRoles.queryKey() });
        setDeleteConfirmation({ isOpen: false, employee: null });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete employee");
      },
    })
  );

  const employees = employeesQuery.data || [];
  const distinctRoles = distinctRolesQuery.data || [];
  const currentUser = currentUserQuery.data;
  const userPermissions = userPermissionsQuery.data?.permissions || [];
  const canDeleteEmployees = userPermissions.includes("DELETE_EMPLOYEES");
  
  const filteredEmployees = employees.filter((emp) =>
    `${emp.firstName} ${emp.lastName} ${emp.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Show loading state
  if (employeesQuery.isLoading || distinctRolesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading employees...</p>
        </div>
      </div>
    );
  }

  const handleEditClick = (employee: any) => {
    setEditingEmployee(employee);
    setShowPassword(false);
    reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      password: "",
      phone: employee.phone || "",
      role: employee.role,
      hourlyRate: employee.hourlyRate || undefined,
      dailyRate: employee.dailyRate || undefined,
      monthlySalary: employee.monthlySalary || undefined,
      monthlyPaymentDay: employee.monthlyPaymentDay || undefined,
    });
  };

  const handleDeleteClick = (employee: any) => {
    setDeleteConfirmation({ isOpen: true, employee });
  };

  const confirmDelete = () => {
    if (!deleteConfirmation.employee) return;
    
    deleteEmployeeMutation.mutate({
      token: token!,
      employeeId: deleteConfirmation.employee.id,
    });
  };

  const onSubmit = (data: EmployeeUpdateForm) => {
    if (!editingEmployee) return;
    
    updateEmployeeMutation.mutate({
      token: token!,
      employeeId: editingEmployee.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email && data.email.trim() !== "" ? data.email : undefined,
      password: data.password && data.password.trim() !== "" ? data.password : undefined,
      phone: data.phone,
      role: data.role,
      hourlyRate: data.hourlyRate,
      dailyRate: data.dailyRate,
      monthlySalary: data.monthlySalary,
      monthlyPaymentDay: data.monthlyPaymentDay,
    });
  };

  const onSubmitCreate = (data: EmployeeCreateForm) => {
    // Use custom role if "OTHER" is selected and customRole is provided
    const finalRole = data.role === "OTHER" && data.customRole 
      ? data.customRole 
      : data.role;
    
    createEmployeeMutation.mutate({
      token: token!,
      ...data,
      role: finalRole,
    });
  };

  // Dynamically calculate role statistics from actual employee data
  // For contractor portal, show predefined contractor-relevant roles
  const contractorRelevantRoles = [
    'ARTISAN',
    'CONTRACTOR_JUNIOR_MANAGER',
    'CONTRACTOR_SENIOR_MANAGER',
    'SALES_AGENT',
    'MANAGER',
    'TECHNICAL_MANAGER',
    'ACCOUNTANT'
  ];

  const rolesToDisplay = isContractorPortal 
    ? contractorRelevantRoles 
    : (distinctRoles.length > 0 ? distinctRoles : contractorRelevantRoles);

  const roleStats = rolesToDisplay.map(role => ({
    role,
    count: employees.filter(e => e.role === role).length,
  }));

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roleStats.map((stat) => (
          <button
            key={stat.role}
            onClick={() => setRoleFilter(roleFilter === stat.role ? null : stat.role)}
            className={`p-4 rounded-xl border-2 transition-all ${
              roleFilter === stat.role
                ? "border-purple-600 bg-purple-50"
                : "border-gray-200 bg-white hover:border-purple-300"
            }`}
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">{stat.count}</div>
              <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${getRoleColor(stat.role)}`}>
                {getRoleLabel(stat.role)}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employees..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={() => setRoleFilter(null)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Filter className="h-5 w-5 mr-2" />
            {roleFilter ? "Clear Filter" : "All Employees"}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Employee
          </button>
        </div>
      </div>

      {/* Employees List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {employees.length === 0 ? 'No employees yet' : 'No employees found'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {employees.length === 0 
                  ? 'Get started by adding your first employee'
                  : 'Try adjusting your search or filters'}
              </p>
              {employees.length === 0 && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add First Employee
                </button>
              )}
            </div>
          ) : (
            filteredEmployees.map((employee) => (
              <Link
              key={employee.id}
              to="/admin/hr/employees/$employeeId"
              params={{ employeeId: employee.id.toString() }}
              className="block p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-purple-600 transition-colors">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(employee.role)}`}>
                      {getRoleLabel(employee.role)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      {employee.email}
                    </div>
                    {employee.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {employee.phone}
                      </div>
                    )}
                    {employee.hourlyRate && (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        R{employee.hourlyRate}/hour
                      </div>
                    )}
                    {employee.dailyRate && (
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        R{employee.dailyRate}/day
                      </div>
                    )}
                    {employee.monthlySalary && (
                      <div className="flex items-center">
                        <CalendarCheck className="h-4 w-4 mr-2 text-gray-400" />
                        R{employee.monthlySalary}/month
                        {employee.monthlyPaymentDay && ` (paid on day ${employee.monthlyPaymentDay})`}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Joined {new Date(employee.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="ml-4 flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleEditClick(employee);
                    }}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  {canDeleteEmployees && currentUser && employee.id !== currentUser.id && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteClick(employee);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete employee"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </Link>
            ))
          )}
        </div>
      </div>

      {/* Edit Employee Modal */}
      <Dialog
        open={editingEmployee !== null}
        onClose={() => setEditingEmployee(null)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Edit Employee
              </Dialog.Title>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    {...register("firstName")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    {...register("lastName")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    {...register("email")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                    <span className="text-xs text-gray-500 ml-2">(leave blank to keep current)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      {...register("password")}
                      placeholder="Enter new password (optional)"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    {...register("phone")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    {...register("role")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {roleConfigQuery.data?.allRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleConfigQuery.data.roleMetadata[role]?.label || role}
                      </option>
                    ))}
                  </select>
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly Rate (R)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("hourlyRate", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Rate (R)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("dailyRate", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Salary (R)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("monthlySalary", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Payment Day
                    <span className="text-xs text-gray-500 ml-2">(1-31)</span>
                  </label>
                  <select
                    {...register("monthlyPaymentDay", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  {errors.monthlyPaymentDay && (
                    <p className="mt-1 text-sm text-red-600">{errors.monthlyPaymentDay.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateEmployeeMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateEmployeeMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Add Employee Modal */}
      <Dialog
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Add New Employee
              </Dialog.Title>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate(onSubmitCreate)} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    {...registerCreate("email")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errorsCreate.email && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.email.message}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    {...registerCreate("password")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errorsCreate.password && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    {...registerCreate("firstName")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errorsCreate.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    {...registerCreate("lastName")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {errorsCreate.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.lastName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    {...registerCreate("phone")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    {...registerCreate("role")}
                    onChange={(e) => setShowCustomRole(e.target.value === "OTHER")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select a role</option>
                    <option value="ARTISAN">Artisan</option>
                    <option value="CONTRACTOR_JUNIOR_MANAGER">Junior Manager</option>
                    <option value="CONTRACTOR_SENIOR_MANAGER">Senior Manager</option>
                    <option value="SALES_AGENT">Sales Agent</option>
                    <option value="MANAGER">Manager</option>
                    <option value="TECHNICAL_MANAGER">Technical Manager</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="OTHER">Other (Specify)</option>
                  </select>
                  {errorsCreate.role && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.role.message}</p>
                  )}
                </div>

                {showCustomRole && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Role Name *
                    </label>
                    <input
                      type="text"
                      {...registerCreate("customRole")}
                      placeholder="e.g., PROJECT_COORDINATOR"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Permissions for custom roles can be managed in Settings
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly Rate (R)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...registerCreate("hourlyRate", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Rate (R)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...registerCreate("dailyRate", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Salary (R)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...registerCreate("monthlySalary", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Payment Day
                    <span className="text-xs text-gray-500 ml-2">(1-31)</span>
                  </label>
                  <select
                    {...registerCreate("monthlyPaymentDay", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  {errorsCreate.monthlyPaymentDay && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.monthlyPaymentDay.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-4 -mx-6 px-6 pb-6 flex-shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createEmployeeMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {createEmployeeMutation.isPending ? "Creating..." : "Create Employee"}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, employee: null })}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-xl shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              
              <Dialog.Title className="text-lg font-semibold text-gray-900 text-center mb-2">
                Delete Employee
              </Dialog.Title>
              
              <p className="text-sm text-gray-600 text-center mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold">
                  {deleteConfirmation.employee?.firstName} {deleteConfirmation.employee?.lastName}
                </span>
                ? This action cannot be undone.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                <p className="text-xs text-yellow-800">
                  <strong>Warning:</strong> This employee can only be deleted if they have no associated records (orders, leads, projects, etc.). If deletion fails, you'll need to reassign their records first.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation({ isOpen: false, employee: null })}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleteEmployeeMutation.isPending}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {deleteEmployeeMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
