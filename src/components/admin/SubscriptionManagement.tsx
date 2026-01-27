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

  const rosterQuery = useQuery({
    ...trpc.getSubscriptionRoster.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const forbiddenError =
    (rosterQuery.isError && (rosterQuery.error as any)?.data?.code === 'FORBIDDEN' && rosterQuery.error) ||
    (packagesQuery.isError && (packagesQuery.error as any)?.data?.code === 'FORBIDDEN' && packagesQuery.error);

  if (forbiddenError) {
    return <AccessDenied message={(forbiddenError as any)?.message || 'Access denied'} returnPath="/" />;
  }

  const firstNonForbiddenError =
    (rosterQuery.isError && rosterQuery.error) || (packagesQuery.isError && packagesQuery.error) || null;

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

      {selectedTab === 'subscriptions' && (
        <SubscriptionsTab roster={rosterQuery.data} packages={packagesQuery.data} />
      )}
      {selectedTab === 'packages' && <PackagesTab packages={packagesQuery.data} />}
    </div>
  );
}

function deriveExpectedPackageType(role: string | undefined): 'CONTRACTOR' | 'PROPERTY_MANAGER' | 'UNKNOWN' {
  if (!role) return 'UNKNOWN';
  if (role === 'PROPERTY_MANAGER') return 'PROPERTY_MANAGER';
  if (role.startsWith('CONTRACTOR')) return 'CONTRACTOR';
  return 'UNKNOWN';
}

function SubscriptionsTab({
  roster,
  packages,
}: {
  roster: any[] | undefined;
  packages: any[] | undefined;
}) {
  const trpc = useTRPC();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

  const invalidateSubscriptionQueries = async () => {
    if (!token) return;
    await queryClient.invalidateQueries({ queryKey: trpc.getSubscriptionRoster.queryKey({ token }) });
    await queryClient.invalidateQueries({ queryKey: trpc.getUserSubscription.queryKey({ token }) });
    await queryClient.invalidateQueries({ queryKey: trpc.getAllSubscriptions.queryKey({ token }) });
  };

  const activateMutation = useMutation(
    trpc.activateSubscription.mutationOptions({
      onSuccess: async () => {
        await invalidateSubscriptionQueries();
        alert('Subscription activated successfully');
      },
    })
  );

  const suspendMutation = useMutation(
    trpc.suspendSubscription.mutationOptions({
      onSuccess: async () => {
        await invalidateSubscriptionQueries();
        alert('Subscription suspended');
      },
    })
  );

  const createSubscriptionMutation = useMutation(
    trpc.createSubscription.mutationOptions({
      onSuccess: async () => {
        await invalidateSubscriptionQueries();
        alert('Subscription created successfully');
      },
    })
  );

  const updatePackageMutation = useMutation(
    trpc.updateSubscriptionPackage.mutationOptions({
      onSuccess: async () => {
        await invalidateSubscriptionQueries();
        alert('Subscription updated successfully');
      },
    })
  );

  const enriched = useMemo(() => {
    const list = (roster ?? []).map((row) => {
      const subscription = row.subscription ?? null;
      const expectedType = deriveExpectedPackageType(row.user?.role);
      const packageType = subscription?.package?.type ?? expectedType;
      const monthlyCharge = subscription ? computeMonthlyCharge(subscription) : 0;
      const amountDue = subscription ? computeAmountDue(subscription) : 0;

      return {
        ...row,
        __expectedPackageType: expectedType,
        __packageType: packageType ?? 'UNKNOWN',
        __monthlyCharge: monthlyCharge,
        __amountDue: amountDue,
        __status: subscription?.status ?? 'NONE',
      };
    });

    const q = search.trim().toLowerCase();
    const filtered = list.filter((r: any) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'NONE' ? !r.subscription : r.subscription?.status === statusFilter);

      if (!matchesStatus) return false;
      if (!q) return true;

      const email = String(r.user?.email ?? '').toLowerCase();
      const name = `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim().toLowerCase();
      return email.includes(q) || name.includes(q);
    });

    filtered.sort((a: any, b: any) => {
      const typeCmp = packageTypeSortKey(a.__packageType) - packageTypeSortKey(b.__packageType);
      if (typeCmp !== 0) return typeCmp;

      const pkgCmp = compareStrings(a.subscription?.package?.displayName ?? '', b.subscription?.package?.displayName ?? '');
      if (pkgCmp !== 0) return pkgCmp;

      return compareStrings(a.user?.email ?? '', b.user?.email ?? '');
    });

    return filtered;
  }, [roster, search, statusFilter]);

  const selected = useMemo(() => {
    if (selectedUserId == null) return null;
    return enriched.find((r: any) => r.user?.id === selectedUserId) ?? null;
  }, [enriched, selectedUserId]);

  const compatiblePackages = useMemo(() => {
    const expected = selected?.__expectedPackageType as 'CONTRACTOR' | 'PROPERTY_MANAGER' | 'UNKNOWN' | undefined;
    const all = packages ?? [];
    if (!expected || expected === 'UNKNOWN') return all;
    return all.filter((p: any) => p.type === expected);
  }, [packages, selected]);

  const summary = useMemo(() => {
    const withSubscription = enriched.filter((r: any) => !!r.subscription);
    const active = enriched.filter((r: any) => r.subscription?.status === 'ACTIVE' || r.subscription?.status === 'TRIAL');
    const totalDue = withSubscription.reduce((sum: number, r: any) => sum + (r.__amountDue ?? 0), 0);
    return {
      totalUsers: enriched.length,
      withSubscription: withSubscription.length,
      activeOrTrial: active.length,
      totalDue,
    };
  }, [enriched]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-gray-500">Users</div>
            <div className="text-lg font-semibold text-gray-900">{summary.totalUsers}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">With subscription</div>
            <div className="text-lg font-semibold text-gray-900">{summary.withSubscription}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Active/Trial</div>
            <div className="text-lg font-semibold text-gray-900">{summary.activeOrTrial}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Amount Due (now)</div>
            <div className="text-lg font-semibold text-gray-900">{formatMoneyZAR(summary.totalDue)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSelectedUserId(null);
            }}
            className="rounded-md border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm"
          >
            <option value="all">All</option>
            <option value="NONE">No subscription</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="w-full sm:w-80">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Users</div>
              <div className="text-xs text-gray-500">Includes users without subscriptions</div>
            </div>

            <div className="divide-y divide-gray-200">
              {enriched.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No users found</div>
              ) : (
                enriched.map((row: any) => {
                  const sub = row.subscription;
                  const isSelected = row.user?.id === selectedUserId;
                  return (
                    <button
                      key={row.user?.id}
                      onClick={() => {
                        setSelectedUserId(row.user?.id);
                        const currentPackageId = sub?.package?.id ?? sub?.packageId ?? null;
                        const expected = deriveExpectedPackageType(row.user?.role);
                        const options = (packages ?? []).filter((p: any) =>
                          expected === 'UNKNOWN' ? true : p.type === expected
                        );
                        setSelectedPackageId(currentPackageId ?? options[0]?.id ?? null);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${isSelected ? 'bg-cyan-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {row.user?.firstName} {row.user?.lastName}
                          </div>
                          <div className="text-sm text-gray-600 truncate">{row.user?.email}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {row.__packageType ?? 'UNKNOWN'} · {sub?.package?.displayName ?? 'No package'}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {sub ? (
                            <>
                              <div
                                className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                                  sub.status
                                )}`}
                              >
                                {sub.status}
                              </div>
                              <div className="mt-1 text-xs text-gray-700">Due: {formatMoneyZAR(row.__amountDue ?? 0)}</div>
                            </>
                          ) : (
                            <>
                              <div className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                                NONE
                              </div>
                              <div className="mt-1 text-xs text-gray-500">No subscription</div>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Details</div>
              <div className="text-xs text-gray-500">Select a user to manage their subscription</div>
            </div>

            {!selected ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">No user selected</div>
            ) : (
              <div className="px-4 py-4 space-y-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {selected.user?.firstName} {selected.user?.lastName}
                  </div>
                  <div className="text-sm text-gray-600">{selected.user?.email}</div>
                  <div className="mt-1 text-xs text-gray-500">Role: {selected.user?.role ?? 'Unknown'}</div>
                </div>

                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Current</div>
                  <div className="text-sm text-gray-900">
                    {selected.subscription
                      ? `${selected.subscription.package?.displayName ?? 'Unknown package'} (${selected.subscription.status})`
                      : 'No subscription'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Assign package</label>
                  <select
                    value={selectedPackageId ?? ''}
                    onChange={(e) => setSelectedPackageId(e.target.value ? Number(e.target.value) : null)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm"
                  >
                    {compatiblePackages.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.type} · {p.displayName} ({formatMoneyZAR(p.basePrice ?? 0)})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-gray-500">
                    If the user has no subscription, one will be created as ACTIVE/TRIAL based on the package.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!selected.subscription ? (
                    <button
                      onClick={() => {
                        if (!token) return;
                        if (!selectedPackageId) {
                          alert('Select a package first');
                          return;
                        }
                        createSubscriptionMutation.mutate({
                          token,
                          userId: selected.user.id,
                          packageId: selectedPackageId,
                          additionalUsers: 0,
                        });
                      }}
                      className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                      disabled={createSubscriptionMutation.isPending}
                    >
                      Create subscription
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!token) return;
                        if (!selectedPackageId) {
                          alert('Select a package first');
                          return;
                        }
                        updatePackageMutation.mutate({
                          token,
                          subscriptionId: selected.subscription.id,
                          packageId: selectedPackageId,
                        });
                      }}
                      className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                      disabled={updatePackageMutation.isPending}
                    >
                      Update package
                    </button>
                  )}

                  {selected.subscription && selected.subscription.status === 'SUSPENDED' && (
                    <button
                      onClick={() => {
                        if (!token) return;
                        activateMutation.mutate({ token, subscriptionId: selected.subscription.id });
                      }}
                      className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      disabled={activateMutation.isPending || suspendMutation.isPending}
                    >
                      Activate
                    </button>
                  )}

                  {selected.subscription && (selected.subscription.status === 'ACTIVE' || selected.subscription.status === 'TRIAL') && (
                    <button
                      onClick={() => {
                        if (!token) return;
                        const reason = prompt('Reason for suspension:');
                        if (reason) {
                          suspendMutation.mutate({ token, subscriptionId: selected.subscription.id, reason });
                        }
                      }}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
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
