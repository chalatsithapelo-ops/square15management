# Order Layout Consolidation - Complete

## Problem Fixed

The contractor portal was displaying orders twice:
1. **Regular Orders Section**: Showing all orders (regular + PM orders combined) with the new unified layout
2. **Property Manager Orders Section**: Showing PM orders again separately

This created duplicate displays and confusion about which orders were which.

## Solution Implemented

### Contractor Portal (`src/routes/contractor/operations/index.tsx`)

#### 1. Removed Duplicate PM Orders Section
- **Lines Removed**: ~1861-2043 (entire separate PM orders section)
- **Reason**: PM orders are already included in the `combinedOrders` array which feeds into `filteredOrders`

#### 2. Enhanced Unified Orders Display
- All orders (regular + PM) now display in a single "Orders List" section
- Added conditional button rendering based on order type:

**For Property Manager Orders (`isPropertyManagerOrder === true`):**
- **Accept & Start** button (when status is SUBMITTED)
- **Assign to Artisan** dropdown (when status is SUBMITTED)
- **Contact PM** button (always shown)
- **Export** button
- **Upload** button

**For Regular Orders (`isPropertyManagerOrder === false`):**
- **Edit** button
- **Export** button
- **Upload** button

#### 3. Fixed Minor Issues
- Removed duplicate `onClick` handler on Edit button (line ~1817)
- Maintained click-outside-to-close functionality for artisan dropdown
- Preserved all existing mutations and queries

## Technical Details

### Order Merging Logic
```typescript
const combinedOrders = useMemo(() => {
  const adminOrders = ordersQuery.data || [];
  const propertyManagerOrders = pmOrdersQuery.data || [];

  const normalizedPmOrders = propertyManagerOrders.map((pmOrder) => ({
    // ... normalized fields ...
    isPropertyManagerOrder: true, // Flag to identify PM orders
    rawObject: pmOrder, // Keep original for detailed access
  }));

  return [...adminOrders, ...normalizedPmOrders];
}, [ordersQuery.data, pmOrdersQuery.data]);
```

### Conditional Button Rendering
```typescript
{/* PM order specific buttons */}
{(order as any).isPropertyManagerOrder && order.status === 'SUBMITTED' && (
  <button>Accept & Start</button>
  <button>Assign to Artisan</button>
)}

{/* Regular order edit button */}
{!(order as any).isPropertyManagerOrder && (
  <button>Edit</button>
)}

{/* PM contact button */}
{(order as any).isPropertyManagerOrder && (order as any).rawObject?.propertyManager && (
  <a href={`mailto:...`}>Contact PM</a>
)}
```

## Benefits

✅ **Single Unified View**: All orders in one list with consistent layout
✅ **No Duplicates**: Each order appears exactly once
✅ **Context-Aware Actions**: Buttons adapt based on order type
✅ **Cleaner Interface**: Reduced visual clutter and confusion
✅ **Better UX**: Users see all their work in one place

## Testing Checklist

- [ ] PM orders appear in the main orders list
- [ ] Regular orders appear in the main orders list
- [ ] No duplicate order cards
- [ ] Accept & Start works for PM orders
- [ ] Assign to Artisan dropdown works for PM orders
- [ ] Contact PM email link works
- [ ] Edit button works for regular orders
- [ ] Export PDF works for both order types
- [ ] Upload documents works for both order types
- [ ] Order search/filter works for all orders

## Admin Portal Status

The admin portal (`src/routes/admin/operations/index.tsx`) maintains separate sections:
1. **Regular Orders**: From customers/admin
2. **Property Manager Orders**: Separate section

This is intentional as admin views are different from contractor operations. Admin needs to distinguish between order sources for management purposes.

If consolidation is needed in admin portal as well, the same pattern can be applied.

## Files Modified

1. `src/routes/contractor/operations/index.tsx`
   - Removed duplicate PM orders section (lines ~1861-2043)
   - Enhanced unified orders display with conditional buttons
   - Fixed duplicate onClick handler
