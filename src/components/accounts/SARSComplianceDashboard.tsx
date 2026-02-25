import { useState, useMemo } from 'react';
import {
  FileText, DollarSign, TrendingUp, AlertTriangle,
  Calendar, CheckCircle2, Clock, ArrowRight,
  Building2, Users, Calculator, Shield, BarChart3,
  HelpCircle, AlertCircle, Lightbulb, Settings,
  Brain, Info, Bell, Pencil, Save, X
} from 'lucide-react';
import { format } from 'date-fns';

// ============================================
// Tooltip Component - Plain language explanations
// ============================================
function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help">
      <HelpCircle className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" />
      <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-white bg-gray-900 rounded-lg shadow-lg z-50 leading-relaxed pointer-events-none">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}

// ============================================
// Default Tax Rates (2025/2026) - User can override
// ============================================
const DEFAULT_TAX_BRACKETS = [
  { min: 0, max: 237100, rate: 18, baseAmount: 0 },
  { min: 237101, max: 370500, rate: 26, baseAmount: 42678 },
  { min: 370501, max: 512800, rate: 31, baseAmount: 77362 },
  { min: 512801, max: 673000, rate: 36, baseAmount: 121475 },
  { min: 673001, max: 857900, rate: 39, baseAmount: 179147 },
  { min: 857901, max: 1817000, rate: 41, baseAmount: 251258 },
  { min: 1817001, max: Infinity, rate: 45, baseAmount: 644489 },
];

const DEFAULT_RATES = {
  companyTaxRate: 27,
  vatRate: 15,
  uifEmployeeRate: 1,
  uifEmployerRate: 1,
  uifMaxMonthly: 17712,
  sdlRate: 1,
  sdlThreshold: 500000,
  primaryRebate: 17235,
  secondaryRebate: 9444,
  tertiaryRebate: 3145,
};

// ============================================
// Plain language tooltip texts
// ============================================
const TOOLTIPS = {
  // VAT
  outputVat: "This is the VAT you charged your customers on your invoices. You collected this money on behalf of SARS and must pay it over to them.",
  inputVat: "This is the VAT you paid on your business purchases and expenses. You can claim this back from SARS to reduce what you owe.",
  vatPayable: "This is the difference between what you collected (Output VAT) and what you paid (Input VAT). If positive, you owe SARS. If negative, SARS owes you a refund.",
  vatBox1: "The total value (excluding VAT) of all your sales and services where you charged 15% VAT.",
  vatBox1A: "The actual VAT amount (15%) on your standard-rated sales. This is what you collected from customers.",
  vatBox2: "Sales at 0% VAT — like exports or basic food. You still report these but no VAT is charged.",
  vatBox3: "Supplies that are exempt from VAT entirely, like residential rent or financial services.",
  vatBox14: "The total value of your purchases and expenses that included VAT.",
  vatBox14A: "The VAT included in your purchases. This is your Input VAT claim — money SARS gives back to you.",
  vatBox19: "The final amount: positive means you must pay SARS, negative means SARS refunds you. Due by the 25th of the month following the VAT period.",

  // EMP201
  paye: "Pay As You Earn — the income tax you deduct from each employee's salary. It's based on their annual income using SARS tax brackets (18% to 45%). You must pay this to SARS monthly.",
  uif: "Unemployment Insurance Fund — provides short-term financial relief to workers when they become unemployed. Both employer and employee contribute 1% each of the employee's salary.",
  sdl: "Skills Development Levy — funds training and education in South Africa. Only applies if your total annual payroll exceeds R500,000. You pay 1% of total payroll.",
  emp201Liability: "The total amount you must pay to SARS each month for all your employees — this includes PAYE + UIF + SDL. Due by the 7th of the following month.",
  taxBrackets: "SARS uses progressive tax brackets — the more an employee earns, the higher the tax rate on the portion above each threshold. For example, the first R237,100 is taxed at 18%, and earnings above that are taxed at higher rates.",

  // IT14
  grossIncome: "Your total business income before any deductions. This includes revenue from services, rental income, interest earned, and any other business income.",
  taxableIncome: "Your profit after subtracting all allowable business expenses from your gross income. This is the amount SARS will charge company tax on.",
  companyTax: "South African companies pay a flat tax rate (currently 27%) on their taxable income. This is due when you file your annual IT14 return.",
  effectiveRate: "The actual percentage of your total revenue that goes to tax. This is often lower than the 27% company rate because of deductions.",
  s11aGeneral: "General business expenses that are directly related to earning your income — things like advertising, office supplies, subscriptions, phone bills.",
  s11dRepairs: "Money spent on repairs and maintenance of business assets. This is fully deductible in the year you spend it.",
  s11eDepreciation: "Wear and tear allowance — SARS lets you deduct a portion of your asset's cost each year based on how quickly it loses value. Different assets have different rates.",
  s11fRent: "Lease premiums and rent paid for business premises. This is deductible as a business expense.",
  s23hPrepaid: "Expenses you paid in advance (like annual insurance). SARS may limit how much you can deduct in the current year if the benefit extends beyond 6 months.",
  sourceCode4001: "Income from your main business activities — providing services, completing projects, selling goods to customers.",
  sourceCode4007: "Income from renting out property. This is taxed as part of your total business income.",
  sourceCode4012: "Interest earned on bank accounts or investments. For companies, this is included in total taxable income.",
  sourceCode4026: "Any other business income that doesn't fit the categories above — like insurance payouts, commissions received, or penalty income.",

  // Provisional Tax
  provisionalTax: "Provisional tax is an advance payment toward your annual tax bill. Instead of paying a large lump sum at year-end, you pay in two installments during the year. This helps spread the cost.",
  firstPayment: "Your first provisional tax payment — 50% of your estimated annual tax. Due within 6 months after the start of your financial year (typically by 31 August).",
  secondPayment: "Your second provisional tax payment — the remaining estimated tax. Due by the last day of your financial year (typically 28 February). SARS charges penalties if you underestimate by more than 20%.",
  underEstimation: "If your second estimate is less than 80% of your actual final tax, SARS charges a 20% penalty on the shortfall. It's better to slightly overestimate than underestimate.",

  // Depreciation
  depreciation: "When you buy an expensive asset for your business, SARS doesn't let you deduct the full cost in year one. Instead, you spread the deduction over the asset's useful life. This annual deduction reduces your taxable income.",
  wearAndTear: "SARS sets standard rates for how quickly different types of assets lose value. For example, computers are written off in 3 years (33% per year), while vehicles take 4 years (25% per year).",
  bookValue: "The remaining value of an asset on your books after subtracting accumulated depreciation. When book value reaches the residual value, depreciation stops.",

  // Settings
  taxRateSettings: "If SARS changes any tax rates (e.g., VAT increases, new tax brackets), you can update them here. This ensures your calculations stay accurate without waiting for a software update.",
};

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
  const [sarsTab, setSarsTab] = useState<'insights' | 'vat' | 'emp201' | 'it14' | 'provisional' | 'depreciation' | 'settings'>('insights');

  // Editable tax rates - saved to localStorage
  const [rates, setRates] = useState(() => {
    try {
      const saved = localStorage.getItem('sars_tax_rates');
      return saved ? { ...DEFAULT_RATES, ...JSON.parse(saved) } : DEFAULT_RATES;
    } catch { return DEFAULT_RATES; }
  });

  const saveRates = (newRates: typeof DEFAULT_RATES) => {
    setRates(newRates);
    localStorage.setItem('sars_tax_rates', JSON.stringify(newRates));
  };

  const fmt = (n: number) => `R ${(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ============================================
  // VAT Calculations
  // ============================================
  const vatData = useMemo(() => {
    const outputVat = invoices
      .filter((inv: any) => inv.status === 'PAID' || inv.status === 'SENT')
      .reduce((sum: number, inv: any) => sum + (inv.tax || (inv.total || 0) * rates.vatRate / (100 + rates.vatRate)), 0);

    const altRevenueOutputVat = alternativeRevenues
      .filter((r: any) => r.supplyType !== 'EXEMPT')
      .reduce((sum: number, r: any) => {
        const rate = r.vatRate || (r.supplyType === 'ZERO_RATED' ? 0 : rates.vatRate);
        return sum + (r.outputVatAmount || (r.amount * rate / (100 + rate)));
      }, 0);

    const expenseInputVat = operationalExpenses.reduce((sum: number, exp: any) => {
      if (exp.supplyType === 'EXEMPT') return sum;
      const rate = exp.vatRate || (exp.supplyType === 'ZERO_RATED' ? 0 : rates.vatRate);
      return sum + (exp.inputVatAmount || (exp.amount * rate / (100 + rate)));
    }, 0);

    const materialInputVat = (materialCosts * rates.vatRate) / (100 + rates.vatRate);
    const totalOutputVat = outputVat + altRevenueOutputVat;
    const totalInputVat = expenseInputVat + materialInputVat;
    const vatPayable = totalOutputVat - totalInputVat;

    const standardRated = invoices
      .filter((inv: any) => inv.status === 'PAID' || inv.status === 'SENT')
      .reduce((sum: number, inv: any) => sum + ((inv.total || 0) - (inv.tax || 0)), 0);
    const zeroRated = alternativeRevenues.filter((r: any) => r.supplyType === 'ZERO_RATED').reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    const exempt = alternativeRevenues.filter((r: any) => r.supplyType === 'EXEMPT').reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

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
  }, [invoices, alternativeRevenues, operationalExpenses, materialCosts, rates.vatRate]);

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
    const sdlApplicable = annualPayroll > rates.sdlThreshold;
    const totalSDL = sdlApplicable ? Math.round(monthlyPayroll * rates.sdlRate / 100 * 100) / 100 : 0;
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
  }, [payslips, rates]);

  // ============================================
  // IT14 Income Tax Calculations
  // ============================================
  const it14Data = useMemo(() => {
    const taxableIncome = netProfit;
    const companyTax = Math.max(0, Math.round(taxableIncome * rates.companyTaxRate / 100 * 100) / 100);
    
    const invoiceRevenue = invoices
      .filter((inv: any) => inv.status === 'PAID')
      .reduce((sum: number, inv: any) => sum + ((inv.total || 0) - (inv.tax || 0)), 0);
    const rentalIncome = alternativeRevenues.filter((r: any) => r.category === 'RENTAL').reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    const interestIncome = alternativeRevenues.filter((r: any) => r.category === 'INTEREST').reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    const otherIncome = alternativeRevenues.filter((r: any) => !['RENTAL', 'INTEREST'].includes(r.category)).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    const expensesBySection: Record<string, number> = {};
    operationalExpenses.forEach((exp: any) => {
      const section = exp.sarsDeductionSection || 'S11a_GENERAL';
      expensesBySection[section] = (expensesBySection[section] || 0) + (exp.amount || 0);
    });

    const totalDepreciation = assets.reduce((sum: number, asset: any) => {
      if (!asset.usefulLifeYears || !asset.purchasePrice) return sum;
      return sum + ((asset.purchasePrice || 0) - (asset.residualValue || 0)) / (asset.usefulLifeYears || 5);
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
  }, [invoices, alternativeRevenues, operationalExpenses, assets, totalRevenue, totalExpenses, netProfit, rates.companyTaxRate]);

  // ============================================
  // Provisional Tax
  // ============================================
  const provisionalData = useMemo(() => {
    const months = Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
    const annualizedProfit = netProfit * (12 / months);
    const estimatedTax = Math.max(0, annualizedProfit * rates.companyTaxRate / 100);
    return {
      annualizedProfit: Math.round(annualizedProfit * 100) / 100,
      estimatedTax: Math.round(estimatedTax * 100) / 100,
      firstPayment: Math.round(estimatedTax * 0.5 * 100) / 100,
      secondPayment: Math.round(estimatedTax * 0.5 * 100) / 100,
    };
  }, [netProfit, dateRange, rates.companyTaxRate]);

  // ============================================
  // Depreciation Schedule
  // ============================================
  const depreciationData = useMemo(() => {
    return assets.filter((a: any) => a.purchasePrice > 0).map((asset: any) => {
      const cost = asset.purchasePrice || 0;
      const residual = asset.residualValue || 0;
      const usefulLife = asset.usefulLifeYears || 5;
      const rate = asset.sarsWearAndTearRate || (100 / usefulLife);
      const annualDepr = (cost - residual) / usefulLife;
      const accumulated = asset.accumulatedDepreciation || 0;
      const bookValue = Math.max(residual, cost - accumulated);
      return { id: asset.id, name: asset.name, category: asset.category, cost, residual, usefulLife, rate: Math.round(rate * 100) / 100, annualDepr: Math.round(annualDepr * 100) / 100, accumulated: Math.round(accumulated * 100) / 100, bookValue: Math.round(bookValue * 100) / 100 };
    });
  }, [assets]);

  const totalAnnualDepreciation = depreciationData.reduce((sum: number, a: any) => sum + a.annualDepr, 0);
  const totalBookValue = depreciationData.reduce((sum: number, a: any) => sum + a.bookValue, 0);

  // ============================================
  // AI Insights Engine
  // ============================================
  const insights = useMemo(() => {
    const items: { type: 'urgent' | 'warning' | 'info' | 'success'; title: string; detail: string; action?: string }[] = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    // VAT submission deadlines
    if (currentDay >= 20 && currentDay <= 25) {
      items.push({ type: 'urgent', title: 'VAT201 Due Soon', detail: `Your VAT return is due by the 25th of this month. You ${vatData.vatPayable >= 0 ? 'owe SARS ' + fmt(vatData.vatPayable) : 'are due a refund of ' + fmt(Math.abs(vatData.vatPayable))}.`, action: 'Submit via SARS eFiling before the 25th' });
    } else if (currentDay > 25) {
      items.push({ type: 'success', title: 'VAT201 Period Closed', detail: 'The VAT submission deadline for this period has passed. Ensure your return was submitted.' });
    }

    // EMP201 deadline (7th of each month)
    if (currentDay <= 7) {
      items.push({ type: 'urgent', title: 'EMP201 Due by the 7th', detail: `Monthly PAYE/UIF/SDL payment of ${fmt(emp201Data.totalLiability)} is due to SARS by the 7th.`, action: 'Pay via SARS eFiling or EFT' });
    }

    // Provisional tax reminders
    if (currentMonth >= 6 && currentMonth <= 7) {
      items.push({ type: 'warning', title: '1st Provisional Tax Payment', detail: `Your first IRP6 payment of approximately ${fmt(provisionalData.firstPayment)} is due by 31 August.`, action: 'Calculate and submit IRP6 via eFiling' });
    }
    if (currentMonth >= 0 && currentMonth <= 1) {
      items.push({ type: 'warning', title: '2nd Provisional Tax Payment', detail: `Your second IRP6 payment of approximately ${fmt(provisionalData.secondPayment)} is due by 28 February.`, action: 'Calculate and submit IRP6 via eFiling' });
    }

    // VAT amount analysis
    if (vatData.vatPayable > 50000) {
      items.push({ type: 'warning', title: 'Large VAT Liability', detail: `You owe ${fmt(vatData.vatPayable)} in VAT. Ensure you have sufficient cash reserves set aside for this payment.`, action: 'Set aside funds before the 25th' });
    }
    if (vatData.vatPayable < 0 && Math.abs(vatData.vatPayable) > 10000) {
      items.push({ type: 'info', title: 'VAT Refund Expected', detail: `You are expecting a VAT refund of ${fmt(Math.abs(vatData.vatPayable))}. SARS refunds can take 21 business days. Ensure supporting documents are in order.` });
    }

    // Profit margin analysis
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    if (profitMargin < 10 && totalRevenue > 0) {
      items.push({ type: 'warning', title: 'Low Profit Margin', detail: `Your profit margin is only ${profitMargin.toFixed(1)}%. This means very little is left after expenses. Review your costs or increase pricing.`, action: 'Review expense categories in your P&L statement' });
    } else if (profitMargin > 30) {
      items.push({ type: 'success', title: 'Strong Profit Margin', detail: `Your profit margin of ${profitMargin.toFixed(1)}% is healthy. This puts you in a good position for tax obligations and business growth.` });
    }

    // SDL threshold approach
    if (emp201Data.monthlyPayroll > 0 && !emp201Data.sdlApplicable) {
      const annualPayroll = emp201Data.monthlyPayroll * 12;
      if (annualPayroll > rates.sdlThreshold * 0.8) {
        items.push({ type: 'info', title: 'Approaching SDL Threshold', detail: `Your annual payroll (${fmt(annualPayroll)}) is approaching the R${rates.sdlThreshold.toLocaleString()} SDL threshold. If it exceeds this, you'll need to pay an additional 1% Skills Development Levy.` });
      }
    }

    // Assets without depreciation
    const assetsWithoutDepreciation = assets.filter((a: any) => a.purchasePrice > 5000 && !a.usefulLifeYears);
    if (assetsWithoutDepreciation.length > 0) {
      items.push({ type: 'info', title: 'Assets Missing Depreciation', detail: `${assetsWithoutDepreciation.length} asset(s) worth over R5,000 don't have depreciation set up. You could be missing out on tax deductions.`, action: 'Go to Assets page and add useful life years' });
    }

    // Depreciation tax savings
    if (totalAnnualDepreciation > 0) {
      items.push({ type: 'success', title: 'Depreciation Tax Savings', detail: `Your ${depreciationData.length} depreciable asset(s) save you ${fmt(totalAnnualDepreciation * rates.companyTaxRate / 100)} in company tax this year through wear & tear deductions.` });
    }

    // No payslips warning
    if (payslips.length === 0) {
      items.push({ type: 'info', title: 'No Payroll Data', detail: 'No payslips found for this period. If you have employees, ensure their payslips are captured so PAYE and UIF calculations are accurate.' });
    }

    // Overdue liabilities
    const overdueLiabilities = liabilities.filter((l: any) => l.dueDate && !l.isPaid && new Date(l.dueDate) < now);
    if (overdueLiabilities.length > 0) {
      const overdueTotal = overdueLiabilities.reduce((s: number, l: any) => s + (l.amount || 0), 0);
      items.push({ type: 'urgent', title: `${overdueLiabilities.length} Overdue Liability/ies`, detail: `You have ${fmt(overdueTotal)} in overdue payments. Late payments can attract interest and damage supplier relationships.`, action: 'Check Liabilities page to settle overdue accounts' });
    }

    // Zero revenue warning
    if (totalRevenue === 0) {
      items.push({ type: 'info', title: 'No Revenue This Period', detail: 'No paid invoices recorded for this period. If you had sales, ensure invoices are marked as PAID.' });
    }

    // General helpful tip
    items.push({ type: 'info', title: 'Record Keeping Reminder', detail: 'SARS requires you to keep all financial records for at least 5 years. This includes invoices, receipts, bank statements, and contracts. Digital copies are accepted.' });

    return items;
  }, [vatData, emp201Data, provisionalData, totalRevenue, netProfit, assets, depreciationData, totalAnnualDepreciation, payslips, liabilities, rates, fmt]);

  const urgentCount = insights.filter(i => i.type === 'urgent').length;
  const warningCount = insights.filter(i => i.type === 'warning').length;

  return (
    <div className="space-y-6">
      {/* SARS Compliance Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-lg font-bold text-green-800">SARS Compliance Dashboard</h2>
              <p className="text-sm text-green-700">
                Period: {format(dateRange.start, 'dd MMM yyyy')} – {format(dateRange.end, 'dd MMM yyyy')}
                <Tip text="All calculations use the reporting period selected above. Change the period to see different time frames." />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                <Bell className="w-3 h-3" /> {urgentCount} Urgent
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                <AlertTriangle className="w-3 h-3" /> {warningCount} Warning{warningCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2">
        {[
          { id: 'insights' as const, label: 'AI Insights', icon: Brain, desc: 'Smart analysis of your tax situation' },
          { id: 'vat' as const, label: 'VAT201', icon: FileText, desc: 'Value Added Tax return' },
          { id: 'emp201' as const, label: 'EMP201', icon: Users, desc: 'Monthly employer tax return' },
          { id: 'it14' as const, label: 'IT14 Income Tax', icon: Building2, desc: 'Annual company tax return' },
          { id: 'provisional' as const, label: 'Provisional Tax', icon: Calculator, desc: 'Advance tax payments (IRP6)' },
          { id: 'depreciation' as const, label: 'Depreciation', icon: BarChart3, desc: 'Asset wear & tear deductions' },
          { id: 'settings' as const, label: 'Tax Rates', icon: Settings, desc: 'Update tax rates when SARS changes them' },
        ].map((tab) => (
          <div key={tab.id} className="relative group">
            <button
              onClick={() => setSarsTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                sarsTab === tab.id
                  ? 'bg-green-100 text-green-700 ring-2 ring-green-400 shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } ${tab.id === 'insights' && urgentCount > 0 ? 'animate-pulse' : ''}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'insights' && urgentCount > 0 && (
                <span className="w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <span className="hidden group-hover:block absolute top-full left-0 mt-1 w-48 p-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg z-50">
              {tab.desc}
            </span>
          </div>
        ))}
      </div>

      {/* ===================== AI INSIGHTS ===================== */}
      {sarsTab === 'insights' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI Tax Insights</h3>
                <p className="text-sm text-gray-500">Automated analysis of your tax situation — what needs attention right now</p>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 font-medium">VAT Payable</p>
                <p className={`text-lg font-bold ${vatData.vatPayable >= 0 ? 'text-blue-800' : 'text-green-700'}`}>{fmt(Math.abs(vatData.vatPayable))}</p>
                <p className="text-[10px] text-blue-500">{vatData.vatPayable >= 0 ? 'You owe SARS' : 'SARS owes you'}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 font-medium">EMP201 Due</p>
                <p className="text-lg font-bold text-purple-800">{fmt(emp201Data.totalLiability)}</p>
                <p className="text-[10px] text-purple-500">PAYE + UIF + SDL</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <p className="text-xs text-orange-600 font-medium">Company Tax</p>
                <p className="text-lg font-bold text-orange-800">{fmt(it14Data.companyTax)}</p>
                <p className="text-[10px] text-orange-500">{rates.companyTaxRate}% of profit</p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 font-medium">Tax Deductions</p>
                <p className="text-lg font-bold text-teal-800">{fmt(totalAnnualDepreciation)}</p>
                <p className="text-[10px] text-teal-500">From depreciation</p>
              </div>
            </div>

            {/* Insights List */}
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={`border rounded-lg p-4 ${
                    insight.type === 'urgent' ? 'bg-red-50 border-red-200' :
                    insight.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                    insight.type === 'success' ? 'bg-green-50 border-green-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg mt-0.5 ${
                      insight.type === 'urgent' ? 'bg-red-100' :
                      insight.type === 'warning' ? 'bg-amber-100' :
                      insight.type === 'success' ? 'bg-green-100' :
                      'bg-blue-100'
                    }`}>
                      {insight.type === 'urgent' ? <AlertCircle className="w-4 h-4 text-red-600" /> :
                       insight.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600" /> :
                       insight.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                       <Lightbulb className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-sm font-semibold ${
                        insight.type === 'urgent' ? 'text-red-800' :
                        insight.type === 'warning' ? 'text-amber-800' :
                        insight.type === 'success' ? 'text-green-800' :
                        'text-blue-800'
                      }`}>{insight.title}</h4>
                      <p className={`text-sm mt-0.5 ${
                        insight.type === 'urgent' ? 'text-red-700' :
                        insight.type === 'warning' ? 'text-amber-700' :
                        insight.type === 'success' ? 'text-green-700' :
                        'text-blue-700'
                      }`}>{insight.detail}</p>
                      {insight.action && (
                        <div className="mt-2 flex items-center gap-1 text-xs font-medium">
                          <ArrowRight className="w-3 h-3" />
                          <span className={
                            insight.type === 'urgent' ? 'text-red-600' :
                            insight.type === 'warning' ? 'text-amber-600' :
                            'text-blue-600'
                          }>{insight.action}</span>
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${
                      insight.type === 'urgent' ? 'bg-red-200 text-red-700' :
                      insight.type === 'warning' ? 'bg-amber-200 text-amber-700' :
                      insight.type === 'success' ? 'bg-green-200 text-green-700' :
                      'bg-blue-200 text-blue-700'
                    }`}>{insight.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== VAT201 ===================== */}
      {sarsTab === 'vat' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">VAT201 Return Summary</h3>
                <p className="text-xs text-gray-500 mt-0.5">This is the form you submit to SARS showing VAT collected and VAT paid<Tip text="You submit a VAT201 return to SARS every 2 months (Category B) or monthly (Category A). It shows VAT you charged customers (Output) versus VAT you paid on purchases (Input)." /></p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Standard Rate: {rates.vatRate}%</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium flex items-center gap-1">Output VAT (Sales)<Tip text={TOOLTIPS.outputVat} /></p>
                <p className="text-2xl font-bold text-green-800">{fmt(vatData.outputVat)}</p>
                <p className="text-xs text-green-500 mt-1">{vatData.invoiceCount} invoices</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium flex items-center gap-1">Input VAT (Purchases)<Tip text={TOOLTIPS.inputVat} /></p>
                <p className="text-2xl font-bold text-red-800">{fmt(vatData.inputVat)}</p>
                <p className="text-xs text-red-500 mt-1">{vatData.expenseCount} expense items</p>
              </div>
              <div className={`${vatData.vatPayable >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
                <p className={`text-sm font-medium flex items-center gap-1 ${vatData.vatPayable >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                  {vatData.vatPayable >= 0 ? 'VAT Payable to SARS' : 'VAT Refund from SARS'}<Tip text={TOOLTIPS.vatPayable} />
                </p>
                <p className={`text-2xl font-bold ${vatData.vatPayable >= 0 ? 'text-amber-800' : 'text-blue-800'}`}>{fmt(Math.abs(vatData.vatPayable))}</p>
                <p className="text-xs text-gray-500 mt-1">Output − Input VAT</p>
              </div>
            </div>

            <div className="border rounded-lg divide-y">
              <div className="p-3 bg-gray-50 text-sm font-medium text-gray-700">VAT201 Box Details <Tip text="These boxes correspond to the fields on the official SARS VAT201 form. Each box has a specific purpose." /></div>
              {[
                { box: '1', label: 'Standard rated supplies (15%)', value: vatData.standardRated, tip: TOOLTIPS.vatBox1 },
                { box: '1A', label: 'Output tax on Box 1', value: vatData.outputVat, tip: TOOLTIPS.vatBox1A },
                { box: '2', label: 'Zero-rated supplies (0%)', value: vatData.zeroRated, tip: TOOLTIPS.vatBox2 },
                { box: '3', label: 'Exempt supplies', value: vatData.exempt, tip: TOOLTIPS.vatBox3 },
                { box: '14', label: 'Standard rated purchases', value: materialCosts + operationalExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0), tip: TOOLTIPS.vatBox14 },
                { box: '14A', label: 'Input tax on Box 14', value: vatData.inputVat, tip: TOOLTIPS.vatBox14A },
                { box: '19', label: 'Total VAT payable / (refundable)', value: vatData.vatPayable, tip: TOOLTIPS.vatBox19 },
              ].map((row) => (
                <div key={row.box} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-100 text-blue-700 text-xs font-mono w-8 h-8 flex items-center justify-center rounded">{row.box}</span>
                    <span className="text-gray-700 flex items-center gap-1">{row.label}<Tip text={row.tip} /></span>
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
              <div>
                <h3 className="text-lg font-semibold text-gray-900">EMP201 Monthly Return</h3>
                <p className="text-xs text-gray-500 mt-0.5">Monthly summary of tax you withhold from employees and pay to SARS<Tip text="Every month, you must deduct PAYE, UIF and SDL from employee salaries and pay it to SARS by the 7th of the following month. This form summarises those amounts." /></p>
              </div>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{emp201Data.employeeCount} payslips</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-600 font-medium flex items-center gap-1">Total PAYE<Tip text={TOOLTIPS.paye} /></p>
                <p className="text-xl font-bold text-purple-800">{fmt(emp201Data.totalPAYE)}</p>
                <p className="text-xs text-purple-500 mt-1">Income tax withheld</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium flex items-center gap-1">Total UIF<Tip text={TOOLTIPS.uif} /></p>
                <p className="text-xl font-bold text-blue-800">{fmt(emp201Data.totalUIF)}</p>
                <p className="text-xs text-blue-500 mt-1">Employee ({rates.uifEmployeeRate}%) + Employer ({rates.uifEmployerRate}%)</p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-sm text-teal-600 font-medium flex items-center gap-1">SDL<Tip text={TOOLTIPS.sdl} /></p>
                <p className="text-xl font-bold text-teal-800">{fmt(emp201Data.totalSDL)}</p>
                <p className="text-xs text-teal-500 mt-1">{emp201Data.sdlApplicable ? `${rates.sdlRate}% of payroll` : `Below R${rates.sdlThreshold.toLocaleString()} threshold`}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium flex items-center gap-1">Total EMP201 Liability<Tip text={TOOLTIPS.emp201Liability} /></p>
                <p className="text-xl font-bold text-red-800">{fmt(emp201Data.totalLiability)}</p>
                <p className="text-xs text-red-500 mt-1">Due by the 7th</p>
              </div>
            </div>

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
                    <td className="p-3 text-gray-700 flex items-center gap-1">PAYE (Employees' Tax)<Tip text={TOOLTIPS.paye} /></td>
                    <td className="p-3 text-right text-gray-500">18%-45% brackets</td>
                    <td className="p-3 text-right text-gray-700">{fmt(emp201Data.monthlyPayroll)}</td>
                    <td className="p-3 text-right font-medium">{fmt(emp201Data.totalPAYE)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-gray-700 flex items-center gap-1">UIF - Employee<Tip text="The employee's 1% contribution — deducted from their salary before they receive it." /></td>
                    <td className="p-3 text-right text-gray-500">{rates.uifEmployeeRate}% (max R{rates.uifMaxMonthly.toLocaleString()}/m)</td>
                    <td className="p-3 text-right text-gray-700">{fmt(emp201Data.monthlyPayroll)}</td>
                    <td className="p-3 text-right font-medium">{fmt(emp201Data.totalEmployeeUIF)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-gray-700 flex items-center gap-1">UIF - Employer<Tip text="Your matching 1% contribution as the employer. This is an additional cost on top of the salary." /></td>
                    <td className="p-3 text-right text-gray-500">{rates.uifEmployerRate}%</td>
                    <td className="p-3 text-right text-gray-700">{fmt(emp201Data.monthlyPayroll)}</td>
                    <td className="p-3 text-right font-medium">{fmt(emp201Data.totalEmployerUIF)}</td>
                  </tr>
                  <tr className={emp201Data.sdlApplicable ? '' : 'opacity-50'}>
                    <td className="p-3 text-gray-700 flex items-center gap-1">SDL<Tip text={TOOLTIPS.sdl} /></td>
                    <td className="p-3 text-right text-gray-500">{rates.sdlRate}% {!emp201Data.sdlApplicable && '(N/A)'}</td>
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

            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1">SARS 2025/2026 Personal Income Tax Brackets<Tip text={TOOLTIPS.taxBrackets} /></h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {DEFAULT_TAX_BRACKETS.map((b, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-gray-600">R{b.min.toLocaleString()} – {b.max === Infinity ? '∞' : `R${b.max.toLocaleString()}`}</span>
                    <span className="font-medium text-gray-800">{b.rate}%</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Primary rebate: R{rates.primaryRebate.toLocaleString()} | Secondary (65+): R{rates.secondaryRebate.toLocaleString()} | Tertiary (75+): R{rates.tertiaryRebate.toLocaleString()}
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
              <div>
                <h3 className="text-lg font-semibold text-gray-900">IT14 Company Income Tax</h3>
                <p className="text-xs text-gray-500 mt-0.5">Annual tax return for companies — filed 12 months after your financial year-end<Tip text="The IT14 is the annual income tax return for companies. You report all income, deduct allowable expenses, and pay tax on the profit at 27%. It's due 12 months after your financial year-end." /></p>
              </div>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Company Tax: {rates.companyTaxRate}%</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium flex items-center gap-1">Gross Income<Tip text={TOOLTIPS.grossIncome} /></p>
                <p className="text-2xl font-bold text-green-800">{fmt(it14Data.grossIncome)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium flex items-center gap-1">Total Deductions<Tip text="All your allowable business expenses that reduce your taxable income. The more legitimate deductions you have, the less tax you pay." /></p>
                <p className="text-2xl font-bold text-red-800">{fmt(it14Data.totalDeductions)}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium flex items-center gap-1">Estimated Tax<Tip text={TOOLTIPS.companyTax} /></p>
                <p className="text-2xl font-bold text-orange-800">{fmt(it14Data.companyTax)}</p>
                <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">Effective rate: {it14Data.effectiveRate}%<Tip text={TOOLTIPS.effectiveRate} /></p>
              </div>
            </div>

            {/* Income Schedule */}
            <div className="border rounded-lg divide-y">
              <div className="p-3 bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Income Schedule (Source Codes)
                <Tip text="SARS uses source codes to categorise different types of income. Each code tells them what kind of money you earned." />
              </div>
              {[
                { code: '4001', label: 'Local Sales & Services', value: it14Data.invoiceRevenue, tip: TOOLTIPS.sourceCode4001 },
                { code: '4007', label: 'Rental Income', value: it14Data.rentalIncome, tip: TOOLTIPS.sourceCode4007 },
                { code: '4012', label: 'Interest Received', value: it14Data.interestIncome, tip: TOOLTIPS.sourceCode4012 },
                { code: '4026', label: 'Other Income', value: it14Data.otherIncome, tip: TOOLTIPS.sourceCode4026 },
              ].filter(r => r.value > 0).map((row) => (
                <div key={row.code} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="bg-green-100 text-green-700 text-xs font-mono px-2 py-1 rounded">{row.code}</span>
                    <span className="text-gray-700 flex items-center gap-1">{row.label}<Tip text={row.tip} /></span>
                  </div>
                  <span className="font-medium text-gray-900">{fmt(row.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-green-50 font-semibold text-sm">
                <span className="text-green-800">Total Gross Income</span>
                <span className="text-green-800">{fmt(it14Data.grossIncome)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="border rounded-lg divide-y">
              <div className="p-3 bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Deductions by Section
                <Tip text="SARS groups deductions by section of the Income Tax Act. Each section covers a different type of expense. All amounts shown here reduce your taxable income." />
              </div>
              {Object.entries(it14Data.expensesBySection)
                .filter(([_, v]) => v > 0)
                .sort(([_, a], [__, b]) => b - a)
                .map(([section, amount]) => {
                  const tipKey = section === 'S11a_GENERAL' ? TOOLTIPS.s11aGeneral
                    : section === 'S11d_REPAIRS' ? TOOLTIPS.s11dRepairs
                    : section === 'S11e_DEPRECIATION' ? TOOLTIPS.s11eDepreciation
                    : section === 'S11f_RENT' ? TOOLTIPS.s11fRent
                    : section === 'S23H_PREPAID' ? TOOLTIPS.s23hPrepaid
                    : 'Allowable expense deduction under the Income Tax Act.';
                  return (
                    <div key={section} className="flex items-center justify-between p-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="bg-red-100 text-red-700 text-xs font-mono px-2 py-1 rounded">{section.split('_')[0]}</span>
                        <span className="text-gray-700 flex items-center gap-1">{SARS_DEDUCTION_SECTIONS[section] || section}<Tip text={tipKey} /></span>
                      </div>
                      <span className="font-medium text-red-700">({fmt(amount)})</span>
                    </div>
                  );
                })}
              <div className="flex items-center justify-between p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="bg-red-100 text-red-700 text-xs font-mono px-2 py-1 rounded">Other</span>
                  <span className="text-gray-700 flex items-center gap-1">Materials, labour & artisan payments<Tip text="Direct costs of doing your work — materials, labour charges, and payments to sub-contractors/artisans. All deductible." /></span>
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
              <div className="flex justify-between p-3 text-sm"><span>Gross Income</span><span className="font-medium">{fmt(it14Data.grossIncome)}</span></div>
              <div className="flex justify-between p-3 text-sm"><span>Less: Allowable Deductions</span><span className="font-medium text-red-600">({fmt(it14Data.totalDeductions)})</span></div>
              <div className="flex justify-between p-3 text-sm bg-yellow-50 font-semibold">
                <span className="flex items-center gap-1">Taxable Income<Tip text={TOOLTIPS.taxableIncome} /></span><span>{fmt(it14Data.taxableIncome)}</span>
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span className="flex items-center gap-1">Tax @ {rates.companyTaxRate}%<Tip text={TOOLTIPS.companyTax} /></span>
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
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Provisional Tax (IRP6)</h3>
              <p className="text-xs text-gray-500 mt-0.5">Advance payments toward your annual tax bill — paid in two installments<Tip text={TOOLTIPS.provisionalTax} /></p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h4 className="font-medium text-amber-800 flex items-center gap-1">Estimated Annual Taxable Income<Tip text="This is calculated by taking your current period's profit and projecting it over 12 months. It's an estimate — your actual annual income may differ." /></h4>
              </div>
              <p className="text-3xl font-bold text-amber-900">{fmt(provisionalData.annualizedProfit)}</p>
              <p className="text-sm text-amber-600 mt-1">Based on current period annualized</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-800 flex items-center gap-1">1st Payment (Aug)<Tip text={TOOLTIPS.firstPayment} /></span>
                </div>
                <p className="text-xl font-bold text-gray-900">{fmt(provisionalData.firstPayment)}</p>
                <p className="text-xs text-gray-500 mt-1">50% of estimated tax</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-orange-600"><Clock className="w-3 h-3" /> Due: 31 August</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-800 flex items-center gap-1">2nd Payment (Feb)<Tip text={TOOLTIPS.secondPayment} /></span>
                </div>
                <p className="text-xl font-bold text-gray-900">{fmt(provisionalData.secondPayment)}</p>
                <p className="text-xs text-gray-500 mt-1">Remaining 50%</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-orange-600"><Clock className="w-3 h-3" /> Due: 28 February</div>
              </div>
              <div className="border rounded-lg p-4 bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-800">Total Estimated Tax</span>
                </div>
                <p className="text-xl font-bold text-red-900">{fmt(provisionalData.estimatedTax)}</p>
                <p className="text-xs text-red-500 mt-1">{rates.companyTaxRate}% of taxable income</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-medium mb-1 flex items-center gap-1"><Info className="w-4 h-4" /> Important Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                <li>Under-estimation penalty applies if 2nd payment is less than 80% of actual tax<Tip text={TOOLTIPS.underEstimation} /></li>
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
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Depreciation Schedule — Section 11(e)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Track how your assets lose value over time and claim tax deductions<Tip text={TOOLTIPS.depreciation} /></p>
              </div>
              <div className="flex gap-2">
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded">{depreciationData.length} assets</span>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Annual: {fmt(totalAnnualDepreciation)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-sm text-teal-600 font-medium">Total Cost</p>
                <p className="text-xl font-bold text-teal-800">{fmt(depreciationData.reduce((s: number, a: any) => s + a.cost, 0))}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium flex items-center gap-1">Annual Depreciation<Tip text="The total amount you can deduct from your taxable income this year for wear & tear on your assets. This saves you tax!" /></p>
                <p className="text-xl font-bold text-orange-800">{fmt(totalAnnualDepreciation)}</p>
                <p className="text-xs text-orange-500 mt-1">Tax saving: {fmt(totalAnnualDepreciation * rates.companyTaxRate / 100)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium flex items-center gap-1">Total Book Value<Tip text={TOOLTIPS.bookValue} /></p>
                <p className="text-xl font-bold text-blue-800">{fmt(totalBookValue)}</p>
              </div>
            </div>

            {depreciationData.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-medium text-gray-600">Asset</th>
                      <th className="text-left p-3 font-medium text-gray-600">Category</th>
                      <th className="text-right p-3 font-medium text-gray-600">Cost</th>
                      <th className="text-right p-3 font-medium text-gray-600">Rate<Tip text={TOOLTIPS.wearAndTear} /></th>
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
                      <td className="p-3"></td>
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
                <p className="font-medium">No assets with depreciation data</p>
                <p className="text-sm mt-1">Go to the Assets page and add "Useful Life Years" and "Residual Value" to your assets to unlock tax deductions.</p>
              </div>
            )}

            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1">SARS Wear & Tear Rates Reference<Tip text="These are the standard rates SARS allows for different types of assets. Using the correct rate ensures your depreciation deductions are accepted." /></h4>
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

      {/* ===================== TAX RATE SETTINGS ===================== */}
      {sarsTab === 'settings' && (
        <TaxRateSettings rates={rates} onSave={saveRates} />
      )}
    </div>
  );
}

// ============================================
// Tax Rate Settings Component
// ============================================
function TaxRateSettings({ rates, onSave }: { rates: typeof DEFAULT_RATES; onSave: (r: typeof DEFAULT_RATES) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rates);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_RATES);
    onSave(DEFAULT_RATES);
    setEditing(false);
  };

  const fields: { key: keyof typeof DEFAULT_RATES; label: string; suffix: string; tip: string }[] = [
    { key: 'companyTaxRate', label: 'Company Tax Rate', suffix: '%', tip: 'The flat tax rate all South African companies pay on their taxable profits. Currently 27%. If SARS changes this in the budget speech, update it here.' },
    { key: 'vatRate', label: 'Standard VAT Rate', suffix: '%', tip: 'The standard Value Added Tax rate. Currently 15%. This affects all VAT calculations across the system.' },
    { key: 'uifEmployeeRate', label: 'UIF Employee Rate', suffix: '%', tip: "The percentage deducted from each employee's salary for UIF. Currently 1%." },
    { key: 'uifEmployerRate', label: 'UIF Employer Rate', suffix: '%', tip: 'The matching percentage the employer contributes to UIF. Currently 1%.' },
    { key: 'uifMaxMonthly', label: 'UIF Monthly Max (R)', suffix: '', tip: 'The maximum monthly salary amount on which UIF is calculated. Earnings above this cap are not subject to UIF. Currently R17,712/month.' },
    { key: 'sdlRate', label: 'SDL Rate', suffix: '%', tip: 'Skills Development Levy rate. Currently 1% of total payroll. Only applicable if annual payroll exceeds the SDL threshold.' },
    { key: 'sdlThreshold', label: 'SDL Annual Threshold (R)', suffix: '', tip: "The minimum annual payroll amount before SDL kicks in. If your total annual payroll is below this figure, you don't pay SDL. Currently R500,000." },
    { key: 'primaryRebate', label: 'Primary Tax Rebate (R)', suffix: '', tip: 'A tax credit available to all individual taxpayers under 65. This amount is subtracted from the tax calculated on their income. Currently R17,235.' },
    { key: 'secondaryRebate', label: 'Secondary Tax Rebate (R)', suffix: '', tip: 'Additional tax credit for taxpayers aged 65 and older. Added on top of the primary rebate. Currently R9,444.' },
    { key: 'tertiaryRebate', label: 'Tertiary Tax Rebate (R)', suffix: '', tip: 'Additional tax credit for taxpayers aged 75 and older. Added on top of primary and secondary rebates. Currently R3,145.' },
  ];

  return (
    <div className="bg-white border rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" /> Tax Rate Settings
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Update tax rates when SARS announces changes (typically during the annual Budget Speech in February)<Tip text={TOOLTIPS.taxRateSettings} /></p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => { setDraft(rates); setEditing(false); }} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </>
          ) : (
            <>
              <button onClick={handleReset} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                Reset to Defaults
              </button>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                <Pencil className="w-3.5 h-3.5" /> Edit Rates
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.key} className="border rounded-lg p-4">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-2">
              {field.label}<Tip text={field.tip} />
            </label>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={field.suffix === '%' ? '0.01' : '1'}
                  value={draft[field.key]}
                  onChange={(e) => setDraft({ ...draft, [field.key]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
                {field.suffix && <span className="text-sm text-gray-500 font-medium">{field.suffix}</span>}
              </div>
            ) : (
              <p className="text-lg font-bold text-gray-900">
                {field.suffix === '%' ? `${rates[field.key]}%` : `R ${(rates[field.key] || 0).toLocaleString()}`}
              </p>
            )}
            <p className="text-[10px] text-gray-400 mt-1">Default: {field.suffix === '%' ? `${DEFAULT_RATES[field.key]}%` : `R ${(DEFAULT_RATES[field.key] || 0).toLocaleString()}`}</p>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">When to update these rates</p>
            <ul className="list-disc list-inside text-amber-700 mt-1 space-y-0.5 text-xs">
              <li>After the annual Budget Speech (usually in February) — VAT rate, company tax rate, and tax brackets may change</li>
              <li>When the UIF or SDL contribution rates are amended by the Department of Labour</li>
              <li>Tax rebate changes usually take effect from 1 March each year</li>
              <li>These settings are saved locally — they only affect your view, not other users on this system</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
