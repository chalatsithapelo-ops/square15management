import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionManagement } from '~/components/admin/SubscriptionManagement';

export const Route = createFileRoute('/admin/subscriptions')({
  component: SubscriptionManagementPage,
});

function SubscriptionManagementPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <SubscriptionManagement />
    </div>
  );
}
