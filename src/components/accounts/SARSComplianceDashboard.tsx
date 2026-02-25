import { useState, useMemo } from 'react';
import {
  FileText, DollarSign, TrendingUp, AlertTriangle,
  Download, Calendar, CheckCircle2, Clock, ArrowRight,
  Building2, Users, Calculator, Shield, BarChart3
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

// ============================================
// SARS Tax Tables (2025/2026)
// ============================================
const TAX_BRACKETS = [
  { min: 0, max: 237100, rate: 18, baseAmount: 0 },
  { min: 237101, max: 370500, rate: 26, baseAmount: 42678 },
  { min: 370501, max: 512800, rate: 31, baseAmount: 77362 },
  { min: 512801, max: 673000, rate: 36, baseAmount: 121475 },
  { min: 673001, max: 857900, rate: 39, baseAmount: 179147 },
  { min: 857901, max: 1817000, rate: 41, baseAmount: 251258 },
  { min: 1817001, max: Infinity, rate: 45, baseAmount: 644489 },
];

const TAX_REBATES = { primary: 17235, secondary: 9444, tertiary: 3145 };
const COMPANY_TAX_RATE = 27;
const VAT_RATE = 15;
const UIF_EMPLOYEE_RATE = 1;
const UIF_EMPLOYER_RATE = 1;
const UIF_MAX_MONTHLY = 17712;
const SDL_RATE = 1;
const SDL_THRESHOLD = 500000;

const SARS_DEDUCTION_SECTIONS: Record<string, string> = {
  'S11a_GENERAL': 'S11(a) General deductions',
  'S11d_REPAIRS': 'S11(d) Repairs & maintenance',
  'S11e_DEPRECIATION': 'S11(e) Wear & tear',
  'S11f_RENT': 'S11(f) Lease premiums',
  'S23H_PREPAID': 'S23H Prepaid expenses',
};

const WEAR_AND_TEAR_RATES: Record<string, { rate: number; life: number; desc: string }> = {
  MOTOR_VEHICLES: { rate: 25, life: 4, desc: 'Motor vehicles' },
  OFFICE_FURNITURE: { rate: 16.67, life: 6, desc: 'Office furniture' },
  COMPUTER_EQUIPMENT: { rate: 33.33, life: 3, desc: 'Computer equipment' },
  MACHINERY: { rate: 20, life: 5, desc: 'Machinery & equipment' },
  TOOLS: { rate: 33.33, life: 3, desc: 'Small tools' },
  SECURITY_EQUIPMENT: { rate: 20, life: 5, desc: 'Security equipment' },
  BUILDING_IMPROVEMENTS: { rate: 5, life: 20, desc: 'Building improvements' },
};

interface SARSComplianceDashboardProps {
  invoices: any[];
  orders: any[];
  paymentRequests: any[];
  payslips: any[];
  operationalExpenses: any[];
  alternativeRevenues: any[];
  assets: any[];
  liabilities: any[];
  dateRange: { start: Date; end: Date };
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  materialCosts: number;
  labourCosts: number;
  artisanPayments: number;
}

export default function SARSComplianceDashboard({
  invoices = [],
  orders = [],
  paymentRequests = [],
  payslips = [],
  operationalExpenses = [],
  alternativeRevenues = [],
  assets = [],
  liabilities = [],
  dateRange,
  totalRevenue = 0,
  totalExpenses = 0,
  netProfit = 0,
  materialCosts = 0,
  labourCosts = 0,
  artisanPayments = 0,
}: SARSComplianceDashboardProps) {
  const [sarsTab, setSarsTab] = useState<'vat' | 'emp201' | 'it14' | 'provisional' | 'depreciation'>('vat');

  // ============================================
  // VAT Calculations
  // ============================================
  const vatData = useMemo(() => {
    // Output VAT (on sales/invoices)
    const outputVat = invoices
      .filter((inv: any) => inv.status === 'PAID' || inv.status === 'SENT')
      .reduce((sum: number, inv: any) => sum + (inv.tax || (inv.total || 0) * VAT_RATE / (100 + VAT_RATE)), 0);

    // Output VAT from alternative revenue
    const altRevenueOutputVat = alternativeRevenues
      .filter((r: any) => r.supplyType !== 'EXEMPT')
      .reduce((sum: number, r: any) => {
        const rate = r.vatRate || (r.supplyType === 'ZERO_RATED' ? 0 : VAT_RATE);
        return sum + (r.outputVatAmount || (r.amount * rate / (100 + rate)));
      }, 0);

    // Input VAT (on purchases/expenses)
    const expenseInputVat = operationalExpenses.reduce((sum: number, exp: any) => {
      if (exp.supplyType === 'EXEMPT') return sum;
      const rate = exp.vatRate || (exp.supplyType === 'ZERO_RATED' ? 0 : VAT_RATE);
      return sum + (exp.inputVatAmount || (exp.amount * rate / (100 + rate)));
    }, 0);

    // Input VAT from materials in orders
    const materialInputVat = (materialCosts * VAT_RATE) / (100 + VAT_RATE);
    
    const totalOutputVat = outputVat + altRevenueOutputVat;
    const totalInputVat = expenseInputVat + materialInputVat;
    const vatPayable = totalOutputVat - totalInputVat;

    // Categorize by supply type
    const standardRated = invoices
      .filter((inv: any) => inv.status === 'PAID' || inv.status === 'SENT')
      .reduce((sum: number, inv: any) => sum + ((inv.total || 0) - (inv.tax || 0)), 0);
    
    const zeroRated = alternativeRevenues
      .filter((r: any) => r.supplyType === 'ZERO_RATED')
      .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    
    const exempt = alternativeRevenues
      .filter((r: any) => r.supplyType === 'EXEMPT')
      .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    return {
      outputVat: Math.round(totalOutputVat * 100) / 100,
      inputVat: Math.round(totalInputVat * 100) / 100,
      vatPayable: Math.round(vatPayable * 100) / 100,
      standardRated: Math.round(standardRated * 100) / 100,
      zeroRated: Math.round(zeroRated * 100) / 100,
      exempt: Math.round(exempt * 100) / 100,
      invoiceCount: invoices.filter((inv: any) => inv.status === 'PAID' || inv.status === 'SENT').length,
      expenseCount: operationalExpenses.length,
    };
  }, [invoices, alternativeRevenues, operationalExpenses, materialCosts]);

  // ============================================
  // EMP201 Calculations
  // ============================================
  const emp201Data = useMemo(() => {
    const monthlyPayroll = payslips.reduce((sum: number, p: any) => sum + (p.grossPay || 0), 0);
    const totalPAYE = payslips.reduce((sum: number, p: any) => sum + (p.incomeTax || 0), 0);
    const totalEmployeeUIF = payslips.reduce((sum: number, p: any) => sum + (p.uif || 0), 0);
    const totalEmployerUIF = payslips.reduce((sum: number, p: any) => sum + (p.employerUIF || p.uif || 0), 0);
    const totalUIF = totalEmployeeUIF + totalEmployerUIF;
    
    const annualPayroll = monthlyPayroll * 12;
    const sdlApplicable = annualPayroll > SDL_THRESHOLD;
    const totalSDL = sdlApplicable ? Math.round(monthlyPayroll * SDL_RATE / 100 * 100) / 100 : 0;
    
    const totalLiability = totalPAYE + totalUIF + totalSDL;

    return {
      monthlyPayroll: Math.round(monthlyPayroll * 100) / 100,
      totalPAYE: Math.round(totalPAYE * 100) / 100,
      totalEmployeeUIF: Math.round(totalEmployeeUIF * 100) / 100,
      totalEmployerUIF: Math.round(totalEmployerUIF * 100) / 100,
      totalUIF: Math.round(totalUIF * 100) / 100,
      sdlApplicable,
      totalSDL,
      totalLiability: Math.round(totalLiability * 100) / 100,
      employeeCount: payslips.length,
    };
  }, [payslips]);

  // ============================================
  // IT14 Income Tax Calculations
  // ============================================
  const it14Data = useMemo(() => {
    const taxableIncome = netProfit;
    const companyTax = Math.max(0, Math.round(taxableIncome * COMPANY_TAX_RATE / 100 * 100) / 100);
    
    // Revenue classification
    const invoiceRevenue = invoices
      .filter((inv: any) => inv.status === 'PAID')
      .reduce((sum: number, inv: any) => sum + ((inv.total || 0) - (inv.tax || 0)), 0);
    
    const rentalIncome = alternativeRevenues
      .filter((r: any) => r.category === 'RENTAL')
      .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    
    const interestIncome = alternativeRevenues
      .filter((r: any) => r.category === 'INTEREST')
      .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    
    const otherIncome = alternativeRevenues
      .filter((r: any) => !['RENTAL', 'INTEREST'].includes(r.category))
      .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    // Expense deductions by S11 category
    const expensesBySection: Record<string, number> = {};
    operationalExpenses.forEach((exp: any) => {
      const section = exp.sarsDeductionSection || 'S11a_GENERAL';
      expensesBySection[section] = (expensesBySection[section] || 0) + (exp.amount || 0);
    });

    // Depreciation (S11(e))
    const totalDepreciation = assets.reduce((sum: number, asset: any) => {
      if (!asset.usefulLifeYears || !asset.purchasePrice) return sum;
      const annual = ((asset.purchasePrice || 0) - (asset.residualValue || 0)) / (asset.usefulLifeYears || 5);
      return sum + annual;
    }, 0);
    expensesBySection['S11e_DEPRECIATION'] = (expensesBySection['S11e_DEPRECIATION'] || 0) + totalDepreciation;

    return {
      grossIncome: Math.round(totalRevenue * 100) / 100,
      invoiceRevenue: Math.round(invoiceRevenue * 100) / 100,
      rentalIncome: Math.round(rentalIncome * 100) / 100,
      interestIncome: Math.round(interestIncome * 100) / 100,
      otherIncome: Math.round(otherIncome * 100) / 100,
      totalDeductions: Math.round(totalExpenses * 100) / 100,
      expensesBySection,
      totalDepreciation: Math.round(totalDepreciation * 100) / 100,
      taxableIncome: Math.round(taxableIncome * 100) / 100,
      companyTax,
      effectiveRate: totalRevenue > 0 ? Math.round((companyTax / totalRevenue) * 10000) / 100 : 0,
    };
  }, [invoices, alternativeRevenues, operationalExpenses, assets, totalRevenue, totalExpenses, netProfit]);

  // ============================================
  // Provisional Tax
  // ============================================
  const provisionalData = useMemo(() => {
    const annualizedProfit = netProfit * (12 / Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (30 * 24 * 60 * 60 * 1000))));
    const estimatedTax = Math.max(0, annualizedProfit * COMPANY_TAX_RATE / 100);
    const firstPayment = estimatedTax * 0.5;
    const secondPayment = estimatedTax * 0.5;

    return {
      annualizedProfit: Math.round(annualizedProfit * 100) / 100,
      estimatedTax: Math.round(estimatedTax * 100) / 100,
      firstPayment: Math.round(firstPayment * 100) / 100,
      secondPayment: Math.round(secondPayment * 100) / 100,
    };
  }, [netProfit, dateRange]);

  // ============================================
  // Depreciation Schedule
  // ============================================
  const depreciationData = useMemo(() => {
    return assets
      .filter((a: any) => a.purchasePrice > 0)
      .map((asset: any) => {
        const cost = asset.purchasePrice || 0;
        const residual = asset.residualValue || 0;
        const usefulLife = asset.usefulLifeYears || 5;
        const rate = asset.sarsWearAndTearRate || (100 / usefulLife);
        const annualDepr = (cost - residual) / usefulLife;
        const monthlyDepr = annualDepr / 12;
        const accumulated = asset.accumulatedDepreciation || 0;
        const bookValue = cost - accumulated;

        return {
          id: asset.id,
          name: asset.name,
          category: asset.category,
          purchaseDate: asset.purchaseDate,
          cost,
          residual,
          usefulLife,
          rate: Math.round(rate * 100) / 100,
          method: asset.depreciationMethod || 'STRAIGHT_LINE',
          annualDepr: Math.round(annualDepr * 100) / 100,
          monthlyDepr: Math.round(monthlyDepr * 100) / 100,
          accumulated: Math.round(accumulated * 100) / 100,
          bookValue: Math.round(Math.max(residual, bookValue) * 100) / 100,
        };
      });
  }, [assets]);

  const totalAnnualDepreciation = depreciationData.reduce((sum: number, a: any) => sum + a.annualDepr, 0);
  const totalBookValue = depreciationData.reduce((sum: number, a: any) => sum + a.bookValue, 0);

  const fmt = (n: number) => `R ${(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* SARS Compliance Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-green-600" />
          <h2 className="text-lg font-bold text-green-800">SARS Compliance Dashboard</h2>
        </div>
        <p className="text-sm text-green-700">
          Tax calculations based on SARS 2025/2026 rates. Period: {format(dateRange.start, 'dd MMM yyyy')} - {format(dateRange.end, 'dd MMM yyyy')}
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2">
        {[
          { id: 'vat' as const, label: 'VAT201', icon: FileText, color: 'blue' },
          { id: 'emp201' as const, label: 'EMP201', icon: Users, color: 'purple' },
          { id: 'it14' as const, label: 'IT14 Income Tax', icon: Building2, color: 'orange' },
          { id: 'provisional' as const, label: 'Provisional Tax', icon: Calculator, color: 'red' },
          { id: 'depreciation' as const, label: 'Depreciation (S11e)', icon: BarChart3, color: 'teal' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSarsTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              sarsTab === tab.id
                ? `bg-${tab.color}-100 text-${tab.color}-700 ring-2 ring-${tab.color}-400`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===================== VAT201 ===================== */}
      {sarsTab === 'vat' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">VAT201 Return Summary</h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Standard Rate: {VAT_RATE}%</span>
            </div>

            {/* VAT Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Output VAT (Sales)</p>
                <p className="text-2xl font-bold text-green-800">{fmt(vatData.outputVat)}</p>
                <p className="text-xs text-green-500 mt-1">{vatData.invoiceCount} invoices</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium">Input VAT (Purchases)</p>
                <p className="text-2xl font-bold text-red-800">{fmt(vatData.inputVat)}</p>
                <p className="text-xs text-red-500 mt-1">{vatData.expenseCount} expense items</p>
              </div>
              <div className={`${vatData.vatPayable >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
                <p className={`text-sm font-medium ${vatData.vatPayable >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                  {vatData.vatPayable >= 0 ? 'VAT Payable to SARS' : 'VAT Refund from SARS'}
                </p>
                <p className={`text-2xl font-bold ${vatData.vatPayable >= 0 ? 'text-amber-800' : 'text-blue-800'}`}>
                  {fmt(Math.abs(vatData.vatPayable))}
                </p>
                <p className="text-xs text-gray-500 mt-1">Output - Input VAT</p>
              </div>
            </div>

            {/* VAT201 Boxes */}
            <div className="border rounded-lg divide-y">
              <div className="p-3 bg-gray-50 text-sm font-medium text-gray-700">VAT201 Box Details</div>
              {[
                { box: '1', label: 'Standard rated supplies (15%)', value: vatData.standardRated },
                { box: '1A', label: 'Output tax on Box 1', value: vatData.outputVat },
                { box: '2', label: 'Zero-rated supplies (0%)', value: vatData.zeroRated },
                { box: '3', label: 'Exempt supplies', value: vatData.exempt },
                { box: '14', label: 'Standard rated purchases', value: materialCosts + operationalExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0) },
                { box: '14A', label: 'Input tax on Box 14', value: vatData.inputVat },
                { box: '19', label: 'Total VAT payable / (refundable)', value: vatData.vatPayable },
              ].map((row) => (
                <div key={row.box} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-100 text-blue-700 text-xs font-mono w-8 h-8 flex items-center justify-center rounded">{row.box}</span>
                    <span className="text-gray-700">{row.label}</span>
                  </div>
                  <span className={`font-medium ${row.value < 0 ? 'text-blue-600' : 'text-gray-900'}`}>{fmt(row.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== EMP201 ===================== */}
      {sarsTab === 'emp201' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">EMP201 Monthly Return</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{emp201Data.employeeCount} employees</span>
            </div>

            {/* EMP201 Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-600 font-medium">Total PAYE</p>
                <p className="text-xl font-bold text-purple-800">{fmt(emp201Data.totalPAYE)}</p>
                <p className="text-xs text-purple-500 mt-1">Income tax withheld</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Total UIF</p>
                <p className="text-xl font-bold text-blue-800">{fmt(emp201Data.totalUIF)}</p>
                <p className="text-xs text-blue-500 mt-1">Employee ({UIF_EMPLOYEE_RATE}%) + Employer ({UIF_EMPLOYER_RATE}%)</p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-sm text-teal-600 font-medium">SDL</p>
                <p className="text-xl font-bold text-teal-800">{fmt(emp201Data.totalSDL)}</p>
                <p className="text-xs text-teal-500 mt-1">{emp201Data.sdlApplicable ? `${SDL_RATE}% of payroll` : `Below R${SDL_THRESHOLD.toLocaleString()} threshold`}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium">Total EMP201 Liability</p>
                <p className="text-xl font-bold text-red-800">{fmt(emp201Data.totalLiability)}</p>
                <p className="text-xs text-red-500 mt-1">PAYE + UIF + SDL</p>
              </div>
            </div>

            {/* EMP201 Breakdown Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">Component</th>
                    <th className="text-right p-3 font-medium text-gray-600">Rate</th>
                    <th className="text-right p-3 font-medium text-gray-600">Base</th>
                    <th className="text-right p-3 font-medium text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-3 text-gray-700">PAYE (Employees' Tax)</td>
                    <td className="p-3 text-right text-gray-500">18%-45% brackets</td>
                    <td className="p-3 text-right text-gray-700">{fmt(emp201Data.monthlyPayroll)}</td>
                    <td className="p-3 text-right font-medium">{fmt(emp201Data.totalPAYE)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-gray-700">UIF - Employee portion</td>
                    <td className="p-3 text-right text-gray-500">{UIF_EMPLOYEE_RATE}% (max R{UIF_MAX_MONTHLY.toLocaleString()}/m)</td>
                    <td className="p-3 text-right text-gray-700">{fmt(emp201Data.monthlyPayroll)}</td>
                    <td className="p-3 text-right font-medium">{fmt(emp201Data.totalEmployeeUIF)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-gray-700">UIF - Employer portion</td>
                    <td className="p-3 text-right text-gray-500">{UIF_EMPLOYER_RATE}%</td>
                    <td className="p-3 text-right text-gray-700">{fmt(emp201Data.monthlyPayroll)}</td>
                    <td className="p-3 text-right font-medium">{fmt(emp201Data.totalEmployerUIF)}</td>
                  </tr>
                  <tr className={emp201Data.sdlApplicable ? '' : 'opacity-50'}>
                    <td className="p-3 text-gray-700">SDL (Skills Development Levy)</td>
                    <td className="p-3 text-right text-gray-500">{SDL_RATE}% {!emp201Data.sdlApplicable && '(N/A)'}</td>
                    <td className="p-3 text-right text-gray-700">{fmt(emp201Data.monthlyPayroll)}</td>
                    <td className="p-3 text-right font-medium">{fmt(emp201Data.totalSDL)}</td>
                  </tr>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="p-3 text-gray-900" colSpan={3}>Total EMP201 Payment Due</td>
                    <td className="p-3 text-right text-red-700">{fmt(emp201Data.totalLiability)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SARS Tax Brackets Reference */}
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">SARS 2025/2026 Personal Income Tax Brackets</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {TAX_BRACKETS.map((b, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-gray-600">
                      R{b.min.toLocaleString()} – {b.max === Infinity ? '∞' : `R${b.max.toLocaleString()}`}
                    </span>
                    <span className="font-medium text-gray-800">{b.rate}%</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Primary rebate: R{TAX_REBATES.primary.toLocaleString()} | 
                Secondary (65+): R{TAX_REBATES.secondary.toLocaleString()} | 
                Tertiary (75+): R{TAX_REBATES.tertiary.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================== IT14 ===================== */}
      {sarsTab === 'it14' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">IT14 Company Income Tax</h3>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Company Tax: {COMPANY_TAX_RATE}%</span>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Gross Income</p>
                <p className="text-2xl font-bold text-green-800">{fmt(it14Data.grossIncome)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium">Total Deductions</p>
                <p className="text-2xl font-bold text-red-800">{fmt(it14Data.totalDeductions)}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium">Estimated Tax</p>
                <p className="text-2xl font-bold text-orange-800">{fmt(it14Data.companyTax)}</p>
                <p className="text-xs text-orange-500 mt-1">Effective rate: {it14Data.effectiveRate}%</p>
              </div>
            </div>

            {/* IT14 Income Schedule */}
            <div className="border rounded-lg divide-y">
              <div className="p-3 bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Income Schedule (Source Codes)
              </div>
              {[
                { code: '4001', label: 'Local Sales & Services', value: it14Data.invoiceRevenue },
                { code: '4007', label: 'Rental Income', value: it14Data.rentalIncome },
                { code: '4012', label: 'Interest Received', value: it14Data.interestIncome },
                { code: '4026', label: 'Other Income', value: it14Data.otherIncome },
              ].filter(r => r.value > 0).map((row) => (
                <div key={row.code} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="bg-green-100 text-green-700 text-xs font-mono px-2 py-1 rounded">{row.code}</span>
                    <span className="text-gray-700">{row.label}</span>
                  </div>
                  <span className="font-medium text-gray-900">{fmt(row.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-green-50 font-semibold text-sm">
                <span className="text-green-800">Total Gross Income</span>
                <span className="text-green-800">{fmt(it14Data.grossIncome)}</span>
              </div>
            </div>

            {/* Deductions by S11 Section */}
            <div className="border rounded-lg divide-y">
              <div className="p-3 bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Deductions by Section
              </div>
              {Object.entries(it14Data.expensesBySection)
                .filter(([_, v]) => v > 0)
                .sort(([_, a], [__, b]) => b - a)
                .map(([section, amount]) => (
                <div key={section} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="bg-red-100 text-red-700 text-xs font-mono px-2 py-1 rounded">{section.split('_')[0]}</span>
                    <span className="text-gray-700">{SARS_DEDUCTION_SECTIONS[section] || section}</span>
                  </div>
                  <span className="font-medium text-red-700">({fmt(amount)})</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="bg-red-100 text-red-700 text-xs font-mono px-2 py-1 rounded">Other</span>
                  <span className="text-gray-700">Materials, labour & artisan payments</span>
                </div>
                <span className="font-medium text-red-700">({fmt(materialCosts + labourCosts + artisanPayments)})</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 font-semibold text-sm">
                <span className="text-red-800">Total Deductions</span>
                <span className="text-red-800">({fmt(it14Data.totalDeductions)})</span>
              </div>
            </div>

            {/* Tax Computation */}
            <div className="border rounded-lg divide-y">
              <div className="p-3 bg-gray-50 text-sm font-medium text-gray-700">Tax Computation</div>
              <div className="flex justify-between p-3 text-sm">
                <span>Gross Income</span>
                <span className="font-medium">{fmt(it14Data.grossIncome)}</span>
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span>Less: Allowable Deductions</span>
                <span className="font-medium text-red-600">({fmt(it14Data.totalDeductions)})</span>
              </div>
              <div className="flex justify-between p-3 text-sm bg-yellow-50 font-semibold">
                <span>Taxable Income</span>
                <span>{fmt(it14Data.taxableIncome)}</span>
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span>Tax @ {COMPANY_TAX_RATE}%</span>
                <span className="font-medium text-orange-700">{fmt(it14Data.companyTax)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== Provisional Tax ===================== */}
      {sarsTab === 'provisional' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Provisional Tax (IRP6)</h3>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h4 className="font-medium text-amber-800">Estimated Annual Taxable Income</h4>
              </div>
              <p className="text-3xl font-bold text-amber-900">{fmt(provisionalData.annualizedProfit)}</p>
              <p className="text-sm text-amber-600 mt-1">Based on current period annualized</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-800">1st Payment (Aug)</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{fmt(provisionalData.firstPayment)}</p>
                <p className="text-xs text-gray-500 mt-1">50% of estimated tax</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                  <Clock className="w-3 h-3" />
                  Due: 31 August
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-800">2nd Payment (Feb)</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{fmt(provisionalData.secondPayment)}</p>
                <p className="text-xs text-gray-500 mt-1">Remaining 50%</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                  <Clock className="w-3 h-3" />
                  Due: 28 February
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-800">Total Estimated Tax</span>
                </div>
                <p className="text-xl font-bold text-red-900">{fmt(provisionalData.estimatedTax)}</p>
                <p className="text-xs text-red-500 mt-1">{COMPANY_TAX_RATE}% of taxable income</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-medium mb-1">Important Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                <li>Under-estimation penalty applies if 2nd payment is less than 80% of actual tax</li>
                <li>Top-up (3rd) payment due within 7 months after year-end</li>
                <li>Interest charged on late or insufficient payments at SARS prescribed rate</li>
                <li>Companies must submit IRP6 electronically via eFiling</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ===================== Depreciation ===================== */}
      {sarsTab === 'depreciation' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Depreciation Schedule - Section 11(e)</h3>
              <div className="flex gap-2">
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded">
                  {depreciationData.length} assets
                </span>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  Annual: {fmt(totalAnnualDepreciation)}
                </span>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-sm text-teal-600 font-medium">Total Cost</p>
                <p className="text-xl font-bold text-teal-800">{fmt(depreciationData.reduce((s: number, a: any) => s + a.cost, 0))}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium">Annual Depreciation</p>
                <p className="text-xl font-bold text-orange-800">{fmt(totalAnnualDepreciation)}</p>
                <p className="text-xs text-orange-500 mt-1">Tax deduction (S11(e))</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Total Book Value</p>
                <p className="text-xl font-bold text-blue-800">{fmt(totalBookValue)}</p>
              </div>
            </div>

            {/* Depreciation Table */}
            {depreciationData.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-medium text-gray-600">Asset</th>
                      <th className="text-left p-3 font-medium text-gray-600">Category</th>
                      <th className="text-right p-3 font-medium text-gray-600">Cost</th>
                      <th className="text-right p-3 font-medium text-gray-600">Rate</th>
                      <th className="text-right p-3 font-medium text-gray-600">Annual Depr.</th>
                      <th className="text-right p-3 font-medium text-gray-600">Accumulated</th>
                      <th className="text-right p-3 font-medium text-gray-600">Book Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {depreciationData.map((asset: any) => (
                      <tr key={asset.id} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-900 font-medium">{asset.name}</td>
                        <td className="p-3 text-gray-500">{asset.category}</td>
                        <td className="p-3 text-right">{fmt(asset.cost)}</td>
                        <td className="p-3 text-right text-gray-500">{asset.rate}%</td>
                        <td className="p-3 text-right text-orange-600 font-medium">{fmt(asset.annualDepr)}</td>
                        <td className="p-3 text-right text-gray-500">{fmt(asset.accumulated)}</td>
                        <td className="p-3 text-right text-blue-600 font-medium">{fmt(asset.bookValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td className="p-3" colSpan={2}>Totals</td>
                      <td className="p-3 text-right">{fmt(depreciationData.reduce((s: number, a: any) => s + a.cost, 0))}</td>
                      <td className="p-3 text-right"></td>
                      <td className="p-3 text-right text-orange-700">{fmt(totalAnnualDepreciation)}</td>
                      <td className="p-3 text-right">{fmt(depreciationData.reduce((s: number, a: any) => s + a.accumulated, 0))}</td>
                      <td className="p-3 text-right text-blue-700">{fmt(totalBookValue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No assets with depreciation data. Add useful life and residual value to assets to calculate depreciation.</p>
              </div>
            )}

            {/* SARS Wear & Tear Rates Reference */}
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">SARS Wear & Tear Rates Reference</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                {Object.entries(WEAR_AND_TEAR_RATES).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-gray-600">{val.desc}</span>
                    <span className="font-medium text-gray-800">{val.rate}% ({val.life} yrs)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
