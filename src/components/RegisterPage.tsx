import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '~/trpc/react';
import { Building2, Briefcase, Check, Calculator, CreditCard, QrCode, Landmark, Wallet, ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

export function RegisterPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<'CONTRACTOR' | 'PROPERTY_MANAGER' | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [registrationId, setRegistrationId] = useState<number | null>(null);
  const [paymentOptionSelected, setPaymentOptionSelected] = useState<
    | 'CARD'
    | 'S_PAY'
    | 'INSTANT_EFT'
    | 'SNAPSCAN'
    | 'ZAPPER'
    | 'MASTERPASS'
    | 'FNB_PAY'
    | null
  >(null);
  const [isRedirectingToPayfast, setIsRedirectingToPayfast] = useState(false);
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

  const paymentGatewayStatusQuery = useQuery({
    ...trpc.getPublicPaymentGatewayStatus.queryOptions(),
  });
  const payfastConfigured = paymentGatewayStatusQuery.data?.payfast.configured ?? true;

  const registerMutation = useMutation(
    trpc.createPendingRegistration.mutationOptions({
      onSuccess: (data) => {
        setRegistrationId(data.registrationId);
        setPaymentOptionSelected(null);
      },
      onError: (error) => {
        alert(`Registration failed: ${error.message}`);
      },
    })
  );

  const payfastCheckoutMutation = useMutation(
    trpc.createPendingRegistrationPayfastCheckout.mutationOptions({
      onSuccess: (data) => {
        // Auto-submit a POST form to PayFast.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.endpoint;

        Object.entries(data.fields).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      },
      onError: (error) => {
        setIsRedirectingToPayfast(false);
        const message =
          error.message.includes('PayFast is not configured') ||
          error.message.includes('PayFast is misconfigured')
            ? 'Payment is temporarily unavailable. Please try again later or contact support.'
            : error.message;
        alert(`Payment setup failed: ${message}`);
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

  const paymentOptions = useMemo(
    () => [
      {
        key: 'INSTANT_EFT' as const,
        label: 'Instant EFT',
        icon: Landmark,
        hint: 'Pay via bank login (FNB, ABSA, Standard Bank, Nedbank, Capitec, etc.)',
      },
      { key: 'CARD' as const, label: 'Card', icon: CreditCard, hint: 'Visa / Mastercard' },
      { key: 'S_PAY' as const, label: 'S Pay', icon: Wallet, hint: 'Bank wallet checkout (major banks)' },
      { key: 'SNAPSCAN' as const, label: 'SnapScan', icon: QrCode, hint: 'Scan & pay' },
      { key: 'ZAPPER' as const, label: 'Zapper', icon: QrCode, hint: 'Scan & pay' },
      { key: 'MASTERPASS' as const, label: 'Masterpass', icon: Wallet, hint: 'Wallet checkout' },
      { key: 'FNB_PAY' as const, label: 'FNB Pay', icon: Wallet, hint: 'FNB app payment (FNB customers)' },
    ],
    []
  );

  const startPayfastCheckout = (option: (typeof paymentOptions)[number]['key']) => {
    if (!registrationId) return;

    if (!payfastConfigured) {
      alert('Payment is temporarily unavailable. Please try again later or contact support.');
      return;
    }

    setPaymentOptionSelected(option);
    setIsRedirectingToPayfast(true);

    payfastCheckoutMutation.mutate({
      registrationId,
      paymentOption: option,
    });
  };

  // If a registration has been created, move user to payment selection UI.
  const isOnPaymentStep = registrationId != null;

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

  if (isOnPaymentStep) {
    type PaymentOptionKey = (typeof paymentOptions)[number]['key'];
    type PaymentStyle = {
      chip: string;
      icon: string;
      ring: string;
      border: string;
      hover: string;
      arrow: string;
      arrowHover: string;
      bar: string;
      label: string;
      labelHover: string;
      badge?: string;
      badgeText?: string;
    };

    const paymentStyleByKey: Record<PaymentOptionKey, PaymentStyle> = {
      CARD: {
        chip: 'bg-gradient-to-br from-blue-50 to-indigo-50',
        icon: 'text-indigo-700',
        ring: 'ring-indigo-500/30',
        border: 'border-indigo-200',
        hover: 'hover:border-indigo-300 hover:bg-indigo-50/40',
        arrow: 'text-indigo-500',
        arrowHover: 'group-hover:text-indigo-500',
        bar: 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-indigo-500',
        label: 'text-indigo-900',
        labelHover: 'group-hover:text-indigo-900',
      },
      S_PAY: {
        chip: 'bg-gradient-to-br from-emerald-50 to-teal-50',
        icon: 'text-emerald-700',
        ring: 'ring-emerald-500/30',
        border: 'border-emerald-200',
        hover: 'hover:border-emerald-300 hover:bg-emerald-50/40',
        arrow: 'text-emerald-500',
        arrowHover: 'group-hover:text-emerald-500',
        bar: 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-emerald-500',
        label: 'text-emerald-900',
        labelHover: 'group-hover:text-emerald-900',
      },
      INSTANT_EFT: {
        chip: 'bg-gradient-to-br from-sky-50 to-cyan-50',
        icon: 'text-cyan-700',
        ring: 'ring-cyan-500/30',
        border: 'border-cyan-200',
        hover: 'hover:border-cyan-300 hover:bg-cyan-50/40',
        arrow: 'text-cyan-500',
        arrowHover: 'group-hover:text-cyan-500',
        bar: 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-cyan-500',
        label: 'text-cyan-900',
        labelHover: 'group-hover:text-cyan-900',
        badge: 'bg-cyan-600 text-white',
        badgeText: 'Recommended',
      },
      SNAPSCAN: {
        chip: 'bg-gradient-to-br from-rose-50 to-red-50',
        icon: 'text-red-700',
        ring: 'ring-red-500/30',
        border: 'border-red-200',
        hover: 'hover:border-red-300 hover:bg-red-50/40',
        arrow: 'text-red-500',
        arrowHover: 'group-hover:text-red-500',
        bar: 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-red-500',
        label: 'text-red-900',
        labelHover: 'group-hover:text-red-900',
      },
      ZAPPER: {
        chip: 'bg-gradient-to-br from-emerald-50 to-lime-50',
        icon: 'text-emerald-700',
        ring: 'ring-emerald-500/30',
        border: 'border-emerald-200',
        hover: 'hover:border-emerald-300 hover:bg-emerald-50/40',
        arrow: 'text-emerald-500',
        arrowHover: 'group-hover:text-emerald-500',
        bar: 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-emerald-500',
        label: 'text-emerald-900',
        labelHover: 'group-hover:text-emerald-900',
      },
      MASTERPASS: {
        chip: 'bg-gradient-to-br from-orange-50 to-amber-50',
        icon: 'text-orange-700',
        ring: 'ring-orange-500/30',
        border: 'border-orange-200',
        hover: 'hover:border-orange-300 hover:bg-orange-50/40',
        arrow: 'text-orange-500',
        arrowHover: 'group-hover:text-orange-500',
        bar: 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-orange-500',
        label: 'text-orange-900',
        labelHover: 'group-hover:text-orange-900',
      },
      FNB_PAY: {
        chip: 'bg-gradient-to-br from-sky-50 to-blue-50',
        icon: 'text-sky-700',
        ring: 'ring-sky-500/30',
        border: 'border-sky-200',
        hover: 'hover:border-sky-300 hover:bg-sky-50/40',
        arrow: 'text-sky-500',
        arrowHover: 'group-hover:text-sky-500',
        bar: 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-sky-500',
        label: 'text-sky-900',
        labelHover: 'group-hover:text-sky-900',
      },
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 p-4 py-12">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => {
              // Allow user to exit payment step; registration remains pending.
              setRegistrationId(null);
              setPaymentOptionSelected(null);
              setIsRedirectingToPayfast(false);
            }}
            className="mb-6 inline-flex items-center gap-2 text-cyan-700 hover:text-cyan-800 font-semibold"
            disabled={isRedirectingToPayfast || payfastCheckoutMutation.isPending}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-6 border border-white/60">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose payment option</h1>
            <p className="text-sm text-gray-600 mb-6">
              Select a payment method to complete your registration payment.
            </p>

            <div className="mb-6 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/70 border border-orange-200 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-orange-700" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Secure checkout</div>
                  <div className="text-xs text-gray-600">
                    You’ll be redirected to PayFast to complete payment.
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {paymentOptions.map((opt) => {
                const Icon = opt.icon;
                const selected = paymentOptionSelected === opt.key;
                const style = paymentStyleByKey[opt.key];
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => startPayfastCheckout(opt.key)}
                    disabled={isRedirectingToPayfast || payfastCheckoutMutation.isPending}
                    className={`group relative overflow-hidden w-full rounded-2xl border px-5 py-4 flex items-center justify-between transition-all bg-white disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md ${
                      selected
                        ? `ring-2 ${style.ring} ${style.border} ${style.bar}`
                        : `border-gray-200 ${style.hover} ${style.bar}`
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center border ${style.chip} ${
                          selected ? style.border : 'border-gray-200'
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${style.icon} transition-transform group-hover:scale-110`}
                        />
                      </div>
                      <div className="text-left">
                        <div
                          className={`font-semibold ${
                            selected ? style.label : `text-gray-900 ${style.labelHover}`
                          }`}
                        >
                          {opt.label}
                        </div>
                        <div className="text-xs text-gray-500">{opt.hint}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {style.badgeText ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${style.badge}`}>
                          {style.badgeText}
                        </span>
                      ) : null}
                      <span
                        className={`text-gray-400 transition-colors ${selected ? style.arrow : style.arrowHover}`}
                      >
                        →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 text-xs text-gray-500">
              {isRedirectingToPayfast ? 'Redirecting to payment gateway…' : 'You can complete payment now, or come back later.'}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => navigate({ to: '/' })}
                className="flex-1 py-3 px-6 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                disabled={isRedirectingToPayfast || payfastCheckoutMutation.isPending}
              >
                Pay Later
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegistrationId(null);
                  setSelectedPackage(null);
                  setAccountType(null);
                  setFormData({
                    email: '',
                    firstName: '',
                    lastName: '',
                    phone: '',
                    companyName: '',
                    additionalUsers: 0,
                    additionalTenants: 0,
                    additionalContractors: 0,
                  });
                  navigate({ to: '/' });
                }}
                className="flex-1 py-3 px-6 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition-colors disabled:bg-gray-400"
                disabled={isRedirectingToPayfast || payfastCheckoutMutation.isPending}
              >
                Done
              </button>
            </div>
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
