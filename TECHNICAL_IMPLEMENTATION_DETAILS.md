# Technical Implementation Details - Property Manager Portal Enhancement

## Architecture Overview

```
Property Manager Portal
├── Order Management
│   ├── CreateOrderModal (Component)
│   ├── OrdersTab (Enhanced)
│   └── createPropertyManagerOrder (tRPC)
├── Invoice Management
│   ├── CreateInvoiceModal (Component)
│   ├── InvoicesTab (Enhanced)
│   └── createInvoice (tRPC)
├── Contractor Management
│   ├── ContractorManagement (Component)
│   ├── ContractorDetailsModal (Component)
│   ├── getContractors (tRPC)
│   ├── getContractorPerformance (tRPC)
│   ├── getContractorSpending (tRPC)
│   └── getContractorDocuments (tRPC)
└── Contractor Portal
    ├── /contractor/dashboard (Route)
    ├── Tab-based interface
    └── AI Agent integration
```

---

## Component Specifications

### 1. CreateOrderModal

**File:** `src/components/property-manager/CreateOrderModal.tsx`

**Props:**
```typescript
interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**State Management:**
```typescript
const [formData, setFormData] = useState({
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  serviceType: string;
  description: string;
  callOutFee: number;
  labourRate: number;
  totalMaterialBudget: number;
  numLabourersNeeded: number;
  totalLabourCostBudget: number;
  notes: string;
});

const [materials, setMaterials] = useState<Array<{
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  supplier: string;
}>>([]);
```

**tRPC Call:**
```typescript
createOrderMutation.mutate({
  token,
  ...formData,
  materials: materials.length > 0 ? materials : undefined,
});
```

**Validation Rules:**
- Customer name: Required, min 1 character
- Email: Required, valid email format
- Phone: Required, min 1 character
- Address: Required, min 1 character
- Service type: Required
- Description: Required, min 1 character
- Order number: Optional, auto-generated if empty
- Material fields: Optional but all fields required if adding materials

**Error Handling:**
- Try-catch on token verification
- Toast notifications for errors
- Form validation before submission
- Query invalidation on success

---

### 2. CreateInvoiceModal

**File:** `src/components/property-manager/CreateInvoiceModal.tsx`

**Props:**
```typescript
interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**State Management:**
```typescript
const [formData, setFormData] = useState({
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  dueDate: string;
  notes: string;
  companyMaterialCost: number;
  companyLabourCost: number;
  tax: number;
});

const [items, setItems] = useState<InvoiceItem[]>([{
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitOfMeasure: string;
}]);
```

**Calculated Fields:**
```typescript
const subtotal = items.reduce((sum, item) => sum + item.total, 0);
const tax = formData.tax;
const total = subtotal + tax;
const estimatedProfit = total - formData.companyMaterialCost - formData.companyLabourCost;
```

**Auto-calculation:**
- Line item total: `quantity * unitPrice`
- When quantity or unitPrice changes, total recalculates
- Subtotal: Sum of all line items
- Total: Subtotal + Tax
- Estimated Profit: Total - Material Cost - Labour Cost

**tRPC Call:**
```typescript
createInvoiceMutation.mutate({
  token,
  invoiceNumber: formData.invoiceNumber || undefined,
  customerName: formData.customerName,
  customerEmail: formData.customerEmail,
  customerPhone: formData.customerPhone,
  address: formData.address,
  items,
  subtotal,
  tax,
  total,
  companyMaterialCost: formData.companyMaterialCost,
  companyLabourCost: formData.companyLabourCost,
  estimatedProfit,
  dueDate: formData.dueDate || undefined,
  notes: formData.notes || undefined,
});
```

**Validation Rules:**
- At least one line item required
- All invoice items must have description and quantity > 0
- Customer email must be valid
- Customer name required
- Address required

---

### 3. ContractorDetailsModal

**File:** `src/components/property-manager/ContractorDetailsModal.tsx`

**Props:**
```typescript
interface ContractorDetailsModalProps {
  contractor: any;
  isOpen: boolean;
  onClose: () => void;
}
```

**Data Fetching:**
```typescript
const performanceQuery = useQuery(
  trpc.getContractorPerformance.queryOptions({
    token: token || "",
    contractorId: contractor.id,
  })
);

const spendingQuery = useQuery(
  trpc.getContractorSpending.queryOptions({
    token: token || "",
    contractorId: contractor.id,
  })
);

const documentsQuery = useQuery(
  trpc.getContractorDocuments.queryOptions({
    token: token || "",
    contractorId: contractor.id,
  })
);
```

**Tab Structure:**
- **Overview**: Basic contractor info + metrics
- **Performance**: Quality metrics + satisfaction scores
- **KPIs**: Key performance indicators tracking
- **Spending**: Financial analytics
- **Documents**: File downloads

**Performance Data Model:**
```typescript
performance = {
  onTimeCompletionRate: number;
  qualityScore: number; // 0-10
  customerSatisfactionScore: number; // 0-10
  description?: string;
  kpis?: Array<{
    name: string;
    description?: string;
    value: number;
    target?: number;
  }>;
}
```

**Spending Data Model:**
```typescript
spending = {
  totalSpending: number;
  numberOfProjects: number;
  monthlySpending?: Array<{
    month: string;
    amount: number;
  }>;
}
```

**Document Data Model:**
```typescript
documents = [{
  fileName: string;
  documentType: string;
  uploadedAt: DateTime;
  url: string;
}]
```

---

### 4. Contractor Portal Dashboard

**File:** `src/routes/contractor/dashboard/index.tsx`

**Route Protection:**
```typescript
beforeLoad: ({ location }) => {
  const { user } = useAuthStore.getState();
  if (!user || user.role !== "CONTRACTOR") {
    throw redirect({
      to: "/",
      search: {
        redirect: location.href,
      },
    });
  }
}
```

**Layout:**
- Header with contractor info and logout
- Sidebar with navigation (collapsible on mobile)
- Main content area with tabs
- AI Agent widget at bottom

**Tabs:**
- Overview: Quick stats and welcome
- My Jobs: Assigned jobs list (placeholder)
- Invoices: Invoices issued (placeholder)
- Performance: Performance metrics
- Documents: Document list (placeholder)

**State Management:**
```typescript
const [activeTab, setActiveTab] = useState<"overview" | "jobs" | "invoices" | "performance" | "documents">("overview");
const [sidebarOpen, setSidebarOpen] = useState(true);
```

**Responsive Behavior:**
- Desktop: Sidebar always visible
- Tablet/Mobile: Sidebar collapsible with hamburger menu
- Modal-like sidebar on mobile

---

## Data Flow Diagrams

### Order Creation Flow
```
Property Manager
    ↓
Orders Tab (Dashboard)
    ↓
[+ Create Order] Button
    ↓
CreateOrderModal Opens
    ↓
Fill Form
    ↓
Submit
    ↓
createPropertyManagerOrder tRPC
    ↓
Backend Validation
    ↓
Database Insert
    ↓
Query Invalidation
    ↓
Orders List Updates
    ↓
Toast Success
```

### Contractor Details Flow
```
Property Manager
    ↓
Contractors Tab (Dashboard)
    ↓
ContractorManagement Component
    ↓
Search/Filter Contractors
    ↓
[Eye Icon] Click
    ↓
ContractorDetailsModal Opens
    ↓
Parallel Data Fetch:
├── getContractorPerformance
├── getContractorSpending
└── getContractorDocuments
    ↓
Tab Navigation
    ↓
Display Data
```

---

## Integration Points

### With Auth Store
```typescript
const { user, token } = useAuthStore();
```
- All modals use token for API calls
- User info displayed in contractor portal
- Logout functionality in contractor portal

### With React Query
```typescript
const queryClient = useQueryClient();

// Invalidate on success
queryClient.invalidateQueries({
  queryKey: trpc.getPropertyManagerOrders.queryKey(),
});
```
- Cache invalidation after mutations
- Automatic refetching of lists
- 30-second refetch interval for live updates

### With tRPC
```typescript
const trpc = useTRPC();

// Query usage
useQuery(trpc.getPropertyManagerOrders.queryOptions({...}))

// Mutation usage
useMutation(trpc.createPropertyManagerOrder.mutationOptions({...}))
```
- Type-safe API calls
- Automatic error handling
- Response validation

---

## Form Handling Pattern

### Controlled Components
```typescript
<input
  value={formData.customerName}
  onChange={(e) => 
    setFormData({ ...formData, customerName: e.target.value })
  }
/>
```

### Dynamic Array Handling (Materials/Items)
```typescript
// Add
const handleAddMaterial = () => {
  setMaterials([...materials, emptyMaterial]);
};

// Update
const handleMaterialChange = (index, field, value) => {
  const updated = [...materials];
  updated[index] = { ...updated[index], [field]: value };
  setMaterials(updated);
};

// Remove
const handleRemoveMaterial = (index) => {
  setMaterials(materials.filter((_, i) => i !== index));
};
```

### Form Submission
```typescript
const handleSubmit = (e) => {
  e.preventDefault();
  
  // Validation
  if (!formData.customerName) {
    toast.error("Name required");
    return;
  }
  
  // API Call
  mutation.mutate({ token, ...formData });
};
```

---

## UI Component Patterns

### Modal Pattern
```typescript
if (!isOpen) return null;

return (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
    <div className="bg-white rounded-lg max-w-2xl">
      {/* Header */}
      {/* Content */}
      {/* Footer */}
    </div>
  </div>
);
```

### Tab Pattern
```typescript
{tabs.map((tab) => (
  <button
    onClick={() => setActiveTab(tab.id)}
    className={activeTab === tab.id ? "active" : ""}
  >
    {tab.label}
  </button>
))}

{activeTab === "tab1" && <TabContent1 />}
{activeTab === "tab2" && <TabContent2 />}
```

### Form Section Pattern
```typescript
<div>
  <h3 className="text-lg font-semibold mb-4">Section Title</h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Form fields */}
  </div>
</div>
```

---

## Error Handling Strategy

### Try-Catch Blocks
```typescript
try {
  const verified = jwt.verify(input.token, env.JWT_SECRET);
} catch (error) {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Invalid or expired token",
  });
}
```

### Toast Notifications
```typescript
onSuccess: () => {
  toast.success("Order created successfully!");
},
onError: (error) => {
  toast.error(error.message || "Failed to create order.");
}
```

### Query Error States
```typescript
if (query.isLoading) {
  return <LoadingState />;
}

if (query.isError) {
  return <ErrorState />;
}

return <DataState />;
```

---

## Performance Optimizations

### Query Options
```typescript
const ordersQuery = useQuery(
  trpc.getPropertyManagerOrders.queryOptions({
    { 
      enabled: !!token,           // Only run when token exists
      refetchInterval: 30000,     // Auto-refresh every 30s
      staleTime: 30000,           // Cache valid for 30s
    }
  })
);
```

### Memoization
```typescript
const pendingOrders = useMemo(() => 
  orders.filter(o => o.status === "PENDING"),
  [orders]
);
```

### Lazy Loading
- Modals only render when `isOpen === true`
- Tab content only renders when tab is active
- Documents downloaded on-demand

---

## Testing Considerations

### Unit Tests Needed
- Form validation logic
- Calculation functions (totals, profit)
- Filter and search functions
- Role-based access control

### Integration Tests Needed
- Modal open/close flow
- Form submission with API
- Data fetching and display
- Navigation between tabs

### E2E Tests Needed
- Complete order creation flow
- Invoice creation end-to-end
- Contractor portal access
- Contractor details viewing

---

## Future Extensions

### Phase 2 APIs Expected
```typescript
// New tRPC procedures needed:
- updateOrder(id, data)
- deleteOrder(id)
- assignOrderToContractor(orderId, contractorId)
- updateContractorDocument(id, data)
- uploadContractorDocument(file, type)
- getContractorJobsAssigned(contractorId)
- getContractorInvoices(contractorId)
- updateContractorPerformance(id, metrics)
```

### Database Changes Needed
- Cascade deletes for order documents
- Contractor performance update triggers
- Spending analytics views/materialized data

### Component Enhancements
- Date range pickers for reports
- Export to PDF/CSV
- Advanced filtering
- Bulk operations

---

## Deployment Notes

### Environment Variables
- No new environment variables required
- Uses existing JWT_SECRET
- Uses existing DATABASE_URL

### Database Migrations
- No new migrations required
- Uses existing Contractor/Order/Invoice models

### Build Configuration
- TypeScript compilation required
- Tailwind CSS processing
- React Query client setup
- tRPC client setup

### Testing Before Deployment
1. ✅ All modals open/close correctly
2. ✅ Form validation works
3. ✅ API calls succeed
4. ✅ Error handling displays properly
5. ✅ Role-based access enforced
6. ✅ Mobile responsiveness works
7. ✅ AI Agent accessible

---

**Documentation Version:** 1.0
**Last Updated:** December 2024
**Status:** Complete
