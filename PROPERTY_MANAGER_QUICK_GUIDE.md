# Property Manager Portal - Quick Reference Guide

## 🆕 New Features Overview

### 1. Create Orders Independently
Property Managers can now create work orders directly without waiting for RFQ approval.

**How to Use:**
1. Go to **Orders** tab in Property Manager Dashboard
2. Click **"+ Create Order"** button (top right)
3. Fill in the form:
   - **Customer Details**: Name, Email, Phone, Address
   - **Work Details**: Service Type (dropdown), Description
   - **Budget**: Call-out fee, Labour rates, Material budget
   - **Materials** (optional): Add line items for materials
4. Click **"Create Order"** to submit

**Order Number:**
- Auto-generated if left blank (uses company prefix)
- Can specify custom order number

**What Happens:**
- Order appears in Orders list immediately
- Status: SUBMITTED (ready to be assigned to contractor)
- Can be issued to contractor right away

---

### 2. Create Invoices to Customers
Property Managers can create and send invoices directly to customers.

**How to Use:**
1. Go to **Invoices** tab in Property Manager Dashboard
2. Click **"+ Create Invoice"** button (top right)
3. Fill in the form:
   - **Customer Info**: Name, Email, Phone, Address
   - **Invoice Items**: Add line items
     - Description, Quantity, Unit Price
     - System calculates totals automatically
   - **Financial Details**:
     - Company Material Cost
     - Company Labour Cost
     - Tax amount
   - **Due Date** (optional)
   - **Notes/Terms**
4. Click **"Create Invoice"** to submit

**Automatic Calculations:**
- Line item totals: Quantity × Unit Price
- Subtotal: Sum of all line items
- Total: Subtotal + Tax
- Estimated Profit: Total - Material Cost - Labour Cost

**What Happens:**
- Invoice appears in Invoices list
- Status: PENDING_REVIEW
- Can be sent to customer

---

### 3. Manage Contractors
Enhanced contractor management with full visibility into performance and spending.

**How to Access:**
1. Go to **Contractors** tab in Property Manager Dashboard
2. View table of all contractors

**Search and Filter:**
- **Search Box**: Find by name, email, or company
- **Service Type Filter**: Filter by PLUMBING, ELECTRICAL, HVAC, etc.
- **Status Filter**: ACTIVE, INACTIVE, SUSPENDED, TERMINATED

**View Contractor Details:**
1. Click the **eye icon** (👁️) on any contractor row
2. Detailed modal opens with 5 tabs:

   **Overview Tab:**
   - Basic information
   - Key metrics: Jobs completed, Rating, Total spent

   **Performance Tab:**
   - On-Time Completion Rate (%)
   - Quality Score (/10)
   - Customer Satisfaction Score (/10)
   - Performance notes

   **KPIs Tab:**
   - Contractor Key Performance Indicators
   - Target vs Actual values
   - Progress bars for each KPI

   **Spending Tab:**
   - Total spending to date
   - Number of projects
   - Average project cost
   - Monthly spending trend

   **Documents Tab:**
   - All contractor documents
   - Download links
   - Document type and upload date

**Add New Contractor:**
1. Click **"+ Add Contractor"** button (top right)
2. Enter contractor details
3. Click Submit

---

### 4. Contractor Portal
Contractors now have their own dedicated portal to track jobs and performance.

**Access:**
- Contractors log in with their account
- Automatically routed to **Contractor Dashboard**
- URL: `/contractor/dashboard`

**Available Tabs:**

**Overview:**
- Welcome message
- Quick stats (Company, Email, Phone, Member Since)
- Feature overview

**My Jobs:**
- View assigned jobs
- Job status and details
- (Coming soon: Update job status)

**Invoices:**
- View invoices issued
- Payment status
- (Coming soon: Download invoices)

**Performance:**
- Quality Rating
- On-Time Completion Rate
- Track personal KPIs

**Documents:**
- Company documents
- Certifications
- Insurance documents

**Features:**
- AI Agent available (27 business tools)
- Real-time notifications
- Mobile-responsive design

---

## 💡 Tips & Best Practices

### Order Creation
✅ **DO:**
- Include detailed descriptions of work
- Add materials if known upfront
- Specify accurate budgets
- Use consistent service type selections

❌ **DON'T:**
- Leave required fields empty
- Create duplicate orders for same work
- Use unrealistic budget numbers

### Invoice Creation
✅ **DO:**
- Add all line items for the work done
- Include all costs (materials and labour)
- Set appropriate due dates
- Add payment terms in notes

❌ **DON'T:**
- Send invoices with incomplete information
- Miss including costs (impacts profit calculation)
- Create invoices with zero tax without reason

### Contractor Management
✅ **DO:**
- Monitor KPIs regularly
- Review spending trends
- Check performance ratings
- Verify documents are up-to-date

❌ **DON'T:**
- Work with contractors past expiry dates
- Ignore poor performance ratings
- Skip document verification

---

## 📊 Key Metrics to Monitor

### Contractor Performance
- **Quality Score**: Should be 8+/10
- **On-Time Completion**: Target 95%+
- **Customer Satisfaction**: Should be 8+/10
- **Rating**: Target 4.5+/5

### Spending Analysis
- **Total Spending**: Compare across contractors
- **Average Project Cost**: Identify cost variations
- **Monthly Trends**: Watch for anomalies
- **Cost per Job**: Track efficiency

---

## 🔔 Status Codes

### Order Status
- **SUBMITTED**: Ready to be assigned
- **ACCEPTED**: Accepted by contractor
- **IN_PROGRESS**: Work is underway
- **COMPLETED**: Work finished

### Invoice Status
- **PENDING_REVIEW**: Awaiting approval
- **SENT_TO_PM**: Sent for approval
- **PM_APPROVED**: Approved
- **PAID**: Payment received
- **OVERDUE**: Past due date

### Contractor Status
- **ACTIVE**: Can receive work
- **INACTIVE**: Not receiving work
- **SUSPENDED**: Temporarily blocked
- **TERMINATED**: No longer contracted

---

## ⚙️ Form Validation

### Required Fields
**Order Creation:**
- Customer Name ✓
- Customer Email ✓ (valid email format)
- Customer Phone ✓
- Address ✓
- Service Type (at least one)
- Description ✓

**Invoice Creation:**
- Customer Name ✓
- Customer Email ✓ (valid email format)
- Customer Phone ✓
- Address ✓
- At least one line item with:
  - Description ✓
  - Quantity > 0 ✓
  - Unit Price > 0 ✓

**Validation Errors:**
- Form won't submit if required fields empty
- Email format must be valid
- Phone numbers required
- At least one line item needed for invoices

---

## 🆘 Common Issues

**Issue: Order not appearing in list**
- Wait a moment for refresh
- Check status filter (not filtering it out)
- Verify you're on the Orders tab

**Issue: Invoice totals incorrect**
- Verify quantities entered correctly
- Check unit prices
- Ensure tax amount is correct
- System auto-calculates totals

**Issue: Contractor details modal won't open**
- Ensure contractor has full data
- Try refreshing the page
- Check your internet connection

**Issue: Contractor portal not accessible**
- Verify account has CONTRACTOR role
- Check portal access is enabled for contractor
- Try logging out and back in

---

## 🎯 Workflow Examples

### Complete Order Workflow
1. **Create Order** → Order status: SUBMITTED
2. **Assign to Contractor** → Status: ASSIGNED
3. **Contractor starts work** → Status: IN_PROGRESS
4. **Work completed** → Status: COMPLETED
5. **Create Invoice** → Based on completed order
6. **Send to customer** → For approval
7. **Customer pays** → Mark as PAID

### Performance Monitoring Workflow
1. Go to **Contractors** tab
2. Click contractor eye icon
3. Review **Performance** tab
4. Check **Spending** tab
5. Review **KPIs** for accountability
6. If poor performance:
   - Adjust task allocation
   - Provide additional support
   - Consider alternative contractors

---

## 📱 Mobile Usage

All new features are **mobile responsive**:
- Modals scale appropriately
- Forms stack vertically on small screens
- Tables become cards on mobile
- Navigation collapses on mobile (hamburger menu)

**Best on:**
- Desktop for order/invoice creation
- Tablet for contractor details review
- Mobile for quick status checks

---

## 🔐 Access Control

**Property Manager Can:**
✅ Create orders
✅ Create invoices
✅ Manage contractors
✅ View contractor performance
✅ View spending analytics
✅ Download documents

**Contractor Can:**
✅ View assigned jobs
✅ View own performance
✅ Download own documents
✅ Access AI Agent

**Admin Can:**
✅ Everything Property Manager can do
✅ Additional admin functions
✅ System configuration

---

## 📞 Need Help?

**AI Agent Available:**
- 27 business tools available
- Ask about order creation process
- Ask about invoice management
- Ask about contractor performance

**Quick Commands:**
- "Create an invoice for..." 
- "Show me contractor performance"
- "What's the spending by contractor"
- "Help me create an order"

---

**Last Updated:** December 2024
**Version:** 1.0
**Status:** Live
