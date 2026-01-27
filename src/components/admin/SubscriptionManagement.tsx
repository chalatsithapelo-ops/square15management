import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Package, Users } from 'lucide-react';
import { AccessDenied } from '~/components/AccessDenied';
import { useAuthStore } from '~/stores/auth';
import { useTRPC } from '~/trpc/react';

type PackagePricingUpdate = {
  basePrice: number;
  additionalUserPrice: number;
  additionalTenantPrice?: number;
};

type SubscriptionManagementTab = 'packages' | 'subscriptions';

function formatMoneyZAR(amount: number) {
  return `R${amount.toFixed(2)}`;
}

function compareStrings(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function packageTypeSortKey(type: string) {
  if (type === 'CONTRACTOR') return 0;
  if (type === 'PROPERTY_MANAGER') return 1;
  return 2;
}

function computeMonthlyCharge(subscription: any) {
  const pkg = subscription?.package;
  if (!pkg) return 0;
  return (
    (pkg.basePrice ?? 0) +
    (subscription.additionalUsers ?? 0) * (pkg.additionalUserPrice ?? 0) +
    (subscription.additionalTenants ?? 0) * (pkg.additionalTenantPrice ?? 0)
  );
}

function computeAmountDue(subscription: any) {
  const monthlyCharge = computeMonthlyCharge(subscription);
  const now = Date.now();
  const isInTrial = !!subscription?.trialEndsAt && new Date(subscription.trialEndsAt).getTime() > now;
  const nextBillingDate = subscription?.nextBillingDate ? new Date(subscription.nextBillingDate).getTime() : null;

  const isBillingDue =
    !isInTrial &&
    (subscription?.isPaymentOverdue || (nextBillingDate != null ? nextBillingDate <= now : false));

  if (!isBillingDue) return 0;
  return monthlyCharge;
}

function getStatusBadge(status: string) {
  const styles = {
    TRIAL: 'bg-blue-100 text-blue-800',
    ACTIVE: 'bg-green-100 text-green-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-yellow-100 text-yellow-800',
  };
  return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
}

export function SubscriptionManagement({
  initialTab = 'subscriptions',
}: {
  initialTab?: SubscriptionManagementTab;
}) {
  const trpc = useTRPC();
  const { token } = useAuthStore();
  const [selectedTab, setSelectedTab] = useState<SubscriptionManagementTab>(initialTab);

  const packagesQuery = useQuery({
    ...trpc.getPackages.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const subscriptionsQuery = useQuery({
    ...trpc.getAllSubscriptions.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const forbiddenError =
    (subscriptionsQuery.isError && (subscriptionsQuery.error as any)?.data?.code === 'FORBIDDEN' && subscriptionsQuery.error) ||
    (packagesQuery.isError && (packagesQuery.error as any)?.data?.code === 'FORBIDDEN' && packagesQuery.error);

  if (forbiddenError) {
    return <AccessDenied message={(forbiddenError as any)?.message || 'Access denied'} returnPath="/" />;
  }

  const firstNonForbiddenError =
    (subscriptionsQuery.isError && subscriptionsQuery.error) || (packagesQuery.isError && packagesQuery.error) || null;

  if (firstNonForbiddenError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-6 text-left">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <div className="text-sm font-semibold text-red-900">Failed to load subscriptions/packages</div>
              <div className="mt-1 text-sm text-red-800">
                {(firstNonForbiddenError as any)?.message ?? 'Unknown error'}
              </div>
              <div className="mt-2 text-xs text-red-700">Check server logs for the full error details.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
    { id: 'subscriptions', label: 'Subscriptions', icon: Users },
    { id: 'packages', label: 'Package Management', icon: Package },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subscription Management</h1>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as SubscriptionManagementTab)}
              className={`group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium ${
                selectedTab === tab.id
                  ? 'border-cyan-500 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <tab.icon
                className={`-ml-0.5 mr-2 h-5 w-5 ${
                  selectedTab === tab.id ? 'text-cyan-500' : 'text-gray-400 group-hover:text-gray-500'
                }`}
              />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {selectedTab === 'subscriptions' && <SubscriptionsTab subscriptions={subscriptionsQuery.data} />}
      {selectedTab === 'packages' && <PackagesTab packages={packagesQuery.data} />}
    </div>
  );
}

function SubscriptionsTab({ subscriptions }: { subscriptions: any[] | undefined }) {
  const trpc = useTRPC();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);

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

  const enriched = useMemo(() => {
    const list = (subscriptions ?? []).map((s) => {
      const monthlyCharge = computeMonthlyCharge(s);
      const amountDue = computeAmountDue(s);
      return {
        ...s,
        __monthlyCharge: monthlyCharge,
        __amountDue: amountDue,
        __packageType: s.package?.type ?? 'UNKNOWN',
      };
    });

    const filtered = list.filter((s) => statusFilter === 'all' || s.status === statusFilter);

    filtered.sort((a: any, b: any) => {
      const typeCmp = packageTypeSortKey(a.__packageType) - packageTypeSortKey(b.__packageType);
      if (typeCmp !== 0) return typeCmp;

      const pkgCmp = compareStrings(a.package?.displayName ?? '', b.package?.displayName ?? '');
      if (pkgCmp !== 0) return pkgCmp;

      const areaCmp = compareStrings(a.user?.email ?? '', b.user?.email ?? '');
      if (areaCmp !== 0) return areaCmp;

      return compareStrings(`${a.user?.lastName ?? ''} ${a.user?.firstName ?? ''}`, `${b.user?.lastName ?? ''} ${b.user?.firstName ?? ''}`);
    });

    return filtered;
  }, [subscriptions, statusFilter]);

  const selected =
    selectedSubscriptionId != null ? enriched.find((s: any) => s.id === selectedSubscriptionId) ?? null : null;

  const summary = useMemo(() => {
    const active = enriched.filter((s: any) => s.status === 'ACTIVE' || s.status === 'TRIAL');
    const totalMrr = active.reduce((sum: number, s: any) => sum + (s.__monthlyCharge ?? 0), 0);
    const totalDue = enriched.reduce((sum: number, s: any) => sum + (s.__amountDue ?? 0), 0);
    return { totalMrr, totalDue, activeCount: active.length, totalCount: enriched.length };
  }, [enriched]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-gray-500">Subscriptions</div>
            <div className="text-lg font-semibold text-gray-900">{summary.totalCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Active/Trial</div>
            <div className="text-lg font-semibold text-gray-900">{summary.activeCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Estimated MRR</div>
            <div className="text-lg font-semibold text-gray-900">{formatMoneyZAR(summary.totalMrr)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Amount Due (now)</div>
            <div className="text-lg font-semibold text-gray-900">{formatMoneyZAR(summary.totalDue)}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setSelectedSubscriptionId(null);
          }}
          className="rounded-md border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm"
        >
          <option value="all">All</option>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Subscriptions</div>
              <div className="text-xs text-gray-500">Sorted by type, package, and area</div>
            </div>

            <div className="divide-y divide-gray-200">
              {enriched.map((sub: any) => {
                const isSelected = sub.id === selectedSubscriptionId;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubscriptionId(sub.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${isSelected ? 'bg-cyan-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {sub.user?.firstName} {sub.user?.lastName}
                        </div>
                        <div className="text-sm text-gray-600 truncate">{sub.user?.email}</div>
                        <div className="text-xs text-gray-500 truncate">
                              {sub.package?.type ?? 'UNKNOWN'} . {sub.package?.displayName ?? 'Unknown package'}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(sub.status)}`}>
                          {sub.status}
                        </div>
                        <div className="mt-1 text-xs text-gray-700">Due: {formatMoneyZAR(sub.__amountDue ?? 0)}</div>
                        {sub.nextBillingDate && (
                          <div className="text-xs text-gray-500">
                            Next: {new Date(sub.nextBillingDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {!enriched.length && (
                <div className="text-center py-12 text-gray-500">No subscriptions found</div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Details</div>
              <div className="text-xs text-gray-500">Select a subscription to manage it</div>
            </div>

            {!selected ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">No subscription selected</div>
            ) : (
              <div className="px-4 py-4 space-y-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {selected.user?.firstName} {selected.user?.lastName}
                  </div>
                  <div className="text-sm text-gray-600">{selected.user?.email}</div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium">{selected.package?.type ?? 'UNKNOWN'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Package</span>
                    <span className="font-medium">{selected.package?.displayName ?? 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Monthly Charge</span>
                    <span className="font-medium">{formatMoneyZAR(selected.__monthlyCharge ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Amount Due</span>
                    <span className="font-medium">{formatMoneyZAR(selected.__amountDue ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Users</span>
                    <span className="font-medium">{selected.currentUsers} / {selected.maxUsers}</span>
                  </div>
                  {selected.trialEndsAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Trial Ends</span>
                      <span className="font-medium">{new Date(selected.trialEndsAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selected.nextBillingDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Next Billing</span>
                      <span className="font-medium">{new Date(selected.nextBillingDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {selected.status === 'SUSPENDED' && (
                    <button
                      onClick={() => activateMutation.mutate({ token: token!, subscriptionId: selected.id })}
                      className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                      disabled={activateMutation.isPending || suspendMutation.isPending}
                    >
                      Activate
                    </button>
                  )}
                  {(selected.status === 'ACTIVE' || selected.status === 'TRIAL') && (
                    <button
                      onClick={() => {
                        const reason = prompt('Reason for suspension:');
                        if (reason) {
                          suspendMutation.mutate({ token: token!, subscriptionId: selected.id, reason });
                        }
                      }}
                      className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      disabled={activateMutation.isPending || suspendMutation.isPending}
                    >
                      Suspend
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
