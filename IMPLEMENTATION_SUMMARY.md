# Implementation Summary - Remaining Tasks

## Completed ✅
1. **Fixed Artisan Portal Order Summary Download**
   - Added PM order support to generateOrderPdf procedure
   - Added isPMOrder flag to order summary download
   - Improved error messages with 10-second duration

## Remaining Tasks 📋

### 1. Property Manager Portal - Order Summary Download
**Files to modify:**
- `src/routes/property-manager/orders/index.tsx` (or similar)
- Add download button similar to artisan portal
- Use existing `generateOrderPdf` mutation with `isPMOrder: true`

### 2. Rate Completed Work Form - Add Scroll
**File to modify:**
- Find the Rate Completed Work modal/form
- Add CSS: `overflow-y: auto`, `max-height: 80vh`
- Ensure modal body is scrollable

### 3. Contractor Portal - Order Summary & Job Card Downloads
**Files to modify:**
- `src/routes/contractor/operations/index.tsx`
- Add two buttons for completed orders:
  1. "Download Order Summary" - uses `generateOrderPdf`
  2. "Download Job Card" - uses `generateJobCardPdf`
- Include financial information in order summary

### 4. Contractor Portal - Show Completed Jobs in Invoicing (Draft)
**Files to modify:**
- `src/routes/contractor/invoices/index.tsx`
- Query completed orders without invoices
- Display in "Draft" section
- Allow creating invoices from completed orders

## Implementation Priority
1. Property Manager order summary download (QUICK)
2. Scroll fix for Rate form (QUICK)
3. Contractor downloads (MEDIUM)
4. Contractor invoicing integration (MEDIUM)

## Notes
- All mutations already exist in tRPC
- generateOrderPdf now supports both Order and PropertyManagerOrder
- generateJobCardPdf already exists
- Invoice creation flow already exists
