# Contractor Management & Financial Reporting - API Reference

## Overview
Complete API reference for all 13 new tRPC procedures for Contractor Management and Financial Reporting.

---

## Contractor Management Procedures

### 1. createContractor
**Purpose**: Create a new contractor record

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token (PROPERTY_MANAGER required)
  name: string;                     // Contractor name
  email: string;                    // Contact email
  phone: string;                    // Phone number
  serviceTypes: string[];           // Array of service type IDs (Plumbing, Electrical, etc.)
  bankAccountNumber?: string;       // Bank account for payments
  bankBranchCode?: string;          // Bank branch code
  password?: string;                // Initial password for contractor portal
}
```

**Output**:
```typescript
{
  id: number;
  name: string;
  email: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
  serviceTypes: Array<{
    id: number;
    name: string;
  }>;
  bankAccountNumber?: string;
  bankBranchCode?: string;
  createdAt: Date;
}
```

**Errors**:
- `UNAUTHORIZED` - Not a property manager
- `BAD_REQUEST` - Missing required fields

**Example**:
```typescript
const newContractor = await trpc.createContractor.mutate({
  token: authToken,
  name: "John's Plumbing",
  email: "john@plumbing.co.za",
  phone: "+27123456789",
  serviceTypes: ["1", "2"], // Plumbing, Repairs
  bankAccountNumber: "123456789",
  bankBranchCode: "654321"
});
```

---

### 2. getContractors
**Purpose**: Retrieve contractors with filtering, search, and pagination

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  serviceTypeId?: string;           // Filter by service type
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
  search?: string;                  // Search by name or email
  limit?: number;                   // Results per page (default: 10)
  offset?: number;                  // Pagination offset (default: 0)
}
```

**Output**:
```typescript
Array<{
  id: number;
  name: string;
  email: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
  serviceTypes: Array<{
    id: number;
    name: string;
  }>;
  jobsCompleted: number;
  averageRating: number;            // 1-5 stars
  onTimePercentage: number;         // 0-100
  totalSpend: number;               // Total amount paid to contractor
  documentsCount: number;
  kpisCount: number;
  createdAt: Date;
}>
```

**Errors**:
- `UNAUTHORIZED` - Authentication required

**Example**:
```typescript
const contractors = await trpc.getContractors.query({
  token: authToken,
  serviceTypeId: "1",               // Only plumbers
  status: "ACTIVE",
  search: "john",
  limit: 20,
  offset: 0
});
```

---

### 3. updateContractor
**Purpose**: Update contractor details

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  contractorId: number;             // Contractor to update
  name?: string;
  email?: string;
  phone?: string;
  serviceTypes?: string[];          // Replace all service types
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
  bankAccountNumber?: string;
  bankBranchCode?: string;
}
```

**Output**:
```typescript
{
  id: number;
  name: string;
  email: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
  serviceTypes: Array<{
    id: number;
    name: string;
  }>;
  updatedAt: Date;
}
```

**Errors**:
- `UNAUTHORIZED` - Not property manager or not owner
- `NOT_FOUND` - Contractor doesn't exist

**Example**:
```typescript
const updated = await trpc.updateContractor.mutate({
  token: authToken,
  contractorId: 1,
  status: "SUSPENDED",
  name: "John's Premium Plumbing"
});
```

---

### 4. deleteContractor
**Purpose**: Delete contractor (soft delete - marks as ARCHIVED)

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  contractorId: number;             // Contractor to delete
}
```

**Output**:
```typescript
{
  success: boolean;
  message: string;
  contractorId: number;
}
```

**Errors**:
- `UNAUTHORIZED` - Not property manager or not owner
- `NOT_FOUND` - Contractor doesn't exist

**Example**:
```typescript
const result = await trpc.deleteContractor.mutate({
  token: authToken,
  contractorId: 1
});
```

---

### 5. uploadContractorDocument
**Purpose**: Upload and store contractor documents

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  contractorId: number;             // Contractor owner
  documentType: "CONTRACT" | "ID_DOCUMENT" | "QUALIFICATION" | 
               "CERTIFICATE" | "PERFORMANCE_REVIEW" | "WARNING" | "OTHER";
  url: string;                      // Document URL (from MinIO)
  title: string;                    // Document title/name
  description?: string;             // Additional details
  expiryDate?: Date;               // When document expires
}
```

**Output**:
```typescript
{
  id: number;
  contractorId: number;
  documentType: string;
  url: string;
  title: string;
  description?: string;
  expiryDate?: Date;
  uploadDate: Date;
}
```

**Errors**:
- `UNAUTHORIZED` - Not property manager
- `NOT_FOUND` - Contractor doesn't exist
- `BAD_REQUEST` - Invalid document type or missing fields

**Example**:
```typescript
const doc = await trpc.uploadContractorDocument.mutate({
  token: authToken,
  contractorId: 1,
  documentType: "CERTIFICATE",
  url: "minio://certificates/john-plumbing-cert-2024.pdf",
  title: "Plumbing License 2024",
  expiryDate: new Date("2025-12-31")
});
```

---

### 6. getContractorDocuments
**Purpose**: Retrieve all documents for a contractor

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  contractorId: number;             // Contractor to fetch documents for
  documentType?: string;            // Optional filter by type
}
```

**Output**:
```typescript
Array<{
  id: number;
  contractorId: number;
  documentType: string;
  url: string;
  title: string;
  description?: string;
  expiryDate?: Date;
  uploadDate: Date;
  isExpired: boolean;               // Calculated field
  daysUntilExpiry?: number;        // null if no expiry date
}>
```

**Errors**:
- `UNAUTHORIZED` - Authentication required
- `NOT_FOUND` - Contractor doesn't exist

**Example**:
```typescript
const docs = await trpc.getContractorDocuments.query({
  token: authToken,
  contractorId: 1,
  documentType: "CERTIFICATE"       // Optional filter
});
```

---

### 7. createContractorKPI
**Purpose**: Create performance KPI for a contractor

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  contractorId: number;             // Contractor to track
  kpiName: string;                  // e.g., "On-Time Delivery %"
  description?: string;
  targetValue: number;              // e.g., 95
  unit: string;                     // e.g., "%", "days", "count"
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  periodStart: Date;
  periodEnd: Date;
}
```

**Output**:
```typescript
{
  id: number;
  contractorId: number;
  kpiName: string;
  description?: string;
  targetValue: number;
  unit: string;
  frequency: string;
  periodStart: Date;
  periodEnd: Date;
  currentValue?: number;            // Latest achievement
  achievementRate?: number;         // Percentage of target
  createdAt: Date;
}
```

**Errors**:
- `UNAUTHORIZED` - Not property manager
- `NOT_FOUND` - Contractor doesn't exist
- `BAD_REQUEST` - Invalid frequency or date range

**Example**:
```typescript
const kpi = await trpc.createContractorKPI.mutate({
  token: authToken,
  contractorId: 1,
  kpiName: "Monthly Completion Rate",
  targetValue: 100,
  unit: "%",
  frequency: "MONTHLY",
  periodStart: new Date("2025-01-01"),
  periodEnd: new Date("2025-01-31")
});
```

---

### 8. getContractorPerformance
**Purpose**: Get comprehensive performance metrics for a contractor

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  contractorId: number;             // Contractor to analyze
}
```

**Output**:
```typescript
{
  contractorId: number;
  name: string;
  
  // Performance Metrics
  jobsCompleted: number;
  onTimePercentage: number;         // 0-100
  qualityRating: number;            // 1-5 stars
  responseTime: number;             // Average hours
  
  // KPI Status
  kpis: Array<{
    id: number;
    name: string;
    targetValue: number;
    currentValue: number;
    achievementRate: number;        // 0-100
    status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
  }>;
  
  // Historical Trends
  trends: Array<{
    month: string;
    jobsCompleted: number;
    averageRating: number;
    onTimePercentage: number;
  }>;
  
  // Overall Rating
  overallRating: "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR" | "UNKNOWN";
  ratingReason: string;
}
```

**Errors**:
- `UNAUTHORIZED` - Authentication required
- `NOT_FOUND` - Contractor doesn't exist

**Example**:
```typescript
const performance = await trpc.getContractorPerformance.query({
  token: authToken,
  contractorId: 1
});
console.log(`${performance.name}: ${performance.overallRating}`);
```

---

### 9. getContractorSpending
**Purpose**: Analyze spending across contractors

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  startDate?: Date;                 // Analysis period start
  endDate?: Date;                   // Analysis period end
}
```

**Output**:
```typescript
{
  totalSpending: number;            // All contractors combined
  periodStart: Date;
  periodEnd: Date;
  
  // Per Contractor
  byContractor: Array<{
    contractorId: number;
    name: string;
    totalSpent: number;
    jobsCompleted: number;
    costPerJob: number;
    averageRating: number;
    percentageOfTotal: number;      // % of total spending
  }>;
  
  // Analytics
  topSpenders: Array<{
    contractorId: number;
    name: string;
    totalSpent: number;
  }>;
  
  trends: Array<{
    month: string;
    totalSpent: number;
    jobsCount: number;
  }>;
}
```

**Errors**:
- `UNAUTHORIZED` - Authentication required

**Example**:
```typescript
const spending = await trpc.getContractorSpending.query({
  token: authToken,
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-12-31")
});
console.log(`Total spending: R${spending.totalSpending.toLocaleString()}`);
```

---

## Financial Reporting Procedures

### 10. createPropertyFinancialMetrics
**Purpose**: Record financial metrics for a property

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  propertyId: number;               // Building/property ID
  periodStart: Date;
  periodEnd: Date;
  
  // Revenue
  totalRentalIncome: number;
  maintenanceFees: number;
  otherIncome: number;
  
  // Expenses
  maintenanceExpenses: number;
  utilities: number;
  propertyTax: number;
  insurance: number;
  staffSalaries: number;
  contractorPayments: number;
  
  // Balance Sheet
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}
```

**Output**:
```typescript
{
  id: number;
  propertyId: number;
  periodStart: Date;
  periodEnd: Date;
  
  revenue: {
    totalRentalIncome: number;
    maintenanceFees: number;
    otherIncome: number;
    totalIncome: number;
  };
  
  expenses: {
    maintenanceExpenses: number;
    utilities: number;
    propertyTax: number;
    insurance: number;
    staffSalaries: number;
    contractorPayments: number;
    totalExpenses: number;
  };
  
  profitAndLoss: {
    operatingProfit: number;
    profitMargin: number;           // Percentage
  };
  
  balanceSheet: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  
  createdAt: Date;
}
```

**Errors**:
- `UNAUTHORIZED` - Not property manager
- `NOT_FOUND` - Property doesn't exist
- `BAD_REQUEST` - Invalid data or date range

**Example**:
```typescript
const metrics = await trpc.createPropertyFinancialMetrics.mutate({
  token: authToken,
  propertyId: 1,
  periodStart: new Date("2025-01-01"),
  periodEnd: new Date("2025-01-31"),
  totalRentalIncome: 50000,
  maintenanceFees: 5000,
  otherIncome: 1000,
  maintenanceExpenses: 8000,
  utilities: 3000,
  propertyTax: 2000,
  insurance: 1500,
  staffSalaries: 5000,
  contractorPayments: 4000,
  totalAssets: 500000,
  totalLiabilities: 200000,
  totalEquity: 300000
});
```

---

### 11. getPropertyFinancialReport
**Purpose**: Generate comprehensive financial report for a property

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  propertyId: number;               // Building to report on
  reportType: "INCOME_STATEMENT" | "BALANCE_SHEET" | "CASH_FLOW";
  periodStart: Date;
  periodEnd: Date;
}
```

**Output**:
```typescript
{
  propertyId: number;
  propertyName: string;
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  
  // For INCOME_STATEMENT
  incomeStatements?: Array<{
    period: string;
    revenue: {
      totalRentalIncome: number;
      maintenanceFees: number;
      otherIncome: number;
      totalIncome: number;
    };
    expenses: {
      maintenanceExpenses: number;
      utilities: number;
      propertyTax: number;
      insurance: number;
      staffSalaries: number;
      contractorPayments: number;
      totalExpenses: number;
    };
    profitAndLoss: {
      operatingProfit: number;
      profitMargin: number;
    };
  }>;
  
  // For BALANCE_SHEET
  balanceSheets?: Array<{
    period: string;
    assets: {
      totalPropertyValue: number;
      totalDeposits: number;
      totalAssets: number;
    };
    liabilities: {
      totalMortgages: number;
      totalLoans: number;
      totalLiabilities: number;
    };
    equity: {
      totalEquity: number;
    };
    ratios: {
      debtToEquityRatio: number;
      returnOnAssets: number;
    };
  }>;
  
  // For CASH_FLOW
  cashFlowStatements?: Array<{
    period: string;
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    netCashFlow: number;
    beginningBalance: number;
    endingBalance: number;
  }>;
}
```

**Errors**:
- `UNAUTHORIZED` - Not property manager
- `NOT_FOUND` - Property doesn't exist
- `BAD_REQUEST` - Invalid report type or date range

---

### 12. createPMFinancialMetrics
**Purpose**: Record consolidated financial metrics for property manager

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  periodStart: Date;
  periodEnd: Date;
  
  // Consolidated figures across all properties
  totalRevenue: number;
  totalExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}
```

**Output**:
```typescript
{
  id: number;
  propertyManagerId: number;
  periodStart: Date;
  periodEnd: Date;
  
  totalRevenue: number;
  totalExpenses: number;
  netOperatingIncome: number;
  
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  
  createdAt: Date;
}
```

---

### 13. getPMFinancialReport
**Purpose**: Generate consolidated financial report for property manager

**Input Parameters**:
```typescript
{
  token: string;                    // Authentication token
  reportType: "INCOME_STATEMENT" | "BALANCE_SHEET" | "CASH_FLOW";
  periodStart: Date;
  periodEnd: Date;
}
```

**Output**:
```typescript
{
  propertyManagerId: number;
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  propertiesIncluded: number;
  
  // Same structure as property reports but aggregated
  incomeStatements?: Array<{...}>;
  balanceSheets?: Array<{...}>;
  cashFlowStatements?: Array<{...}>;
  
  summary: {
    latestPeriod: {
      totalRevenue: number;
      totalExpenses: number;
      operatingProfit: number;
      operatingCashFlow: number;
      netCashFlow: number;
    };
    totals: {
      totalRevenue: number;
      totalExpenses: number;
      totalNetCashFlow: number;
    };
  };
}
```

---

## Error Codes

All procedures use standard tRPC error codes:

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | User not authenticated or lacks required role |
| `FORBIDDEN` | User authenticated but lacks permission for this resource |
| `NOT_FOUND` | Resource doesn't exist |
| `BAD_REQUEST` | Invalid input data or parameters |
| `INTERNAL_SERVER_ERROR` | Server error (see logs) |

---

## Usage Tips

### TypeScript with React Query
```typescript
const { data, isLoading, error } = useQuery(
  trpc.getContractors.queryOptions({ token })
);

const mutation = useMutation(
  trpc.createContractor.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => toast.error(err.message)
  })
);

await mutation.mutateAsync({ token, name, email, ... });
```

### Error Handling
```typescript
try {
  const result = await trpc.createContractor.mutate(input);
} catch (error) {
  if (error instanceof TRPCClientError) {
    console.error(error.data?.zodError);  // Validation errors
    console.error(error.message);          // Error message
  }
}
```

### Pagination
```typescript
const page1 = await trpc.getContractors.query({ 
  token, 
  limit: 10, 
  offset: 0 
});

const page2 = await trpc.getContractors.query({ 
  token, 
  limit: 10, 
  offset: 10 
});
```

---

**API Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Production Ready
