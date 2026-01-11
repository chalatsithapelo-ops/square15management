import { createFileRoute } from '@tanstack/react-router';
import { useTRPC } from '~/trpc/react';
import { useAuthStore } from '~/stores/auth';
import { CreditCard, Package, Clock, Users, TrendingUp } from 'lucide-react';

export const Route = createFileRoute('/settings/subscription')({
  component: SubscriptionSettingsPage,
});

function SubscriptionSettingsPage() {
  const { token } = useAuthStore();
  const { data: subscription, isLoading } = useTRPC().getUserSubscription.useQuery({ token });
  const { data: packages } = useTRPC().getPackages.useQuery({ token });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <Package className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Subscription</h2>
          <p className="text-gray-600">
            Please contact your administrator to activate your subscription.
          </p>
        </div>
      </div>
    );
  }

  const statusColors = {
    TRIAL: 'bg-blue-100 text-blue-800',
    ACTIVE: 'bg-green-100 text-green-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
  };

  const suggestedPackages = packages?.filter(
    (pkg) =>
      pkg.type === subscription.package.type &&
      pkg.basePrice > subscription.package.basePrice
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Subscription Settings</h1>

      {/* Current Subscription */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {subscription.package.displayName}
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[subscription.status]}`}
            >
              {subscription.status}
            </span>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-cyan-600">
              R{subscription.package.basePrice}
            </div>
            <div className="text-sm text-gray-500">per month</div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-100 rounded-lg p-3">
              <Users className="h-6 w-6 text-cyan-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Users</div>
              <div className="text-lg font-semibold text-gray-900">
                {subscription.currentUsers} / {subscription.maxUsers}
              </div>
            </div>
          </div>

          {subscription.trialEndsAt && (
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 rounded-lg p-3">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Trial Ends</div>
                <div className="text-lg font-semibold text-gray-900">
                  {new Date(subscription.trialEndsAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="bg-green-100 rounded-lg p-3">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Next Billing</div>
              <div className="text-lg font-semibold text-gray-900">
                {new Date(subscription.nextBillingDate).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Included Features</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {subscription.package.hasQuotations && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> Quotations
              </div>
            )}
            {subscription.package.hasInvoices && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> Invoices
              </div>
            )}
            {subscription.package.hasOperations && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> Operations
              </div>
            )}
            {subscription.package.hasCRM && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> CRM
              </div>
            )}
            {subscription.package.hasProjectManagement && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> Project Management
              </div>
            )}
            {subscription.package.hasAssets && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> Assets
              </div>
            )}
            {subscription.package.hasHR && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> HR
              </div>
            )}
            {subscription.package.hasMessages && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> Messages
              </div>
            )}
            {subscription.package.hasAIAgent && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> AI Agent
              </div>
            )}
            {subscription.package.hasAIInsights && (
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2">✓</span> AI Insights
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Options */}
      {suggestedPackages && suggestedPackages.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-6 w-6 text-cyan-600" />
            <h2 className="text-2xl font-bold text-gray-900">Upgrade Your Package</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {suggestedPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-white rounded-xl shadow-lg p-6 border-2 border-cyan-200 hover:border-cyan-400 transition-colors"
              >
                {pkg.trialDays > 0 && (
                  <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
                    {pkg.trialDays}-DAY FREE TRIAL
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{pkg.displayName}</h3>
                <div className="text-3xl font-bold text-cyan-600 mb-4">
                  R{pkg.basePrice}
                  <span className="text-sm text-gray-500 font-normal">/month</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">{pkg.description}</p>
                
                <div className="mb-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2">
                    Additional Features:
                  </div>
                  <div className="space-y-1">
                    {pkg.hasAIAgent && !subscription.package.hasAIAgent && (
                      <div className="flex items-center text-sm text-green-600">
                        <span className="mr-2">+</span> AI Agent
                      </div>
                    )}
                    {pkg.hasAIInsights && !subscription.package.hasAIInsights && (
                      <div className="flex items-center text-sm text-green-600">
                        <span className="mr-2">+</span> AI Insights
                      </div>
                    )}
                    {pkg.hasProjectManagement && !subscription.package.hasProjectManagement && (
                      <div className="flex items-center text-sm text-green-600">
                        <span className="mr-2">+</span> Project Management
                      </div>
                    )}
                  </div>
                </div>

                <button className="w-full bg-cyan-600 text-white font-semibold py-3 rounded-lg hover:bg-cyan-700 transition-colors">
                  Contact Administrator to Upgrade
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      {subscription.payments && subscription.payments.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment History</h2>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscription.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      R{payment.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {payment.method}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          payment.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
