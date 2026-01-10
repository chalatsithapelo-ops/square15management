import { useState } from "react";
import { X, Eye, EyeOff, Copy, Check, Building2, User, Calendar, DollarSign, Zap, FileText } from "lucide-react";
import toast from "react-hot-toast";

interface AddTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddTenantFormData) => void;
  buildings: Array<{ id: number; name: string; address: string }>;
  isLoading?: boolean;
  credentials?: {
    email: string;
    password: string;
    loginUrl: string;
  } | null;
}

export interface AddTenantFormData {
  buildingId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  unitNumber?: string;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: number;
  securityDeposit: number;
  electricityMeterNumber?: string;
  waterMeterNumber?: string;
  gasMeterNumber?: string;
  notes?: string;
  autoGeneratePassword: boolean;
  customPassword?: string;
}

export function AddTenantModal({
  isOpen,
  onClose,
  onSubmit,
  buildings,
  isLoading = false,
  credentials = null,
}: AddTenantModalProps) {
  const [formData, setFormData] = useState<AddTenantFormData>({
    buildingId: 0,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    unitNumber: "",
    leaseStartDate: "",
    leaseEndDate: "",
    monthlyRent: 0,
    securityDeposit: 0,
    electricityMeterNumber: "",
    waterMeterNumber: "",
    gasMeterNumber: "",
    notes: "",
    autoGeneratePassword: true,
    customPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  // Debug: Log buildings when modal opens
  console.log("AddTenantModal - Buildings:", buildings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.buildingId) {
      toast.error("Please select a building");
      return;
    }
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      toast.error("Please fill in all required tenant information");
      return;
    }
    if (!formData.leaseStartDate || !formData.leaseEndDate) {
      toast.error("Please specify lease start and end dates");
      return;
    }
    if (formData.monthlyRent <= 0) {
      toast.error("Please specify a valid monthly rent amount");
      return;
    }
    if (!formData.autoGeneratePassword && !formData.customPassword) {
      toast.error("Please enter a custom password or enable auto-generate");
      return;
    }

    onSubmit(formData);
  };

  const handleCopyPassword = () => {
    if (credentials?.password) {
      navigator.clipboard.writeText(credentials.password);
      setPasswordCopied(true);
      toast.success("Password copied to clipboard!");
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const handleCopyAllCredentials = () => {
    if (credentials) {
      const text = `Tenant Portal Login Details
Email: ${credentials.email}
Password: ${credentials.password}
Login URL: ${credentials.loginUrl}

Please keep these credentials safe and change your password after first login.`;
      
      navigator.clipboard.writeText(text);
      toast.success("All credentials copied to clipboard!");
    }
  };

  const handleReset = () => {
    setFormData({
      buildingId: 0,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      unitNumber: "",
      leaseStartDate: "",
      leaseEndDate: "",
      monthlyRent: 0,
      securityDeposit: 0,
      electricityMeterNumber: "",
      waterMeterNumber: "",
      gasMeterNumber: "",
      notes: "",
      autoGeneratePassword: true,
      customPassword: "",
    });
    setShowCredentials(false);
    onClose();
  };

  if (!isOpen) return null;

  // Show credentials screen after successful creation
  if (credentials && showCredentials) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleReset} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Tenant Added Successfully!
              </h3>
              <p className="text-sm text-gray-600">
                Share these login credentials with your tenant
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <div className="text-sm font-mono text-gray-900">{credentials.email}</div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border border-gray-300">
                    {showPassword ? credentials.password : "••••••••••••"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 text-gray-600 hover:text-gray-900"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-2 text-gray-600 hover:text-gray-900"
                  >
                    {passwordCopied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Login URL</label>
                <div className="text-sm text-blue-600 break-all">{credentials.loginUrl}</div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCopyAllCredentials}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy All Credentials
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>Important:</strong> Make sure to save or share these credentials. 
                They cannot be recovered once you close this window.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5" />
              Add New Tenant
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Building Selection */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Property Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Building <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.buildingId}
                    onChange={(e) => setFormData({ ...formData, buildingId: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value={0}>
                      {buildings.length === 0 ? "No buildings available - Please add a building first" : "Select a building"}
                    </option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.name} - {building.address}
                      </option>
                    ))}
                  </select>
                  {buildings.length === 0 && (
                    <p className="mt-1 text-xs text-yellow-600">
                      You need to add buildings before you can add tenants. Please create a building first.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Number
                  </label>
                  <input
                    type="text"
                    value={formData.unitNumber}
                    onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 101, A12"
                  />
                </div>
              </div>
            </div>

            {/* Tenant Information */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Tenant Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Lease Details */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Lease Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lease Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.leaseStartDate}
                    onChange={(e) => setFormData({ ...formData, leaseStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lease End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.leaseEndDate}
                    onChange={(e) => setFormData({ ...formData, leaseEndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    Monthly Rent <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.monthlyRent || ""}
                    onChange={(e) => setFormData({ ...formData, monthlyRent: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Security Deposit
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.securityDeposit || ""}
                    onChange={(e) => setFormData({ ...formData, securityDeposit: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Utility Meters */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Utility Meters
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Electricity Meter
                  </label>
                  <input
                    type="text"
                    value={formData.electricityMeterNumber}
                    onChange={(e) => setFormData({ ...formData, electricityMeterNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Meter number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Water Meter
                  </label>
                  <input
                    type="text"
                    value={formData.waterMeterNumber}
                    onChange={(e) => setFormData({ ...formData, waterMeterNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Meter number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gas Meter
                  </label>
                  <input
                    type="text"
                    value={formData.gasMeterNumber}
                    onChange={(e) => setFormData({ ...formData, gasMeterNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Meter number"
                  />
                </div>
              </div>
            </div>

            {/* Account Credentials */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Portal Access
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoGenerate"
                    checked={formData.autoGeneratePassword}
                    onChange={(e) => setFormData({ ...formData, autoGeneratePassword: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="autoGenerate" className="text-sm text-gray-700">
                    Auto-generate secure password
                  </label>
                </div>
                
                {!formData.autoGeneratePassword && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.customPassword}
                      onChange={(e) => setFormData({ ...formData, customPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Minimum 6 characters"
                      minLength={6}
                      required={!formData.autoGeneratePassword}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Additional information about the tenant..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding Tenant...
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    Add Tenant
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
