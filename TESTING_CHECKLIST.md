# Application Testing Checklist

This document provides a comprehensive checklist for manually testing all main features of the Square 15 Property Management System. Execute these tests in order to verify that all key user flows are working as expected.

## Prerequisites

- Server is running successfully
- Database has been seeded with demo users
- MinIO buckets have been created

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Junior Admin | junior@propmanagement.com | junior123 |
| Senior Admin | chalatsithapelo@gmail.com | 1991Slowmo* |
| Artisan | artisan@propmanagement.com | artisan123 |
| Customer | customer@example.com | customer123 |

---

## 1. Authentication & Access Control

### 1.1 Login Flow
- [ ] Navigate to the application root URL
- [ ] Verify login page displays with Square 15 branding
- [ ] Verify demo credentials are visible on the login page
- [ ] Test invalid credentials (should show error toast)
- [ ] Test valid credentials for Junior Admin
  - [ ] Should redirect to `/admin/dashboard`
  - [ ] Should show welcome toast with user's first name
- [ ] Logout and repeat for Senior Admin
  - [ ] Should redirect to `/admin/dashboard`
- [ ] Logout and repeat for Artisan
  - [ ] Should redirect to `/artisan/dashboard`
- [ ] Logout and repeat for Customer
  - [ ] Should redirect to `/customer/dashboard`

### 1.2 Session Persistence
- [ ] Login as any user
- [ ] Refresh the page
- [ ] Verify user remains logged in (no redirect to login)
- [ ] Verify correct dashboard is displayed

### 1.3 Role-Based Access
- [ ] While logged in as Customer, try to navigate to `/admin/dashboard`
  - [ ] Should be redirected or show access denied
- [ ] While logged in as Artisan, try to navigate to `/admin/projects`
  - [ ] Should be redirected or show access denied

---

## 2. Admin Flow: CRM & Lead Management

**Login as:** chalatsithapelo@gmail.com

### 2.1 CRM Dashboard Access
- [ ] Navigate to `/admin/crm`
- [ ] Verify page loads without errors
- [ ] Verify Sales Funnel Chart displays
- [ ] Verify Sales Dashboard Overview displays with metrics

### 2.2 Lead Creation
- [ ] Click "Add Lead" button
- [ ] Fill in lead form with test data:
  - Name: "Test Customer"
  - Email: "test@example.com"
  - Phone: "+27123456789"
  - Service Type: "Plumbing"
  - Description: "Kitchen sink repair needed urgently"
- [ ] Submit form
- [ ] Verify success toast appears
- [ ] Verify new lead appears in the leads list
- [ ] Verify lead has status "NEW"

### 2.3 AI Lead Scoring
- [ ] Find the newly created lead in the list
- [ ] Click "Score with AI" button
- [ ] Wait for AI analysis to complete
- [ ] Verify AI results display showing:
  - [ ] Priority level
  - [ ] Urgency assessment
  - [ ] Recommended actions
- [ ] Verify scoring completes without errors

### 2.4 AI Service Classification
- [ ] Click "Classify Service" for a lead
- [ ] Wait for AI classification
- [ ] Verify suggested service type appears
- [ ] Verify you can accept or modify the suggestion

### 2.5 Lead Status Management
- [ ] Update lead status from "NEW" to "CONTACTED"
- [ ] Verify status updates successfully
- [ ] Test filtering leads by status
- [ ] Verify filter works correctly

### 2.6 Lead Search
- [ ] Use search box to search for lead by name
- [ ] Verify search results filter correctly
- [ ] Clear search and verify all leads return

---

## 3. Admin Flow: Operations & Order Management

**Login as:** chalatsithapelo@gmail.com

### 3.1 Order Creation
- [ ] Navigate to `/admin/operations`
- [ ] Click "Create Order" button
- [ ] Fill in order form:
  - Customer Email: "customer@example.com"
  - Service Type: "Plumbing"
  - Description: "Fix kitchen sink"
  - Location: "123 Main St"
  - Start Date: (select future date)
  - Expected Completion: (select date after start)
  - Budget: 5000
- [ ] Add materials:
  - Material 1: "Pipes" - Quantity: 10 - Unit Cost: 50
  - Material 2: "Fittings" - Quantity: 5 - Unit Cost: 30
- [ ] Submit form
- [ ] Verify success toast
- [ ] Verify new order appears in list
- [ ] Verify order has auto-generated order number
- [ ] Verify total material cost is calculated correctly (650)

### 3.2 Order Editing
- [ ] Click "Edit" on an existing order
- [ ] Modify description
- [ ] Add a new material item
- [ ] Remove an existing material item
- [ ] Update quantities
- [ ] Save changes
- [ ] Verify total cost recalculates correctly
- [ ] Verify changes persist after page refresh

### 3.3 Artisan Suggestion (AI)
- [ ] Click "Suggest Artisan" for an order
- [ ] Wait for AI analysis
- [ ] Verify suggestions display with:
  - [ ] Artisan names
  - [ ] Match scores
  - [ ] Reasoning for each suggestion
- [ ] Verify you can assign suggested artisan to order

### 3.4 Order Status Transitions
- [ ] Update order status from "PENDING" to "ASSIGNED"
- [ ] Assign artisan (artisan@propmanagement.com)
- [ ] Verify status updates successfully
- [ ] Test status filter dropdown
- [ ] Verify filtering works for each status

### 3.5 Document Upload
- [ ] Select an order
- [ ] Click to upload documents
- [ ] Upload a test PDF or image file
- [ ] Verify file uploads successfully
- [ ] Verify file appears in order documents list
- [ ] Verify you can view/download the uploaded file

### 3.6 Order PDF Generation
- [ ] Click "Export PDF" for an order
- [ ] Wait for PDF generation
- [ ] Verify PDF downloads successfully
- [ ] Open PDF and verify:
  - [ ] Order details are correct
  - [ ] Materials list is included
  - [ ] Cost breakdown is shown
  - [ ] Company branding appears

---

## 4. Admin Flow: Projects & Milestones

**Login as:** chalatsithapelo@gmail.com

### 4.1 Project Creation
- [ ] Navigate to `/admin/projects`
- [ ] Click "Create Project" button
- [ ] Fill in project form:
  - Name: "Office Renovation"
  - Customer Email: "customer@example.com"
  - Type: "Renovation"
  - Description: "Complete office renovation project"
  - Start Date: (today)
  - Expected End Date: (30 days from now)
  - Budget: 50000
- [ ] Submit form
- [ ] Verify success toast
- [ ] Verify new project appears in list
- [ ] Verify project has auto-generated project number

### 4.2 Project Status Management
- [ ] Update project status from "PLANNING" to "IN_PROGRESS"
- [ ] Verify status updates successfully
- [ ] Verify you can filter projects by status
- [ ] Test each status transition (PLANNING → IN_PROGRESS → COMPLETED)

### 4.3 Milestone Creation
- [ ] Click "View Milestones" for a project
- [ ] Verify Milestone Manager opens
- [ ] Click "Add Milestone" button
- [ ] Fill in milestone form:
  - Name: "Phase 1: Demolition"
  - Description: "Remove old fixtures and walls"
  - Start Date: (today)
  - End Date: (7 days from now)
  - Budget: 10000
  - Assign to: artisan@propmanagement.com
- [ ] Add materials to milestone
- [ ] Submit form
- [ ] Verify milestone appears in list
- [ ] Verify milestone appears in Gantt chart

### 4.4 Milestone Dependencies
- [ ] Create a second milestone
- [ ] Set first milestone as dependency
- [ ] Verify dependency is saved
- [ ] Verify Gantt chart shows dependency relationship

### 4.5 Risk Management
- [ ] Open milestone details
- [ ] Navigate to "Risks" tab
- [ ] Add a risk:
  - Description: "Weather delays possible"
  - Severity: "MEDIUM"
  - Mitigation: "Have backup indoor work planned"
- [ ] Verify risk is saved
- [ ] Update risk status
- [ ] Delete a risk
- [ ] Verify deletion works

### 4.6 Weekly Budget Updates
- [ ] Navigate to "Weekly Updates" tab for a milestone
- [ ] Click "Add Weekly Update"
- [ ] Fill in update form:
  - Week ending: (select date)
  - Progress percentage: 25
  - Notes: "Demolition work started"
- [ ] Upload progress photos (2-3 images)
- [ ] Add itemized expenses:
  - Category: "Labor"
  - Description: "Demolition crew"
  - Amount: 2000
- [ ] Upload expense slips
- [ ] Submit update
- [ ] Verify success toast
- [ ] Verify update appears in list
- [ ] Verify milestone actual cost is updated
- [ ] Verify PDF report is generated

### 4.7 Milestone Payment Requests
- [ ] Mark milestone as "COMPLETED"
- [ ] Create payment request for milestone
- [ ] Verify payment request is created
- [ ] Verify payment request appears in payment requests list

### 4.8 Project Report Generation
- [ ] Navigate back to projects list
- [ ] Click "View Report" for a project
- [ ] Wait for report page to load
- [ ] Click "Generate PDF Report"
- [ ] Wait for PDF generation
- [ ] Verify PDF downloads successfully
- [ ] Open PDF and verify:
  - [ ] Project overview is included
  - [ ] All milestones are listed
  - [ ] Budget vs actual costs shown
  - [ ] Progress timeline included

---

## 5. Admin Flow: Financial Management

**Login as:** chalatsithapelo@gmail.com

### 5.1 Invoice Creation
- [ ] Navigate to `/admin/invoices`
- [ ] Click "Create Invoice" button
- [ ] Fill in invoice form:
  - Customer Email: "customer@example.com"
  - Due Date: (14 days from now)
  - Notes: "Payment for Phase 1 completion"
- [ ] Add line items:
  - Description: "Labor" - Quantity: 40 - Unit Price: 250
  - Description: "Materials" - Quantity: 1 - Unit Price: 5000
- [ ] Verify subtotal calculates correctly
- [ ] Submit form
- [ ] Verify invoice is created
- [ ] Verify invoice has unique invoice number

### 5.2 Invoice Status Management
- [ ] Update invoice status from "DRAFT" to "PENDING_APPROVAL"
- [ ] Verify status updates
- [ ] Update from "PENDING_APPROVAL" to "SENT"
- [ ] Verify status updates
- [ ] Test "REJECTED" status with rejection reason
- [ ] Verify rejection reason is saved

### 5.3 Invoice PDF Generation
- [ ] Click "Download PDF" for an invoice
- [ ] Wait for PDF generation
- [ ] Verify PDF downloads
- [ ] Open PDF and verify:
  - [ ] Invoice number and date
  - [ ] Customer details
  - [ ] Line items with calculations
  - [ ] Total amount
  - [ ] Company branding

### 5.4 Statement Generation
- [ ] Navigate to `/admin/statements`
- [ ] Click "Generate Statement" button
- [ ] Fill in statement form:
  - Customer Email: "customer@example.com"
  - Statement Date: (today)
  - Due Date: (30 days from now)
- [ ] Submit form
- [ ] Wait for generation (may take a few seconds)
- [ ] Verify success toast
- [ ] Verify statement appears in list
- [ ] Verify statement includes:
  - [ ] All invoices for customer
  - [ ] Age analysis
  - [ ] Interest calculations (if overdue)

### 5.5 Statement PDF Download
- [ ] Click "Download PDF" for a statement
- [ ] Verify PDF downloads
- [ ] Open PDF and verify:
  - [ ] Customer details
  - [ ] Invoice list with amounts
  - [ ] Age analysis breakdown
  - [ ] Total balance due

### 5.6 Financial Reports (SARS)
- [ ] Navigate to `/admin/accounts`
- [ ] Navigate to "Financial Reports" tab
- [ ] Click "Generate SARS Report"
- [ ] Select date range (e.g., last month)
- [ ] Submit form
- [ ] Wait for report generation
- [ ] Verify success toast
- [ ] Verify report appears in list
- [ ] Download PDF report
- [ ] Download CSV report
- [ ] Verify both files download successfully

### 5.7 P&L Statement
- [ ] Navigate to "P&L Statement" tab
- [ ] Select date range
- [ ] Verify revenue is calculated
- [ ] Verify expenses are categorized
- [ ] Verify profit/loss is shown
- [ ] Verify charts display correctly

### 5.8 Balance Sheet
- [ ] Navigate to "Balance Sheet" tab
- [ ] Verify assets are listed
- [ ] Verify liabilities are listed
- [ ] Verify equity calculation is correct

### 5.9 Budget Tracker
- [ ] Navigate to "Budget Tracker" tab
- [ ] Verify budget vs actual spending is shown
- [ ] Verify variance calculations
- [ ] Verify charts display correctly

---

## 6. Admin Flow: HR Management

**Login as:** chalatsithapelo@gmail.com

### 6.1 Employee Management
- [ ] Navigate to `/admin/hr`
- [ ] Navigate to "Employees" tab
- [ ] Verify employee list displays
- [ ] Click "Add Employee" button
- [ ] Fill in employee form:
  - Email: "newemployee@propmanagement.com"
  - First Name: "New"
  - Last Name: "Employee"
  - Phone: "+27123456792"
  - Role: "ARTISAN"
  - Hourly Rate: 300
  - Daily Rate: 2400
- [ ] Submit form
- [ ] Verify employee is created
- [ ] Edit employee details
- [ ] Verify updates save correctly

### 6.2 KPI Tracking
- [ ] Navigate to "KPI Tracking" tab
- [ ] Click "Add KPI" button
- [ ] Fill in KPI form:
  - Employee: (select employee)
  - Metric Name: "Jobs Completed"
  - Target Value: 10
  - Actual Value: 7
  - Period: (select month)
- [ ] Submit form
- [ ] Verify KPI is saved
- [ ] Update KPI actual value
- [ ] Verify update saves

### 6.3 Leave Management
- [ ] Navigate to "Leave Management" tab
- [ ] Verify pending leave requests display
- [ ] Approve a leave request
- [ ] Verify status updates to "APPROVED"
- [ ] Reject a leave request with reason
- [ ] Verify status updates to "REJECTED"

### 6.4 Document Management
- [ ] Navigate to "Documents" tab
- [ ] Click "Upload Document" button
- [ ] Select document type (e.g., "Contract")
- [ ] Select employee
- [ ] Upload a test PDF file
- [ ] Verify document uploads successfully
- [ ] Verify document appears in list
- [ ] Download document
- [ ] Delete document
- [ ] Verify deletion works

### 6.5 Remunerations
- [ ] Navigate to "Remunerations" tab
- [ ] Verify payment requests summary displays
- [ ] Verify average rates are calculated
- [ ] Verify payment history shows correctly

---

## 7. Admin Flow: Additional Features

**Login as:** chalatsithapelo@gmail.com

### 7.1 Quotations
- [ ] Navigate to `/admin/quotations`
- [ ] Click "Create Quotation" button
- [ ] Fill in quotation form with customer and service details
- [ ] Click "Generate Line Items with AI"
- [ ] Verify AI generates appropriate line items
- [ ] Modify line items as needed
- [ ] Submit quotation
- [ ] Verify quotation is created
- [ ] Update quotation status to "SENT"
- [ ] Generate quotation PDF
- [ ] Verify PDF downloads and displays correctly

### 7.2 Assets Management
- [ ] Navigate to `/admin/assets`
- [ ] Click "Add Asset" button
- [ ] Fill in asset form:
  - Name: "Company Van"
  - Type: "Vehicle"
  - Purchase Date: (past date)
  - Purchase Cost: 250000
  - Current Value: 200000
- [ ] Submit form
- [ ] Verify asset is created
- [ ] Edit asset details
- [ ] Verify updates save

### 7.3 Settings & Company Details
- [ ] Navigate to `/admin/settings`
- [ ] Update company details:
  - Company Name
  - Address
  - Contact Information
- [ ] Upload company logo
- [ ] Verify logo uploads successfully
- [ ] Save changes
- [ ] Verify changes persist after refresh

### 7.4 Notifications
- [ ] Click notifications bell icon in header
- [ ] Verify notification dropdown opens
- [ ] Verify unread count is correct
- [ ] Click a notification
- [ ] Verify notification is marked as read
- [ ] Click "Mark all as read"
- [ ] Verify all notifications are marked as read

---

## 8. Artisan Flow: Job Management

**Login as:** artisan@propmanagement.com

### 8.1 Dashboard Access
- [ ] Verify artisan dashboard loads
- [ ] Verify tabs are visible: Jobs, Quotations, Milestones, Earnings, Performance, Reviews
- [ ] Verify job statistics display correctly

### 8.2 View Assigned Jobs
- [ ] Navigate to "Jobs" tab
- [ ] Verify assigned orders display
- [ ] Verify job details are visible:
  - [ ] Order number
  - [ ] Customer information
  - [ ] Service type
  - [ ] Status
  - [ ] Budget

### 8.3 Start Job
- [ ] Find a job with status "ASSIGNED"
- [ ] Click "Start Job" button
- [ ] Verify confirmation modal appears
- [ ] Confirm start
- [ ] Verify job status updates to "IN_PROGRESS"
- [ ] Verify success toast appears

### 8.4 Pause Job
- [ ] Find a job with status "IN_PROGRESS"
- [ ] Click "Pause Job" button
- [ ] Enter pause reason: "Waiting for materials"
- [ ] Confirm pause
- [ ] Verify job status updates to "PAUSED"
- [ ] Verify pause reason is saved

### 8.5 Resume Job
- [ ] Find the paused job
- [ ] Click "Resume Job" button
- [ ] Confirm resume
- [ ] Verify job status returns to "IN_PROGRESS"

### 8.6 Complete Job
- [ ] Find a job with status "IN_PROGRESS"
- [ ] Click "Complete Job" button
- [ ] Upload progress photos (minimum 2-3 photos required)
- [ ] Verify photos upload successfully
- [ ] Capture signature
- [ ] Verify signature is captured
- [ ] Upload expense slips
- [ ] Verify expense slips upload
- [ ] Enter completion notes
- [ ] Submit completion
- [ ] Verify job status updates to "COMPLETED"
- [ ] Verify payment request is created automatically

### 8.7 Milestone Work
- [ ] Navigate to "Milestones" tab
- [ ] Verify assigned milestones display
- [ ] Click on a milestone to view details
- [ ] Verify milestone information is visible
- [ ] Test milestone start/pause/complete flow (similar to jobs)

### 8.8 Earnings Overview
- [ ] Navigate to "Earnings" tab
- [ ] Verify earnings summary cards display:
  - [ ] Total earnings
  - [ ] Pending payments
  - [ ] Completed jobs
- [ ] Verify earnings history table displays
- [ ] Verify payment status for each job/milestone

### 8.9 Pending Payments
- [ ] Verify pending payments section displays
- [ ] Verify list shows all unpaid payment requests
- [ ] Verify amounts are correct
- [ ] Verify you can see payment request details

### 8.10 Performance Metrics
- [ ] Navigate to "Performance" tab
- [ ] Verify performance metrics display:
  - [ ] Completion rate
  - [ ] Average rating
  - [ ] Total jobs completed
  - [ ] On-time delivery rate
- [ ] Verify charts display correctly

### 8.11 Reviews
- [ ] Navigate to "Reviews" tab
- [ ] Verify customer reviews display
- [ ] Verify rating stars show correctly
- [ ] Verify review comments are visible
- [ ] Verify review dates are shown

### 8.12 Gallery
- [ ] Navigate to `/artisan/gallery`
- [ ] Verify gallery page loads
- [ ] Verify completed job photos display
- [ ] Verify photos are organized by job
- [ ] Verify you can view full-size images

---

## 9. Customer Flow

**Login as:** customer@example.com

### 9.1 Dashboard Access
- [ ] Verify customer dashboard loads
- [ ] Verify tabs are visible: Orders, Projects, Invoices, Statements
- [ ] Verify summary statistics display

### 9.2 View Orders
- [ ] Navigate to "Orders" tab
- [ ] Verify your orders display
- [ ] Verify order details are visible (but not admin-level cost details)
- [ ] Click on an order to view full details
- [ ] Verify you can see:
  - [ ] Order status
  - [ ] Assigned artisan
  - [ ] Service description
  - [ ] Progress updates

### 9.3 View Projects
- [ ] Navigate to "Projects" tab
- [ ] Verify your projects display
- [ ] Click on a project to view details
- [ ] Verify you can see:
  - [ ] Project status
  - [ ] Milestones
  - [ ] Overall progress
- [ ] Click "View Weekly Updates" for a milestone
- [ ] Verify weekly progress reports display
- [ ] Verify progress photos are visible
- [ ] Download weekly report PDF
- [ ] Verify PDF downloads (should NOT show cost details)

### 9.4 View Invoices
- [ ] Navigate to "Invoices" tab
- [ ] Verify your invoices display
- [ ] Verify invoice details are visible:
  - [ ] Invoice number
  - [ ] Date
  - [ ] Amount
  - [ ] Status
- [ ] Click "Download PDF" for an invoice
- [ ] Verify PDF downloads successfully
- [ ] Open PDF and verify invoice details

### 9.5 View Statements
- [ ] Navigate to "Statements" tab
- [ ] Verify your statements display
- [ ] Click "Download PDF" for a statement
- [ ] Verify PDF downloads successfully
- [ ] Open PDF and verify:
  - [ ] Statement details
  - [ ] Invoice list
  - [ ] Balance due

### 9.6 Leave Review
- [ ] Find a completed order in "Orders" tab
- [ ] Click "Leave Review" button
- [ ] Fill in review form:
  - Rating: 5 stars
  - Comment: "Excellent work, very professional!"
- [ ] Submit review
- [ ] Verify success toast
- [ ] Verify review is saved
- [ ] Verify you cannot leave another review for the same order

### 9.7 Project Review
- [ ] Find a completed project in "Projects" tab
- [ ] Click "Leave Review" button
- [ ] Fill in review form with rating and comment
- [ ] Submit review
- [ ] Verify success toast
- [ ] Verify review is saved

---

## 10. Messaging System (All Roles)

### 10.1 View Conversations
- [ ] Login as any user
- [ ] Navigate to `/messages`
- [ ] Verify conversations list displays
- [ ] Verify you can see:
  - [ ] Conversation participants
  - [ ] Last message preview
  - [ ] Unread count (if any)

### 10.2 Send Message
- [ ] Click on a conversation
- [ ] Type a test message
- [ ] Send message
- [ ] Verify message appears in conversation
- [ ] Verify timestamp is correct

### 10.3 Real-time Updates
- [ ] Open the same conversation in two different browser windows (different users)
- [ ] Send a message from one window
- [ ] Verify message appears in real-time in the other window
- [ ] Verify unread count updates

### 10.4 Create New Conversation
- [ ] Click "New Conversation" button
- [ ] Select recipient
- [ ] Type initial message
- [ ] Send message
- [ ] Verify conversation is created
- [ ] Verify message is sent

---

## 11. Cross-Cutting Features

### 11.1 Responsive Design
- [ ] Resize browser window to mobile size
- [ ] Verify layout adapts responsively
- [ ] Verify navigation menu works on mobile
- [ ] Verify forms are usable on mobile
- [ ] Test on actual mobile device if possible

### 11.2 Error Handling
- [ ] Test form validation by submitting empty forms
- [ ] Verify validation errors display correctly
- [ ] Test network error handling (disconnect network temporarily)
- [ ] Verify appropriate error messages display

### 11.3 Loading States
- [ ] Verify loading spinners appear during data fetching
- [ ] Verify loading states for mutations
- [ ] Verify skeleton loaders where implemented

### 11.4 Toast Notifications
- [ ] Verify success toasts appear for successful actions
- [ ] Verify error toasts appear for failed actions
- [ ] Verify toasts auto-dismiss after a few seconds
- [ ] Verify toast messages are clear and helpful

---

## 12. Performance & Data Integrity

### 12.1 Data Persistence
- [ ] Create various entities (orders, projects, invoices)
- [ ] Refresh the page
- [ ] Verify all data persists correctly
- [ ] Logout and login again
- [ ] Verify data is still present

### 12.2 Calculations
- [ ] Verify all financial calculations are accurate:
  - [ ] Order total costs
  - [ ] Invoice subtotals and totals
  - [ ] Project budget vs actual
  - [ ] Milestone cost tracking
- [ ] Verify percentage calculations are correct:
  - [ ] Progress percentages
  - [ ] Completion rates
  - [ ] Budget utilization

### 12.3 File Uploads
- [ ] Test uploading various file types (PDF, JPG, PNG)
- [ ] Test uploading large files (within reasonable limits)
- [ ] Verify files are stored correctly in MinIO
- [ ] Verify files can be downloaded after upload
- [ ] Verify file URLs are accessible

---

## Test Results Summary

### Passing Tests
- Total tests passed: _____ / _____

### Failed Tests
List any failing tests here with details:
1. 
2. 
3. 

### Bugs Found
List any bugs discovered during testing:
1. 
2. 
3. 

### Performance Issues
Note any performance concerns:
1. 
2. 
3. 

### Recommendations
List any recommendations for improvements:
1. 
2. 
3. 

---

## Notes

- All tests should be performed in a clean state when possible
- Some tests may require setup from previous tests (e.g., creating an order before completing it)
- Document any unexpected behavior, even if it doesn't cause a complete failure
- Take screenshots of any errors or issues encountered
- Note browser and device information for any issues found

**Testing Date:** ___________
**Tested By:** ___________
**Browser/Device:** ___________
**Environment:** ___________
