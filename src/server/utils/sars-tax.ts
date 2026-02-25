/**
 * SARS Tax Calculations Utility
 * Based on SARS 2025/2026 tax year rates
 * Reference: https://www.sars.gov.za/tax-rates/income-tax/
 */

// ============================================
// TAX BRACKETS 2025/2026
// ============================================
export interface TaxBracket {
  min: number;
  max: number;
  rate: number; // percentage
  baseAmount: number; // tax on income below this bracket
}

// SARS 2025/2026 Tax Year (1 March 2025 - 28 February 2026)
export const TAX_BRACKETS_2025_2026: TaxBracket[] = [
  { min: 0, max: 237100, rate: 18, baseAmount: 0 },
  { min: 237101, max: 370500, rate: 26, baseAmount: 42678 },
  { min: 370501, max: 512800, rate: 31, baseAmount: 77362 },
  { min: 512801, max: 673000, rate: 36, baseAmount: 121475 },
  { min: 673001, max: 857900, rate: 39, baseAmount: 179147 },
  { min: 857901, max: 1817000, rate: 41, baseAmount: 251258 },
  { min: 1817001, max: Infinity, rate: 45, baseAmount: 644489 },
];

// Tax rebates for 2025/2026
export const TAX_REBATES_2025_2026 = {
  primary: 17235,    // All natural persons
  secondary: 9444,   // Persons 65 and older
  tertiary: 3145,    // Persons 75 and older
};

// Tax thresholds (below which no tax is payable)
export const TAX_THRESHOLDS_2025_2026 = {
  below65: 95750,
  age65to74: 148217,
  age75plus: 165689,
};

// ============================================
// UIF RATES
// ============================================
export const UIF_RATES = {
  employeeRate: 0.01,   // 1% of remuneration
  employerRate: 0.01,   // 1% of remuneration (employer's additional contribution)
  maxMonthlyEarnings: 17712, // Monthly ceiling for UIF contributions
  maxMonthlyContribution: 177.12, // Max per employee per month
};

// ============================================
// SDL (Skills Development Levy)
// ============================================
export const SDL_RATES = {
  rate: 0.01,           // 1% of total payroll
  annualThreshold: 500000, // Only payable if annual payroll > R500,000
};

// ============================================
// VAT
// ============================================
export const VAT_RATES = {
  standard: 15,
  zeroRated: 0,
  exempt: null,
};

export type VATSupplyType = 'STANDARD' | 'ZERO_RATED' | 'EXEMPT';

// ============================================
// COMPANY TAX
// ============================================
export const COMPANY_TAX_RATE = 27; // 27% for companies (from 2023 onwards)

// ============================================
// WEAR AND TEAR RATES (Section 11(e))
// Common categories used in property management
// ============================================
export const SARS_WEAR_AND_TEAR_RATES: Record<string, { rate: number; usefulLife: number; description: string }> = {
  MOTOR_VEHICLES: { rate: 25, usefulLife: 4, description: 'Motor vehicles' },
  OFFICE_FURNITURE: { rate: 16.67, usefulLife: 6, description: 'Office furniture and fittings' },
  COMPUTER_EQUIPMENT: { rate: 33.33, usefulLife: 3, description: 'Computer equipment' },
  MACHINERY: { rate: 20, usefulLife: 5, description: 'Machinery and equipment' },
  TOOLS: { rate: 33.33, usefulLife: 3, description: 'Small tools and implements' },
  SIGNAGE: { rate: 10, usefulLife: 10, description: 'Signage and displays' },
  SECURITY_EQUIPMENT: { rate: 20, usefulLife: 5, description: 'Security and surveillance equipment' },
  HVAC: { rate: 12.5, usefulLife: 8, description: 'HVAC systems' },
  PLUMBING: { rate: 10, usefulLife: 10, description: 'Plumbing fixtures' },
  ELECTRICAL: { rate: 10, usefulLife: 10, description: 'Electrical installations' },
  BUILDING_IMPROVEMENTS: { rate: 5, usefulLife: 20, description: 'Building improvements' },
  OTHER: { rate: 20, usefulLife: 5, description: 'Other assets' },
};

// ============================================
// CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate annual PAYE using SARS tax tables
 * @param annualTaxableIncome - Total annual taxable income
 * @param age - Employee age (for rebate calculation)
 * @returns Object with tax breakdown
 */
export function calculateAnnualPAYE(
  annualTaxableIncome: number,
  age: number = 30
): {
  grossTax: number;
  rebates: number;
  netTax: number;
  effectiveRate: number;
  bracket: string;
  bracketRate: number;
} {
  if (annualTaxableIncome <= 0) {
    return { grossTax: 0, rebates: 0, netTax: 0, effectiveRate: 0, bracket: 'Below threshold', bracketRate: 0 };
  }

  // Find applicable bracket
  let grossTax = 0;
  let bracketDescription = '';
  let bracketRate = 0;

  for (const bracket of TAX_BRACKETS_2025_2026) {
    if (annualTaxableIncome >= bracket.min && annualTaxableIncome <= bracket.max) {
      grossTax = bracket.baseAmount + ((annualTaxableIncome - bracket.min + 1) * bracket.rate / 100);
      bracketDescription = `R${bracket.min.toLocaleString()} - R${bracket.max === Infinity ? '∞' : bracket.max.toLocaleString()}`;
      bracketRate = bracket.rate;
      break;
    }
  }

  // Calculate rebates
  let rebates = TAX_REBATES_2025_2026.primary;
  if (age >= 65) rebates += TAX_REBATES_2025_2026.secondary;
  if (age >= 75) rebates += TAX_REBATES_2025_2026.tertiary;

  // Net tax (cannot be negative)
  const netTax = Math.max(0, grossTax - rebates);

  // Effective tax rate
  const effectiveRate = annualTaxableIncome > 0 ? (netTax / annualTaxableIncome) * 100 : 0;

  return {
    grossTax: Math.round(grossTax * 100) / 100,
    rebates,
    netTax: Math.round(netTax * 100) / 100,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    bracket: bracketDescription,
    bracketRate,
  };
}

/**
 * Calculate monthly PAYE from monthly gross salary
 * @param monthlyGross - Monthly gross salary
 * @param age - Employee age
 * @returns Monthly PAYE amount and annualized breakdown
 */
export function calculateMonthlyPAYE(
  monthlyGross: number,
  age: number = 30
): {
  monthlyPAYE: number;
  annualBreakdown: ReturnType<typeof calculateAnnualPAYE>;
} {
  const annualEquivalent = monthlyGross * 12;
  const annualBreakdown = calculateAnnualPAYE(annualEquivalent, age);
  const monthlyPAYE = Math.round((annualBreakdown.netTax / 12) * 100) / 100;

  return {
    monthlyPAYE,
    annualBreakdown,
  };
}

/**
 * Calculate UIF contributions
 * @param monthlyRemuneration - Monthly remuneration
 * @returns Employee and employer UIF contributions
 */
export function calculateUIF(monthlyRemuneration: number): {
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
} {
  const cappedRemuneration = Math.min(monthlyRemuneration, UIF_RATES.maxMonthlyEarnings);
  const employeeContribution = Math.round(cappedRemuneration * UIF_RATES.employeeRate * 100) / 100;
  const employerContribution = Math.round(cappedRemuneration * UIF_RATES.employerRate * 100) / 100;

  return {
    employeeContribution,
    employerContribution,
    totalContribution: employeeContribution + employerContribution,
  };
}

/**
 * Calculate SDL (Skills Development Levy)
 * @param monthlyPayroll - Total monthly payroll for the company
 * @param annualPayroll - Total annual payroll (to check threshold)
 * @returns SDL amount
 */
export function calculateSDL(monthlyPayroll: number, annualPayroll?: number): {
  sdlAmount: number;
  isApplicable: boolean;
  reason: string;
} {
  const estimatedAnnual = annualPayroll || monthlyPayroll * 12;
  
  if (estimatedAnnual <= SDL_RATES.annualThreshold) {
    return {
      sdlAmount: 0,
      isApplicable: false,
      reason: `Annual payroll R${estimatedAnnual.toLocaleString()} is below R${SDL_RATES.annualThreshold.toLocaleString()} threshold`,
    };
  }

  return {
    sdlAmount: Math.round(monthlyPayroll * SDL_RATES.rate * 100) / 100,
    isApplicable: true,
    reason: `1% of R${monthlyPayroll.toLocaleString()} monthly payroll`,
  };
}

/**
 * Calculate VAT amounts
 * @param amount - The amount (either inclusive or exclusive of VAT)
 * @param isInclusive - Whether the amount includes VAT
 * @param vatRate - VAT rate percentage (default 15)
 * @returns VAT breakdown
 */
export function calculateVAT(
  amount: number,
  isInclusive: boolean = true,
  vatRate: number = 15
): {
  exclusiveAmount: number;
  vatAmount: number;
  inclusiveAmount: number;
  vatRate: number;
} {
  if (vatRate === 0) {
    return { exclusiveAmount: amount, vatAmount: 0, inclusiveAmount: amount, vatRate: 0 };
  }

  const rate = vatRate / 100;

  if (isInclusive) {
    const exclusiveAmount = Math.round((amount / (1 + rate)) * 100) / 100;
    const vatAmount = Math.round((amount - exclusiveAmount) * 100) / 100;
    return { exclusiveAmount, vatAmount, inclusiveAmount: amount, vatRate };
  } else {
    const vatAmount = Math.round((amount * rate) * 100) / 100;
    const inclusiveAmount = Math.round((amount + vatAmount) * 100) / 100;
    return { exclusiveAmount: amount, vatAmount, inclusiveAmount, vatRate };
  }
}

/**
 * Calculate depreciation for an asset
 * @param purchasePrice - Original cost of the asset
 * @param residualValue - Estimated value at end of useful life
 * @param usefulLifeYears - Useful life in years
 * @param method - Depreciation method
 * @param yearNumber - Current year number (1-based, for reducing balance)
 * @returns Annual depreciation amount
 */
export function calculateDepreciation(
  purchasePrice: number,
  residualValue: number = 0,
  usefulLifeYears: number = 5,
  method: 'STRAIGHT_LINE' | 'REDUCING_BALANCE' = 'STRAIGHT_LINE',
  yearNumber: number = 1
): {
  annualDepreciation: number;
  monthlyDepreciation: number;
  bookValueAfterYear: number;
  depreciationRate: number;
} {
  const depreciableAmount = purchasePrice - residualValue;

  if (method === 'STRAIGHT_LINE') {
    const annualDepreciation = Math.round((depreciableAmount / usefulLifeYears) * 100) / 100;
    const monthlyDepreciation = Math.round((annualDepreciation / 12) * 100) / 100;
    const bookValueAfterYear = Math.max(residualValue, purchasePrice - (annualDepreciation * yearNumber));
    const depreciationRate = Math.round(((1 / usefulLifeYears) * 100) * 100) / 100;

    return { annualDepreciation, monthlyDepreciation, bookValueAfterYear, depreciationRate };
  } else {
    // Reducing balance method
    const rate = 1 - Math.pow(residualValue / purchasePrice, 1 / usefulLifeYears);
    let bookValue = purchasePrice;
    let annualDepreciation = 0;
    
    for (let i = 1; i <= yearNumber; i++) {
      annualDepreciation = Math.round((bookValue * rate) * 100) / 100;
      bookValue = bookValue - annualDepreciation;
    }

    return {
      annualDepreciation,
      monthlyDepreciation: Math.round((annualDepreciation / 12) * 100) / 100,
      bookValueAfterYear: Math.max(residualValue, Math.round(bookValue * 100) / 100),
      depreciationRate: Math.round((rate * 100) * 100) / 100,
    };
  }
}

/**
 * Generate EMP201 summary for a given month
 * @param payslips - Array of payslip data for the month
 * @param monthlyPayroll - Total monthly payroll
 * @returns EMP201 submission data
 */
export function generateEMP201Summary(
  payslips: Array<{
    grossPay: number;
    incomeTax: number;
    uif: number;
    employeeId: number;
  }>,
  monthlyPayroll: number
): {
  totalPAYE: number;
  totalEmployeeUIF: number;
  totalEmployerUIF: number;
  totalUIF: number;
  totalSDL: number;
  totalLiability: number;
  employeeCount: number;
  payrollTotal: number;
} {
  const totalPAYE = payslips.reduce((sum, p) => sum + p.incomeTax, 0);
  const totalEmployeeUIF = payslips.reduce((sum, p) => sum + p.uif, 0);
  
  // Employer UIF = matches employee UIF
  const totalEmployerUIF = totalEmployeeUIF;
  const totalUIF = totalEmployeeUIF + totalEmployerUIF;
  
  // SDL
  const sdlResult = calculateSDL(monthlyPayroll);
  const totalSDL = sdlResult.sdlAmount;

  return {
    totalPAYE: Math.round(totalPAYE * 100) / 100,
    totalEmployeeUIF: Math.round(totalEmployeeUIF * 100) / 100,
    totalEmployerUIF: Math.round(totalEmployerUIF * 100) / 100,
    totalUIF: Math.round(totalUIF * 100) / 100,
    totalSDL: Math.round(totalSDL * 100) / 100,
    totalLiability: Math.round((totalPAYE + totalUIF + totalSDL) * 100) / 100,
    employeeCount: payslips.length,
    payrollTotal: Math.round(monthlyPayroll * 100) / 100,
  };
}

/**
 * Calculate provisional tax estimate
 * @param estimatedAnnualProfit - Estimated taxable income for the year
 * @param paymentNumber - 1st (August), 2nd (February), or 3rd (top-up September)
 * @param previousPayments - Amount already paid in provisional tax
 * @returns Provisional tax payment details
 */
export function calculateProvisionalTax(
  estimatedAnnualProfit: number,
  paymentNumber: 1 | 2 | 3 = 1,
  previousPayments: number = 0
): {
  totalTaxLiability: number;
  requiredPayment: number;
  percentageOfTotal: number;
  cumulativeRequired: number;
  remainingAfterPayment: number;
} {
  const totalTaxLiability = Math.round((estimatedAnnualProfit * COMPANY_TAX_RATE / 100) * 100) / 100;

  let percentageOfTotal = 0;
  switch (paymentNumber) {
    case 1: percentageOfTotal = 50; break;  // 50% due by end of August
    case 2: percentageOfTotal = 100; break; // Full amount due by end of February
    case 3: percentageOfTotal = 100; break; // Top-up due by end of September
  }

  const cumulativeRequired = Math.round((totalTaxLiability * percentageOfTotal / 100) * 100) / 100;
  const requiredPayment = Math.max(0, Math.round((cumulativeRequired - previousPayments) * 100) / 100);
  const remainingAfterPayment = Math.max(0, Math.round((totalTaxLiability - previousPayments - requiredPayment) * 100) / 100);

  return {
    totalTaxLiability,
    requiredPayment,
    percentageOfTotal,
    cumulativeRequired,
    remainingAfterPayment,
  };
}

/**
 * IT14 Section 11 deduction categories
 */
export const SARS_DEDUCTION_SECTIONS: Record<string, string> = {
  'S11a_GENERAL': 'Section 11(a) - General deductions incurred in production of income',
  'S11b_BAD_DEBTS': 'Section 11(i) - Bad and doubtful debts',
  'S11c_LEGAL': 'Section 11(c) - Legal expenses',
  'S11d_REPAIRS': 'Section 11(d) - Repairs and maintenance',
  'S11e_DEPRECIATION': 'Section 11(e) - Wear and tear / Depreciation allowance',
  'S11f_RENT': 'Section 11(f) - Lease premiums and improvements',
  'S11gA_RESEARCH': 'Section 11(gA) - Scientific or technological research',
  'S11j_DOUBTFUL_DEBTS': 'Section 11(j) - Doubtful debts allowance',
  'S13_BUILDINGS': 'Section 13 - Building allowance',
  'S18A_DONATIONS': 'Section 18A - Donations to approved institutions',
  'S23H_PREPAID': 'Section 23H - Limitation of certain deductions (prepaid expenses)',
};

/**
 * IT14 Income source codes
 */
export const SARS_INCOME_SOURCE_CODES: Record<string, string> = {
  '4001_SALES': '4001 - Local sales and services',
  '4003_SERVICES': '4003 - Services rendered',
  '4007_RENTAL': '4007 - Rental income',
  '4010_COMMISSION': '4010 - Commission received',
  '4012_INTEREST': '4012 - Interest received',
  '4014_ROYALTIES': '4014 - Royalties received',
  '4018_MANAGEMENT_FEES': '4018 - Management fees',
  '4026_OTHER': '4026 - Other income',
};

/**
 * IRP5 Source Codes for payslip items
 */
export const IRP5_SOURCE_CODES = {
  // Income codes (3xxx)
  SALARY: '3601',
  BONUS: '3701',
  OVERTIME: '3702',
  COMMISSION: '3606',
  ALLOWANCES: '3713',
  OTHER_INCOME: '3699',
  // Deduction codes (4xxx)
  PAYE: '4101',
  UIF_EMPLOYEE: '4141',
  PENSION_FUND: '4001',
  MEDICAL_AID: '4005',
  OTHER_DEDUCTIONS: '4497',
};
