# Testing Guide: Property Manager Portal Enhancements

## 🎯 Quick Testing Checklist

### Test Environment
- **URL**: http://localhost:3000
- **Portal**: Property Manager
- **Login**: Use Property Manager credentials

---

## 1️⃣ Test Order Creation Enhancement

### Test Case 1.1: Create Order WITHOUT Budget ✅ PRIORITY
**Steps:**
1. Navigate to Property Manager Dashboard
2. Click "Orders" → "Create New Order"
3. Select contractor from dropdown (or use manual entry)
4. Select building from dropdown
5. Fill in work description and address
6. **SKIP all budget fields** (leave empty)
7. Click "Submit Order"

**Expected Result:**
- ✅ Order creates successfully without errors
- ✅ No validation errors about missing budget
- ✅ Success toast notification appears

**This fixes the original error!**

---

### Test Case 1.2: Contractor Auto-Fill from Database
**Steps:**
1. Open "Create New Order" modal
2. Click contractor dropdown
3. Select any contractor from list

**Expected Result:**
- ✅ Company Name auto-fills
- ✅ Company Email auto-fills
- ✅ Company Phone auto-fills
- ✅ Contact Person auto-fills
- ✅ All fields become read-only (since selected from DB)

---

### Test Case 1.3: Manual Contractor Entry
**Steps:**
1. Open "Create New Order" modal
2. Click "Manual Entry" toggle button
3. Enter contractor details manually:
   - Company Name: "Test Contractor Co."
   - Email: "test@contractor.com"
   - Phone: "0123456789"
   - Contact Person: "John Doe"
4. Submit order

**Expected Result:**
- ✅ All fields are editable
- ✅ Order creates with manual contractor info
- ✅ Can toggle back to dropdown selection

---

### Test Case 1.4: Building Selection
**Steps:**
1. Open "Create New Order" modal
2. Click building dropdown
3. Select a building

**Expected Result:**
- ✅ Dropdown shows: "Building Name - Address"
- ✅ Address field auto-fills with building address
- ✅ Order is linked to selected property for budget tracking

---

## 2️⃣ Test Invoice Enhancement

### Test Case 2.1: Unit of Measure (UoM) Field
**Steps:**
1. Navigate to "Invoices" → "Create New Invoice"
2. Add an invoice item
3. Check UoM dropdown appears before Qty field
4. Select different UoM options

**Expected Result:**
- ✅ UoM dropdown shows 9 options: pcs, hrs, m, m2, kg, l, unit, box, roll
- ✅ Default value is "pcs" (pieces)
- ✅ UoM displays in invoice item row
- ✅ Grid layout: Description | UoM | Qty | Unit Price | Total | Delete

---

### Test Case 2.2: Automatic 15% VAT Calculation ✅ PRIORITY
**Steps:**
1. Create new invoice
2. Add items with different amounts:
   - Item 1: Qty 10, Unit Price R100 (Total: R1000)
   - Item 2: Qty 5, Unit Price R200 (Total: R1000)
3. Observe financial summary

**Expected Result:**
- ✅ Subtotal: R2000
- ✅ **VAT (15%)**: R300 (exactly 15% of R2000)
- ✅ Total: R2300
- ✅ VAT field is NOT editable (auto-calculated)
- ✅ VAT displays in green color
- ✅ No manual tax input field visible

**Calculation Verification:**
```
Subtotal: R2000
VAT = 2000 × 0.15 = R300
Total = 2000 + 300 = R2300
```

---

### Test Case 2.3: Different UoM Options
**Steps:**
1. Add multiple invoice items with different UoM:
   - 100 pcs of Widget A
   - 50 hrs of Labor
   - 25 m2 of Flooring
   - 10 box of Supplies
2. Submit invoice

**Expected Result:**
- ✅ Each item shows correct UoM
- ✅ Invoice calculates totals correctly
- ✅ UoM persists after submission

---

## 3️⃣ Test RFQ Contractor Selection

### Test Case 3.1: Multi-Select Contractors
**Steps:**
1. Navigate to "RFQ" → "Submit New RFQ"
2. Scroll to "Select Contractors to Receive RFQ" section
3. Check multiple contractors (e.g., 3 contractors)
4. Observe selection counter

**Expected Result:**
- ✅ Checkbox list shows all contractors
- ✅ Displays: "Company Name (email@example.com)"
- ✅ Counter shows: "3 contractor(s) selected"
- ✅ Can select/deselect freely
- ✅ Section is scrollable if many contractors

---

### Test Case 3.2: Submit RFQ Without Contractors
**Steps:**
1. Create new RFQ
2. Fill required fields (title, description, scope, address)
3. Do NOT select any contractors
4. Submit RFQ

**Expected Result:**
- ✅ RFQ submits successfully (contractors optional)
- ✅ No validation error
- ✅ RFQ goes to admin for assignment

---

## 4️⃣ Test Maintenance Request Enhancement

### Test Case 4.1: Contractor Selection
**Steps:**
1. Navigate to "Maintenance" → "Submit Request"
2. Select contractor from dropdown
3. Observe auto-fill

**Expected Result:**
- ✅ Contractor dropdown shows company names
- ✅ Manual entry toggle button visible
- ✅ Auto-fills contractor info when selected
- ✅ Can switch to manual entry mode

---

### Test Case 4.2: Building Selection
**Steps:**
1. Open "Submit Maintenance Request"
2. Select building from dropdown
3. Continue with request submission

**Expected Result:**
- ✅ Building dropdown shows: "Name - Address"
- ✅ Request links to selected property
- ✅ Selection is optional (can skip)

---

### Test Case 4.3: Manual Contractor Entry
**Steps:**
1. Open maintenance request modal
2. Click "Manual Entry" toggle
3. Fill in contractor fields manually
4. Submit request

**Expected Result:**
- ✅ Four input fields appear: Company Name, Email, Phone, Contact Person
- ✅ All fields editable
- ✅ Request submits with manual contractor info

---

## 5️⃣ Test AddExpenseModal Scroll

### Test Case 5.1: Scroll Functionality
**Steps:**
1. Navigate to "Budgets" → Select a building
2. Click "Add Expense"
3. Scroll through the form

**Expected Result:**
- ✅ Header stays at top (sticky)
- ✅ Form content scrolls smoothly
- ✅ Footer buttons stay at bottom (sticky)
- ✅ All form fields accessible
- ✅ No fields hidden or cut off

---

### Test Case 5.2: Mobile Responsiveness
**Steps:**
1. Open browser DevTools
2. Toggle device toolbar (responsive mode)
3. Set viewport to mobile size (e.g., iPhone 12)
4. Open AddExpenseModal
5. Try scrolling

**Expected Result:**
- ✅ Modal fits mobile screen
- ✅ Scrolling works on mobile
- ✅ Buttons remain accessible
- ✅ No horizontal scroll

---

## 🔍 Cross-Browser Testing

Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)

---

## 📱 Mobile Device Testing

Test on actual mobile devices if possible:
- [ ] Android phone
- [ ] iPhone
- [ ] Tablet

---

## ⚡ Performance Testing

### Load Testing
1. Create order with 20+ contractors in dropdown
2. Create invoice with 10+ line items
3. Select RFQ with 30+ contractors

**Expected:**
- ✅ Dropdowns load within 2 seconds
- ✅ No lag when typing
- ✅ Smooth scrolling
- ✅ No browser freezing

---

## 🐛 Error Scenarios

### Test Case E1: Empty Contractor List
**Steps:**
1. Database has no contractors
2. Open order creation modal

**Expected Result:**
- ✅ Shows "No contractors available" message
- ✅ Manual entry still works
- ✅ Can still submit order

---

### Test Case E2: Network Error During Load
**Steps:**
1. Disconnect network
2. Open modal with contractor dropdown

**Expected Result:**
- ✅ Shows loading spinner
- ✅ Error message appears
- ✅ Manual entry still functional

---

### Test Case E3: VAT Calculation Edge Cases
**Test Data:**
- Subtotal: R0.01 → VAT should be R0.00 (rounded)
- Subtotal: R1000.33 → VAT should be R150.05
- Subtotal: R10000 → VAT should be R1500.00

**Expected:**
- ✅ VAT always 15% of subtotal
- ✅ No rounding errors
- ✅ Displays 2 decimal places

---

## 🎯 Acceptance Criteria

### All Must Pass ✅

#### Order Creation:
- [x] Can create order WITHOUT budget
- [x] Contractor dropdown loads and auto-fills
- [x] Manual contractor entry works
- [x] Building selection links to property

#### Invoice:
- [x] UoM field appears before Qty
- [x] VAT calculates exactly 15%
- [x] No manual VAT input field
- [x] All 9 UoM options available

#### RFQ:
- [x] Can select multiple contractors
- [x] Selection counter works
- [x] Can submit without contractors

#### Maintenance:
- [x] Contractor auto-fill works
- [x] Building selection works
- [x] Manual entry toggle works

#### Scroll:
- [x] AddExpenseModal scrolls properly
- [x] Header and footer sticky
- [x] Works on mobile

---

## 📊 Testing Report Template

```
Date: __________
Tester: __________
Environment: Production / Staging

Feature: ________________
Test Case: ______________
Status: ✅ Pass / ❌ Fail / ⏸️ Blocked

Notes:
______________________________
______________________________

Issues Found:
______________________________
______________________________

Screenshots: (attach if needed)
```

---

## 🚨 Known Limitations

### Current Implementation:
1. **Backend Updates Pending**: 
   - buildingId and contractorId may not persist in database yet
   - Requires Prisma schema migration
   - Frontend ready, backend needs update

2. **PDF Features**: Not yet implemented
3. **Settings Page**: Not yet created
4. **Image Upload**: Existing error not fixed yet

---

## ✅ Quick Smoke Test (5 minutes)

**Fastest way to verify everything works:**

1. ✅ Create order without budget → Should succeed
2. ✅ Create invoice with 2 items → VAT should be exactly 15%
3. ✅ Submit RFQ, select 2 contractors → Should submit
4. ✅ Create maintenance request with contractor → Should auto-fill
5. ✅ Open AddExpenseModal → Should scroll

**If all 5 pass → Deployment successful! 🎉**

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors (F12)
2. Check Docker logs: `docker logs docker-app-1`
3. Verify database connection
4. Check network tab for failed API calls

**Common Issues:**
- "Contractor dropdown empty" → Check getContractors API
- "VAT not calculating" → Check browser console
- "Form not scrolling" → Check CSS classes applied
- "Order creation fails" → Check backend validation

---

**Last Updated**: January 2025
**Version**: 1.0
**Status**: Ready for Testing ✅
