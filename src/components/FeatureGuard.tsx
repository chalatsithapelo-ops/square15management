import { ReactNode, useEffect, useState } from 'react';
import { useTRPC } from '~/trpc/react';
import { useAuthStore } from '~/stores/auth';
import { Lock, AlertTriangle } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

interface FeatureGuardProps {
  children: ReactNode;
  feature?: 'Quotations' | 'Invoices' | 'Operations' | 'CRM' | 'ProjectManagement' | 'Assets' | 'HR' | 'Messages' | 'AIAgent' | 'AIInsights';
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

export function FeatureGuard({ children, feature, fallback, showUpgrade = true }: FeatureGuardProps) {
  const { token } = useAuthStore();
  const { data: subscription, isLoading } = useTRPC().getUserSubscription.useQuery({ token });
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!subscription) return;

    // Check if subscription is active
    const isActive = ['ACTIVE', 'TRIAL'].includes(subscription.status);
    if (!isActive) {
      setHasAccess(false);
      return;
    }

    // If no specific feature required, just check active subscription
    if (!feature) {
      setHasAccess(true);
      return;
    }

    // Check specific feature access
    const featureMap = {
      Quotations: subscription.package.hasQuotations,
      Invoices: subscription.package.hasInvoices,
      Operations: subscription.package.hasOperations,
      CRM: subscription.package.hasCRM,
      ProjectManagement: subscription.package.hasProjectManagement,
      Assets: subscription.package.hasAssets,
      HR: subscription.package.hasHR,
      Messages: subscription.package.hasMessages,
      AIAgent: subscription.package.hasAIAgent,
      AIInsights: subscription.package.hasAIInsights,
    };

    setHasAccess(featureMap[feature] || false);
  }, [subscription, feature]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Subscription</h2>
          <p className="text-gray-600">Please contact your administrator to activate your account.</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgrade) {
      return <UpgradePrompt feature={feature} currentPackage={subscription.package.name} />;
    }

    return null;
  }

  return <>{children}</>;
}

interface UpgradePromptProps {
  feature?: string;
  currentPackage: string;
}

function UpgradePrompt({ feature, currentPackage }: UpgradePromptProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center h-64">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Feature Locked</h2>
        <p className="text-gray-600 mb-4">
          {feature ? `${feature} is not available in your current package (${currentPackage}).` : 'This feature is not available in your current package.'}
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Upgrade to access this feature and unlock more capabilities for your business.
        </p>
        <button
          onClick={() => navigate({ to: '/settings/subscription' })}
          className="bg-cyan-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-cyan-700 transition-colors"
        >
          View Upgrade Options
        </button>
      </div>
    </div>
  );
}

export function SubscriptionBanner() {
  const { token } = useAuthStore();
  const { data: subscription } = useTRPC().getUserSubscription.useQuery({ token });

  if (!subscription) return null;

  const daysUntilExpiry = subscription.trialEndsAt
    ? Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  if (subscription.status === 'TRIAL' && daysUntilExpiry && daysUntilExpiry <= 7) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Your trial expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Contact your administrator to activate your subscription and continue using all features.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (subscription.status === 'SUSPENDED') {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Your subscription is suspended
            </p>
            <p className="text-sm text-red-700 mt-1">
              Please contact your administrator to resolve this issue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (subscription.status === 'EXPIRED') {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Your subscription has expired
            </p>
            <p className="text-sm text-red-700 mt-1">
              Contact your administrator to renew your subscription.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Hook for programmatic feature checks
export function useFeatureAccess(feature?: 'Quotations' | 'Invoices' | 'Operations' | 'CRM' | 'ProjectManagement' | 'Assets' | 'HR' | 'Messages' | 'AIAgent' | 'AIInsights') {
  const { token } = useAuthStore();
  const { data: subscription } = useTRPC().getUserSubscription.useQuery({ token });

  if (!subscription) return { hasAccess: false, subscription: null, isLoading: true };

  const isActive = ['ACTIVE', 'TRIAL'].includes(subscription.status);
  if (!isActive) return { hasAccess: false, subscription, isLoading: false };

  if (!feature) return { hasAccess: true, subscription, isLoading: false };

  const featureMap = {
    Quotations: subscription.package.hasQuotations,
    Invoices: subscription.package.hasInvoices,
    Operations: subscription.package.hasOperations,
    CRM: subscription.package.hasCRM,
    ProjectManagement: subscription.package.hasProjectManagement,
    Assets: subscription.package.hasAssets,
    HR: subscription.package.hasHR,
    Messages: subscription.package.hasMessages,
    AIAgent: subscription.package.hasAIAgent,
    AIInsights: subscription.package.hasAIInsights,
  };

  return {
    hasAccess: featureMap[feature] || false,
    subscription,
    isLoading: false,
  };
}
