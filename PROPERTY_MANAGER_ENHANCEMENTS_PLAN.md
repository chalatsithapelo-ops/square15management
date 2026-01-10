# Property Manager Portal Enhancement Plan

## Overview
Comprehensive enhancements to the Property Manager portal including form improvements, PDF functionality, settings page, and bug fixes.

## 1. CreateOrderModal Enhancements

### Changes Required:
- ✅ Make all budget fields optional (no validation required)
- ✅ Add contractor selection dropdown from database
- ✅ Add manual entry toggle for contractor details
- ✅ Add building/property selection dropdown
- ✅ Auto-fill contractor details when selected from dropdown
- ✅ Link order to building budget for expense tracking

### Implementation:
```typescript
// Add state
const [selectedContractor, setSelectedContractor] = useState<string>("");
const [selectedBuilding, setSelectedBuilding] = useState<string>("");
const [useManualEntry, setUseManualEntry] = useState(false);

// Fetch contractors and buildings
const contractorsQuery = useQuery({
  ...trpc.getContractors.queryOptions({ token: token || "" }),
  enabled: !!token,
});

const buildingsQuery = useQuery({
  ...trpc.getBuildings.queryOptions({ token: token || "" }),
  enabled: !!token,
});

// Handle contractor selection
const handleContractorSelect = (contractorId: string) => {
  const contractor = contractors.find((c: any) => c.id === parseInt(contractorId));
  if (contractor) {
    setFormData({
      ...formData,
      companyName: contractor.companyName || `${contractor.firstName} ${contractor.lastName}`,
      companyEmail: contractor.email,
      companyPhone: contractor.phone,
      contactPerson: `${contractor.firstName} ${contractor.lastName}`,
    });
  }
};
```

### UI Changes:
```tsx
{/* Contractor Selection */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <label className="text-sm font-medium text-gray-700">Contractor</label>
    <button
      type="button"
      onClick={() => setUseManualEntry(!useManualEntry)}
      className="text-sm text-teal-600 hover:text-teal-700"
    >
      {useManualEntry ? "Select from Database" : "Manual Entry"}
    </button>
  </div>
  
  {!useManualEntry && (
    <select
      value={selectedContractor}
      onChange={(e) => {
        setSelectedContractor(e.target.value);
        handleContractorSelect(e.target.value);
      }}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    >
      <option value="">Select Contractor</option>
      {contractors.map((contractor: any) => (
        <option key={contractor.id} value={contractor.id}>
          {contractor.companyName || `${contractor.firstName} ${contractor.lastName}`}
        </option>
      ))}
    </select>
  )}
</div>

{/* Building Selection */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Building/Property
  </label>
  <select
    value={selectedBuilding}
    onChange={(e) => setSelectedBuilding(e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
  >
    <option value="">Select Building</option>
    {buildings.map((building: any) => (
      <option key={building.id} value={building.id}>
        {building.name} - {building.address}
      </option>
    ))}
  </select>
</div>
```

## 2. CreateRFQModal - Contractor Recipients

### Changes Required:
- Add multi-select checkbox list for contractors
- Allow selecting multiple contractors to receive RFQ
- Pass selected contractor IDs to backend

### Implementation:
```typescript
const [selectedContractors, setSelectedContractors] = useState<number[]>([]);

const handleContractorToggle = (contractorId: number) => {
  setSelectedContractors(prev =>
    prev.includes(contractorId)
      ? prev.filter(id => id !== contractorId)
      : [...prev, contractorId]
  );
};
```

### UI:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Select Contractors to Receive RFQ
  </label>
  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
    {contractors.map((contractor: any) => (
      <label key={contractor.id} className="flex items-center space-x-2 cursor-pointer">
        <input
          type="checkbox"
          checked={selectedContractors.includes(contractor.id)}
          onChange={() => handleContractorToggle(contractor.id)}
          className="rounded text-teal-600"
        />
        <span className="text-sm text-gray-700">
          {contractor.companyName || `${contractor.firstName} ${contractor.lastName}`}
        </span>
      </label>
    ))}
  </div>
</div>
```

## 3. CreateInvoiceModal - UoM & Auto VAT

### Changes Required:
- Add Unit of Measure (UoM) field before Qty
- Remove manual VAT input
- Calculate VAT automatically at 15%
- Update total calculation: subtotal + VAT

### Implementation:
```typescript
// Update InvoiceItem interface
interface InvoiceItem {
  description: string;
  unitOfMeasure: string; // NEW
  quantity: number;
  unitPrice: number;
  total: number;
}

// Auto-calculate VAT
const subtotal = items.reduce((sum, item) => sum + item.total, 0);
const vat = subtotal * 0.15; // 15% VAT
const total = subtotal + vat;
```

### UI Changes:
```tsx
{/* Invoice Items Table */}
<table className="w-full">
  <thead>
    <tr>
      <th>Description</th>
      <th>UoM</th> {/* NEW */}
      <th>Qty</th>
      <th>Unit Price</th>
      <th>Total</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    {items.map((item, index) => (
      <tr key={index}>
        <td>
          <input
            value={item.description}
            onChange={(e) => handleItemChange(index, "description", e.target.value)}
          />
        </td>
        <td>
          <select
            value={item.unitOfMeasure}
            onChange={(e) => handleItemChange(index, "unitOfMeasure", e.target.value)}
          >
            <option value="pcs">Pieces</option>
            <option value="hrs">Hours</option>
            <option value="m">Meters</option>
            <option value="m2">Square Meters</option>
            <option value="kg">Kilograms</option>
            <option value="l">Liters</option>
            <option value="unit">Unit</option>
          </select>
        </td>
        <td>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
          />
        </td>
        {/* ... rest of fields */}
      </tr>
    ))}
  </tbody>
</table>

{/* Summary Section */}
<div className="space-y-2">
  <div className="flex justify-between">
    <span>Subtotal:</span>
    <span>R{subtotal.toFixed(2)}</span>
  </div>
  <div className="flex justify-between text-green-600">
    <span>VAT (15%):</span>
    <span>R{vat.toFixed(2)}</span>
  </div>
  <div className="flex justify-between font-bold text-lg">
    <span>Total:</span>
    <span>R{total.toFixed(2)}</span>
  </div>
</div>
```

## 4. CreateMaintenanceRequestModal Updates

### Changes Required:
- Add contractor dropdown with manual entry option
- Add building selection
- Link to building budget

### Similar implementation to CreateOrderModal above.

## 5. AddExpenseModal Scroll Fix

### Changes Required:
Convert to proper flex-col scroll structure

### Implementation:
```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
  <div className="bg-white rounded-xl shadow-xl max-w-lg w-full flex flex-col max-h-[90vh]">
    {/* Header - Sticky */}
    <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <h3 className="text-lg font-semibold text-gray-900">Add Expense</h3>
      <button onClick={onClose}>
        <X className="h-6 w-6" />
      </button>
    </div>

    {/* Form - Scrollable */}
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Form fields */}
    </form>

    {/* Footer - Sticky */}
    <div className="flex-shrink-0 flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
      <button type="button" onClick={onClose}>Cancel</button>
      <button type="submit">Add Expense</button>
    </div>
  </div>
</div>
```

## 6. PhotoUpload Error Fix

### Debug Steps:
1. Check MinIO service status
2. Verify environment variables
3. Check file upload endpoint
4. Add error logging

### Investigation Points:
```bash
# Check MinIO container
docker ps | grep minio

# Check MinIO logs
docker logs docker-minio-1

# Verify .env has:
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=property-management
```

### Error Handling:
```typescript
// In PhotoUpload component
const handleUpload = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Upload error:', error);
      throw new Error(error.message || 'Upload failed');
    }
    
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Photo upload error:', error);
    toast.error('Failed to upload image. Please try again.');
    throw error;
  }
};
```

## 7. PDF Export/Upload Implementation

### Required Libraries:
```bash
npm install jspdf jspdf-autotable
npm install @react-pdf/renderer
```

### Implementation:
```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// PDF Generation for Order
const generateOrderPDF = (orderData: any) => {
  const doc = new jsPDF();
  
  // Company Header
  doc.setFontSize(20);
  doc.text('WORK ORDER', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Order #: ${orderData.orderNumber}`, 20, 40);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 45);
  
  // Contractor Details
  doc.text('CONTRACTOR:', 20, 60);
  doc.text(orderData.companyName, 20, 65);
  doc.text(orderData.companyEmail, 20, 70);
  doc.text(orderData.companyPhone, 20, 75);
  
  // Work Details
  doc.text('WORK DETAILS:', 20, 90);
  doc.text(`Address: ${orderData.address}`, 20, 95);
  doc.text(`Service Type: ${orderData.serviceType}`, 20, 100);
  doc.text(`Description: ${orderData.description}`, 20, 105);
  
  // Budget Information (if provided)
  if (orderData.callOutFee || orderData.labourRate) {
    doc.text('BUDGET:', 20, 120);
    let y = 125;
    if (orderData.callOutFee) {
      doc.text(`Call Out Fee: R${orderData.callOutFee}`, 20, y);
      y += 5;
    }
    if (orderData.labourRate) {
      doc.text(`Labour Rate: R${orderData.labourRate}/hr`, 20, y);
      y += 5;
    }
  }
  
  // Materials Table
  if (orderData.materials && orderData.materials.length > 0) {
    autoTable(doc, {
      startY: 140,
      head: [['Material', 'Quantity', 'Unit Price', 'Total']],
      body: orderData.materials.map((m: any) => [
        m.name,
        m.quantity,
        `R${m.unitPrice}`,
        `R${(m.quantity * m.unitPrice).toFixed(2)}`
      ]),
    });
  }
  
  return doc;
};

// Export PDF
const handleExportOrderPDF = () => {
  const doc = generateOrderPDF(formData);
  doc.save(`Order-${formData.orderNumber || 'Draft'}.pdf`);
  toast.success('PDF exported successfully!');
};

// Upload PDF
const handleUploadPDF = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'order');
  
  const response = await fetch('/api/upload/pdf', {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  return data.url;
};
```

### Add PDF Buttons to Forms:
```tsx
{/* PDF Actions */}
<div className="flex gap-2">
  <button
    type="button"
    onClick={handleExportOrderPDF}
    className="px-4 py-2 text-teal-600 border border-teal-600 rounded-lg hover:bg-teal-50"
  >
    📄 Export PDF
  </button>
  <label className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 cursor-pointer">
    📎 Upload PDF
    <input
      type="file"
      accept=".pdf"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleUploadPDF(file);
      }}
      className="hidden"
    />
  </label>
</div>
```

## 8. Property Manager Settings Page

### Create Route:
File: `src/routes/property-manager/settings/index.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { Settings, Save } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/property-manager/settings/")({
  component: PropertyManagerSettings,
});

function PropertyManagerSettings() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  
  // Similar structure to admin settings but for PM customization
  // Include:
  // - Portal theme customization
  // - Notification preferences
  // - Default settings for forms
  // - Email templates
  
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Customize your Property Manager portal</p>
      </div>
      
      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Portal Preferences */}
        <SettingsSection title="Portal Preferences">
          {/* Theme, layout, etc */}
        </SettingsSection>
        
        {/* Notification Settings */}
        <SettingsSection title="Notifications">
          {/* Email, SMS preferences */}
        </SettingsSection>
        
        {/* Default Values */}
        <SettingsSection title="Default Form Values">
          {/* Pre-fill common values */}
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}
```

### Add to Navigation:
In Property Manager dashboard, add Settings card/link similar to admin portal.

## 9. Backend Updates Needed

### Update tRPC Procedures:

#### createPropertyManagerOrder.ts
```typescript
// Add optional buildingId
input: z.object({
  token: z.string(),
  buildingId: z.number().optional(), // NEW
  contractorId: z.number().optional(), // NEW
  // ... existing fields
  // Make budget fields optional
  callOutFee: z.number().optional(),
  labourRate: z.number().optional(),
  totalMaterialBudget: z.number().optional(),
  // ...
})
```

#### createPropertyManagerRFQ.ts
```typescript
// Add contractor recipients
input: z.object({
  token: z.string(),
  contractorIds: z.array(z.number()).optional(), // NEW
  // ... existing fields
})
```

#### createInvoice.ts
```typescript
// Update invoice items to include UoM
items: z.array(z.object({
  description: z.string(),
  unitOfMeasure: z.string(), // NEW
  quantity: z.number(),
  unitPrice: z.number(),
}))
```

## 10. Database Schema Updates

### Update Prisma Schema:

```prisma
model Order {
  // ... existing fields
  buildingId    Int?
  building      Building? @relation(fields: [buildingId], references: [id])
  contractorId  Int?
  contractor    Contractor? @relation(fields: [contractorId], references: [id])
  pdfUrl        String?
}

model RFQ {
  // ... existing fields
  contractorIds Int[]
  pdfUrl        String?
}

model Invoice {
  // ... existing fields
  pdfUrl        String?
}

model InvoiceItem {
  // ... existing fields
  unitOfMeasure String
}

model MaintenanceRequest {
  // ... existing fields
  buildingId    Int?
  building      Building? @relation(fields: [buildingId], references: [id])
  contractorId  Int?
  contractor    Contractor? @relation(fields: [contractorId], references: [id])
  pdfUrl        String?
}
```

## Implementation Priority

1. **HIGH** - Fix CreateOrderModal (budget optional, contractor/building dropdowns)
2. **HIGH** - Fix AddExpenseModal scroll
3. **HIGH** - Fix CreateInvoiceModal (UoM, auto VAT)
4. **MEDIUM** - Update CreateRFQModal (contractor selection)
5. **MEDIUM** - Update CreateMaintenanceRequestModal
6. **MEDIUM** - Debug PhotoUpload
7. **LOW** - Implement PDF export/upload
8. **LOW** - Create Settings page

## Testing Checklist

- [ ] Order creation without budget works
- [ ] Contractor selection from dropdown works
- [ ] Building selection works
- [ ] Manual contractor entry works
- [ ] RFQ can select multiple contractors
- [ ] Invoice UoM dropdown works
- [ ] Invoice VAT calculates automatically at 15%
- [ ] Maintenance request has contractor/building dropdowns
- [ ] AddExpenseModal scrolls properly
- [ ] Images upload successfully
- [ ] PDF export works for all forms
- [ ] PDF upload works
- [ ] Settings page loads
- [ ] All forms work on mobile

## Deployment Steps

1. Run Prisma migration: `npx prisma migrate dev`
2. Build application: `npm run build`
3. Rebuild Docker: `docker compose -f docker/compose.yaml up -d --build app`
4. Test all functionality
5. Monitor logs for errors
