import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionManagement } from '~/components/admin/SubscriptionManagement';

export const Route = createFileRoute('/admin/registrations')({
  component: () => (
    <div className="container mx-auto px-4 py-8">
      <SubscriptionManagement initialTab="pending" />
    </div>
  ),
});
