import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '~/trpc/react';
import { useAuthStore } from '~/stores/auth';
import { Package, Users, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

type PackagePricingUpdate = {
  basePrice: number;
  additionalUserPrice: number;
  additionalTenantPrice?: number;
};

export function SubscriptionManagement() {
  const trpc = useTRPC();
  const { token } = useAuthStore();
  const [selectedTab, setSelectedTab] = useState<'packages' | 'subscriptions' | 'pending'>('subscriptions');

  const packagesQuery = useQuery({
    ...trpc.getPackages.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const subscriptionsQuery = useQuery({
    ...trpc.getAllSubscriptions.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const pendingRegsQuery = useQuery({
    ...trpc.getPendingRegistrations.queryOptions({ token: token!, isApproved: false }),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Not authenticated</h3>
          <p className="mt-1 text-sm text-gray-500">Please log in to view subscriptions.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'subscriptions', label: 'Active Subscriptions', icon: Users },
    { id: 'pending', label: 'Pending Registrations', icon: Clock, count: pendingRegsQuery.data?.length || 0 },
    { id: 'packages', label: 'Package Management', icon: Package },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subscription Management</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`
                group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium
                ${
                  selectedTab === tab.id
                    ? 'border-cyan-500 text-cyan-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }
              `}
            >
              <tab.icon
                className={`
                  -ml-0.5 mr-2 h-5 w-5
                  ${selectedTab === tab.id ? 'text-cyan-500' : 'text-gray-400 group-hover:text-gray-500'}
                `}
              />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {selectedTab === 'subscriptions' && <SubscriptionsTab subscriptions={subscriptionsQuery.data} />}
      {selectedTab === 'pending' && <PendingRegistrationsTab registrations={pendingRegsQuery.data} />}
      {selectedTab === 'packages' && <PackagesTab packages={packagesQuery.data} />}
    </div>
  );
}

function SubscriptionsTab({ subscriptions }: { subscriptions: any[] | undefined }) {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredSubs = subscriptions?.filter((sub) => 
    statusFilter === 'all' || sub.status === statusFilter
  );

  const getStatusBadge = (status: string) => {
    const styles = {
      TRIAL: 'bg-blue-100 text-blue-800',
      ACTIVE: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-yellow-100 text-yellow-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm"
        >
          <option value="all">All</option>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSubs?.map((sub) => (
          <SubscriptionCard key={sub.id} subscription={sub} />
        ))}
      </div>

      {!filteredSubs?.length && (
        <div className="text-center py-12 text-gray-500">
          No subscriptions found
        </div>
      )}
    </div>
  );
}

function SubscriptionCard({ subscription }: { subscription: any }) {
  const trpc = useTRPC();
  const { token } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  const activateMutation = useMutation(
    trpc.activateSubscription.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getAllSubscriptions.queryKey({ token: token! }),
        });
        alert('Subscription activated successfully');
      },
    })
  );

  const suspendMutation = useMutation(
    trpc.suspendSubscription.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getAllSubscriptions.queryKey({ token: token! }),
        });
        alert('Subscription suspended');
      },
    })
  );

  const getStatusBadge = (status: string) => {
    const styles = {
      TRIAL: 'bg-blue-100 text-blue-800',
      ACTIVE: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-yellow-100 text-yellow-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {subscription.user.firstName} {subscription.user.lastName}
          </h3>
          <p className="text-sm text-gray-500">{subscription.user.email}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(subscription.status)}`}>
          {subscription.status}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Package:</span>
          <span className="font-medium">{subscription.package.displayName}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Price:</span>
          <span className="font-medium">R{subscription.package.basePrice}/month</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Users:</span>
          <span className="font-medium">{subscription.currentUsers} / {subscription.maxUsers}</span>
        </div>
        {subscription.trialEndsAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Trial Ends:</span>
            <span className="font-medium">{new Date(subscription.trialEndsAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {subscription.status === 'SUSPENDED' && (
          <button
            onClick={() => activateMutation.mutate({ token: token!, subscriptionId: subscription.id })}
            className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Activate
          </button>
        )}
        {(subscription.status === 'ACTIVE' || subscription.status === 'TRIAL') && (
          <button
            onClick={() => {
              const reason = prompt('Reason for suspension:');
              if (reason) {
                suspendMutation.mutate({ token: token!, subscriptionId: subscription.id, reason });
              }
            }}
            className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Suspend
          </button>
        )}
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex-1 rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function PendingRegistrationsTab({ registrations }: { registrations: any[] | undefined }) {
  const trpc = useTRPC();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const approveMutation = useMutation(
    trpc.approvePendingRegistration.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getPendingRegistrations.queryKey({ token: token!, isApproved: false }),
        });
        alert('Registration approved successfully');
      },
    })
  );

  const rejectMutation = useMutation(
    trpc.rejectPendingRegistration.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getPendingRegistrations.queryKey({ token: token!, isApproved: false }),
        });
        alert('Registration rejected');
      },
    })
  );

  const markPaidMutation = useMutation(
    trpc.markRegistrationAsPaid.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getPendingRegistrations.queryKey({ token: token!, isApproved: false }),
        });
        alert('Marked as paid');
      },
    })
  );

  const handleApprove = (regId: number) => {
    const password = prompt('Set initial password for user (min 6 characters):');
    if (password && password.length >= 6) {
      const skipPayment = confirm('Skip payment verification? (Only if manually confirmed)');
      approveMutation.mutate({
        token: token!,
        registrationId: regId,
        password,
        skipPaymentCheck: skipPayment,
      });
    }
  };

  const handleReject = (regId: number) => {
    const reason = prompt('Reason for rejection:');
    if (reason) {
      rejectMutation.mutate({
        token: token!,
        registrationId: regId,
        reason,
      });
    }
  };

  const handleMarkPaid = (regId: number) => {
    const paymentId = prompt('Enter payment reference/ID:');
    if (paymentId) {
      markPaidMutation.mutate({
        token: token!,
        registrationId: regId,
        paymentId,
      });
    }
  };

  return (
    <div className="space-y-4">
      {registrations?.map((reg) => (
        <div key={reg.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {reg.firstName} {reg.lastName}
              </h3>
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">Email: {reg.email}</p>
                <p className="text-gray-600">Phone: {reg.phone}</p>
                {reg.companyName && <p className="text-gray-600">Company: {reg.companyName}</p>}
                <p className="text-gray-600">Type: {reg.accountType}</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Subscription Details</h4>
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">Package: {reg.package?.displayName}</p>
                <p className="text-gray-600">Base Price: R{reg.package?.basePrice}/month</p>
                {reg.additionalUsers > 0 && (
                  <p className="text-gray-600">Additional Users: {reg.additionalUsers} (R{reg.additionalUsers * (reg.package?.additionalUserPrice || 0)})</p>
                )}
                {reg.additionalTenants > 0 && (
                  <p className="text-gray-600">Additional Tenants: {reg.additionalTenants} (R{reg.additionalTenants * (reg.package?.additionalTenantPrice || 0)})</p>
                )}
                <p className="text-gray-600 font-semibold">
                  Total: R{reg.package?.basePrice + 
                    (reg.additionalUsers * (reg.package?.additionalUserPrice || 0)) +
                    (reg.additionalTenants * (reg.package?.additionalTenantPrice || 0))}/month
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              {reg.hasPaid ? (
                <span className="inline-flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Payment Received
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm text-red-600">
                  <XCircle className="h-4 w-4" />
                  Payment Pending
                </span>
              )}
            </div>
            <div className="flex-1"></div>
            <div className="flex gap-2">
              {!reg.hasPaid && (
                <button
                  onClick={() => handleMarkPaid(reg.id)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Mark as Paid
                </button>
              )}
              <button
                onClick={() => handleApprove(reg.id)}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(reg.id)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}

      {!registrations?.length && (
        <div className="text-center py-12 text-gray-500">
          No pending registrations
        </div>
      )}
    </div>
  );
}

function PackagesTab({ packages }: { packages: any[] | undefined }) {
  const trpc = useTRPC();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const [editingPackage, setEditingPackage] = useState<any>(null);

  const updatePricingMutation = useMutation(
    trpc.updatePackagePricing.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getPackages.queryKey({ token: token! }),
        });
        setEditingPackage(null);
        alert('Pricing updated successfully');
      },
    })
  );

  const contractorPackages = packages?.filter((p) => p.type === 'CONTRACTOR');
  const pmPackages = packages?.filter((p) => p.type === 'PROPERTY_MANAGER');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Contractor Packages</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contractorPackages?.map((pkg) => (
            <PackageCard
              key={pkg.id}
              package={pkg}
              onEdit={setEditingPackage}
              onSave={(data: PackagePricingUpdate) => {
                updatePricingMutation.mutate({
                  token: token!,
                  packageId: pkg.id,
                  ...data,
                });
              }}
              isEditing={editingPackage?.id === pkg.id}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Property Manager Packages</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {pmPackages?.map((pkg) => (
            <PackageCard
              key={pkg.id}
              package={pkg}
              onEdit={setEditingPackage}
              onSave={(data: PackagePricingUpdate) => {
                updatePricingMutation.mutate({
                  token: token!,
                  packageId: pkg.id,
                  ...data,
                });
              }}
              isEditing={editingPackage?.id === pkg.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PackageCard({ package: pkg, onEdit, onSave, isEditing }: any) {
  const [basePrice, setBasePrice] = useState(pkg.basePrice);
  const [additionalUserPrice, setAdditionalUserPrice] = useState(pkg.additionalUserPrice);
  const [additionalTenantPrice, setAdditionalTenantPrice] = useState(pkg.additionalTenantPrice || 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{pkg.displayName}</h3>
          <p className="text-sm text-gray-500">{pkg.name}</p>
        </div>
        {pkg.trialDays > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
            {pkg.trialDays}-day trial
          </span>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Base Price (R/month)</label>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Additional User Price (R/month)</label>
            <input
              type="number"
              value={additionalUserPrice}
              onChange={(e) => setAdditionalUserPrice(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm"
            />
          </div>
          {pkg.type === 'PROPERTY_MANAGER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Additional Tenant Price (R/month)</label>
              <input
                type="number"
                value={additionalTenantPrice}
                onChange={(e) => setAdditionalTenantPrice(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Base Price:</span>
            <span className="font-medium">R{pkg.basePrice}/month</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Additional User:</span>
            <span className="font-medium">R{pkg.additionalUserPrice}/month</span>
          </div>
          {pkg.type === 'PROPERTY_MANAGER' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Additional Tenant:</span>
              <span className="font-medium">R{pkg.additionalTenantPrice}/month</span>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700">Features:</p>
        {pkg.hasQuotations && <p>✓ Quotations</p>}
        {pkg.hasInvoices && <p>✓ Invoices</p>}
        {pkg.hasStatements && <p>✓ Statements</p>}
        {pkg.hasOperations && <p>✓ Operations</p>}
        {pkg.hasPayments && <p>✓ Payments</p>}
        {pkg.hasCRM && <p>✓ CRM</p>}
        {pkg.hasProjectManagement && <p>✓ Project Management</p>}
        {pkg.hasAssets && <p>✓ Assets</p>}
        {pkg.hasHR && <p>✓ HR</p>}
        {pkg.hasMessages && <p>✓ Messages</p>}
        {pkg.hasAIAgent && <p>✓ AI Agent</p>}
        {pkg.hasAIInsights && <p>✓ AI Insights</p>}
      </div>

      {isEditing ? (
        <div className="flex gap-2">
          <button
            onClick={() => onSave({ basePrice, additionalUserPrice, additionalTenantPrice: pkg.type === 'PROPERTY_MANAGER' ? additionalTenantPrice : undefined })}
            className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Save
          </button>
          <button
            onClick={() => onEdit(null)}
            className="flex-1 rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => onEdit(pkg)}
          className="w-full rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
        >
          Edit Pricing
        </button>
      )}
    </div>
  );
}
