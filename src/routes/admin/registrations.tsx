import { createFileRoute } from '@tanstack/react-router';
import { RegistrationManagement } from '~/components/admin/RegistrationManagement';

export const Route = createFileRoute('/admin/registrations')({
  component: () => (
    <div className="container mx-auto px-4 py-8">
      <RegistrationManagement />
    </div>
  ),
});
