import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '~/trpc/react';
import { Building2, Briefcase, Check, Calculator } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

export function RegisterPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<'CONTRACTOR' | 'PROPERTY_MANAGER' | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    additionalUsers: 0,
    additionalTenants: 0,
    additionalContractors: 0,
  });

  const packagesQuery = useQuery({
    ...trpc.getPackages.queryOptions({ token: 'public', type: accountType || undefined }),
    enabled: !!accountType,
  });
  const packages = packagesQuery.data;

  const registerMutation = useMutation(
    trpc.createPendingRegistration.mutationOptions({
      onSuccess: () => {
        alert(
          'Registration submitted successfully! You will be contacted once your account is approved.'
        );
        navigate({ to: '/' });
      },
      onError: (error) => {
        alert(`Registration failed: ${error.message}`);
      },
    })
  );

  const calculateTotal = () => {
    if (!selectedPackage) return 0;
    let total = selectedPackage.basePrice;
    total += formData.additionalUsers * selectedPackage.additionalUserPrice;
    if (accountType === 'PROPERTY_MANAGER') {
      total += formData.additionalTenants * (selectedPackage.additionalTenantPrice || 0);
      total += formData.additionalContractors * selectedPackage.additionalUserPrice;
    }
    return total;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountType || !selectedPackage) return;

    registerMutation.mutate({
      ...formData,
      accountType,
      packageId: selectedPackage.id,
    });
  };

  if (!accountType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Join Square 15 Management System
            </h1>
            <p className="text-xl text-gray-600">
              Choose your account type to get started
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contractor */}
            <button
              onClick={() => setAccountType('CONTRACTOR')}
              className="group relative bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 text-left border-4 border-transparent hover:border-cyan-500"
            >
              <div className="absolute top-8 right-8">
                <Briefcase className="h-16 w-16 text-cyan-600 group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Contractor
              </h2>
              <p className="text-gray-600 mb-6">
                Manage quotations, invoices, projects, and grow your contracting business
              </p>
              <ul className="space-y-2 mb-8">
                <li className="flex items-center text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Quotations & Invoicing
                </li>
                <li className="flex items-center text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Project Management
                </li>
                <li className="flex items-center text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  CRM & Lead Tracking
                </li>
                <li className="flex items-center text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  AI Assistant (S6 Package)
                </li>
              </ul>
              <div className="text-cyan-600 font-semibold group-hover:translate-x-2 transition-transform inline-flex items-center">
                Select Contractor
                <span className="ml-2">→</span>
              </div>
            </button>

            {/* Property Manager */}
            <button
              onClick={() => setAccountType('PROPERTY_MANAGER')}
              className="group relative bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 text-left border-4 border-transparent hover:border-green-500"
            >
              <div className="absolute top-8 right-8">
                <Building2 className="h-16 w-16 text-green-600 group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Property Manager
              </h2>
              <p className="text-gray-600 mb-6">
                Complete property management solution for tenants, maintenance, and financials
              </p>
              <ul className="space-y-2 mb-8">
                <li className="flex items-center text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Tenant Management
                </li>
                <li className="flex items-center text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Maintenance Requests
                </li>
                <li className="flex items-center text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Financial Reporting
                </li>
                <li className="flex items-center text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  AI Assistant (PM2 Package)
                </li>
              </ul>
              <div className="text-green-600 font-semibold group-hover:translate-x-2 transition-transform inline-flex items-center">
                Select Property Manager
                <span className="ml-2">→</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedPackage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 p-4 py-12">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setAccountType(null)}
            className="mb-8 text-cyan-600 hover:text-cyan-700 font-semibold"
          >
            ← Back to Account Type
          </button>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Choose Your Package
            </h1>
            <p className="text-xl text-gray-600">
              {accountType === 'CONTRACTOR' ? 'Select the features you need to grow your business' : 'Complete property management solutions'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages?.map((pkg) => (
              <div
                key={pkg.id}
                className={`bg-white rounded-xl shadow-lg p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                  pkg.trialDays > 0 ? 'border-4 border-yellow-400' : 'border-2 border-gray-200'
                }`}
                onClick={() => setSelectedPackage(pkg)}
              >
                {pkg.trialDays > 0 && (
                  <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
                    {pkg.trialDays}-DAY FREE TRIAL
                  </div>
                )}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {pkg.displayName}
                </h3>
                <div className="text-3xl font-bold text-cyan-600 mb-4">
                  R{pkg.basePrice}
                  <span className="text-sm text-gray-500 font-normal">/month</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">{pkg.description}</p>
                <ul className="space-y-2 mb-6 text-sm">
                  {pkg.hasQuotations && (
                    <li className="flex items-center text-gray-700">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      Quotations
                    </li>
                  )}
                  {pkg.hasInvoices && (
                    <li className="flex items-center text-gray-700">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      Invoices
                    </li>
                  )}
                  {pkg.hasOperations && (
                    <li className="flex items-center text-gray-700">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      Operations
                    </li>
                  )}
                  {pkg.hasCRM && (
                    <li className="flex items-center text-gray-700">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      CRM
                    </li>
                  )}
                  {pkg.hasProjectManagement && (
                    <li className="flex items-center text-gray-700">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      Projects
                    </li>
                  )}
                  {pkg.hasAIAgent && (
                    <li className="flex items-center text-gray-700">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      AI Agent
                    </li>
                  )}
                </ul>
                <button className="w-full bg-cyan-600 text-white font-semibold py-3 rounded-lg hover:bg-cyan-700 transition-colors">
                  Select {pkg.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setSelectedPackage(null)}
          className="mb-8 text-cyan-600 hover:text-cyan-700 font-semibold"
        >
          ← Back to Packages
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Complete Your Registration
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Package Summary */}
            <div className="bg-cyan-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Selected Package: {selectedPackage.displayName}
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Base Price:</span>
                  <span className="font-semibold">R{selectedPackage.basePrice}/month</span>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* User/Tenant Configuration */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="h-5 w-5 text-cyan-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Configure Your Subscription
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Users (R{selectedPackage.additionalUserPrice} each/month)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.additionalUsers}
                    onChange={(e) => setFormData({ ...formData, additionalUsers: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                  />
                </div>

                {accountType === 'PROPERTY_MANAGER' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Tenants (R{selectedPackage.additionalTenantPrice} each/month)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.additionalTenants}
                        onChange={(e) => setFormData({ ...formData, additionalTenants: parseInt(e.target.value) || 0 })}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Contractors (R{selectedPackage.additionalUserPrice} each/month)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.additionalContractors}
                        onChange={(e) => setFormData({ ...formData, additionalContractors: parseInt(e.target.value) || 0 })}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center text-2xl font-bold text-gray-900">
                  <span>Total Monthly Cost:</span>
                  <span className="text-cyan-600">R{calculateTotal()}</span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setSelectedPackage(null)}
                className="flex-1 py-3 px-6 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={registerMutation.isPending}
                className="flex-1 py-3 px-6 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition-colors disabled:bg-gray-400"
              >
                {registerMutation.isPending ? 'Submitting...' : 'Submit Registration'}
              </button>
            </div>
          </form>

          <p className="mt-6 text-sm text-gray-500 text-center">
            Your registration will be reviewed by our team. You'll receive an email once approved.
          </p>
        </div>
      </div>
    </div>
  );
}
