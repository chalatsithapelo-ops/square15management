# Tenant Management - Quick Start Guide

## 🎯 What Was Implemented

A comprehensive **Tenant Onboarding and Management System** that allows:
- Customers to self-onboard as tenants
- Property Managers to approve/reject onboarding requests
- Property Managers to track rent payments and utility consumption
- Integration with existing maintenance system

---

## 🚀 Application Status

**✅ LIVE AND ACCESSIBLE**

- **URL:** http://localhost:8000
- **All Containers:** Healthy
- **Database:** Migrated successfully

---

## 📋 How to Use

### For Customers (Tenants)

#### Step 1: Access Onboarding Form
Navigate to: **http://localhost:8000/customer/onboarding**

#### Step 2: Fill in Information
1. **Personal Information:**
   - First Name, Last Name
   - Email Address
   - Phone Number

2. **Property Information:**
   - Enter your Property Manager ID (get this from your PM)
   - Select your Building from the dropdown

3. **Optional Information:**
   - Lease Start Date
   - Monthly Rent Amount
   - Security Deposit
   - Utility Meter Numbers (electricity, water, gas)

#### Step 3: Submit Request
- Click "Submit Onboarding Request"
- You'll see a confirmation message
- Your status will show as "Pending Review"

#### Step 4: Wait for Approval
- Return to `/customer/onboarding` to check status
- **Pending:** Shows "under review" message
- **Approved:** Shows welcome message + access to features
- **Rejected:** Shows rejection reason

---

### For Property Managers

#### Step 1: Access Tenant Management
Navigate to: **http://localhost:8000/property-manager/dashboard**

Click the **"Tenant Management"** button in the header (blue button with Users icon)

Or directly: **http://localhost:8000/property-manager/tenants**

#### Step 2: Review Pending Onboardings
1. Check the "Pending Onboarding" metric card
2. Click "Review Now" to see pending requests
3. Review each tenant's information:
   - Personal details
   - Building selection
   - Proposed lease terms

#### Step 3: Approve or Reject

**To Approve:**
1. Click green "Approve" button
2. Fill in final lease details:
   - Lease Start Date (required)
   - Lease End Date (required)
   - Monthly Rent (required)
   - Security Deposit (optional)
3. Click "Approve & Activate"
4. Tenant status changes to ACTIVE

**To Reject:**
1. Click red "Reject" button
2. Enter a rejection reason
3. Submit
4. Tenant is notified with the reason

#### Step 4: View All Tenants
- The "Overview" tab shows all your tenants
- Table displays:
  - Tenant names and contact info
  - Building assignment
  - Monthly rent
  - Status (Active/Pending/Inactive)
- Click "View" to see tenant details

---

## 🗂️ Database Schema Overview

### New Models Created

**RentPayment:**
- Tracks monthly rent payments
- Auto-generates payment numbers (RENT-202512-0001)
- Supports partial payments
- Tracks late fees
- Status: PENDING → PAID/PARTIAL/OVERDUE

**UtilityReading:**
- Records utility consumption
- Supports: Electricity, Water, Gas, Internet
- Auto-calculates consumption
- Billing support with rate per unit

### Extended Models

**PropertyManagerCustomer:**
- Added 13 new fields for onboarding and lease management
- New status workflow: PENDING → APPROVED → ACTIVE
- Building association
- Utility meter tracking

---

## 🔧 Backend Procedures Available

### Onboarding (5 procedures)
- `getBuildingsForOnboarding` - Get buildings for dropdown
- `submitTenantOnboarding` - Customer submits request
- `getPendingOnboardings` - PM views pending requests
- `approveTenantOnboarding` - PM approves with lease details
- `rejectTenantOnboarding` - PM rejects with reason

### Tenant Management (3 procedures)
- `getTenantsOverview` - List all tenants with metrics
- `getTenantDetails` - Detailed tenant information
- `getTenantMaintenanceRequests` - Filter maintenance by tenant

### Rent Tracking (2 procedures)
- `recordRentPayment` - Record rent payment
- `getTenantRentHistory` - View payment history

### Utility Tracking (2 procedures)
- `recordUtilityReading` - Record utility reading
- `getTenantUtilityHistory` - View reading history

---

## 📍 Navigation

### Customer Portal
- **Dashboard:** http://localhost:8000/customer/dashboard
- **Onboarding:** http://localhost:8000/customer/onboarding
- **Maintenance:** http://localhost:8000/customer/maintenance

### Property Manager Portal
- **Dashboard:** http://localhost:8000/property-manager/dashboard
- **Tenant Management:** http://localhost:8000/property-manager/tenants
- **Received Maintenance:** http://localhost:8000/property-manager/maintenance/received
- **Settings:** http://localhost:8000/property-manager/settings

---

## ✅ Testing the Flow

### End-to-End Test

1. **Login as Customer**
   - Navigate to http://localhost:8000
   - Login with customer credentials

2. **Submit Onboarding**
   - Go to `/customer/onboarding`
   - Enter details (use PM ID that exists in database)
   - Select a building
   - Submit

3. **Login as Property Manager**
   - Logout customer
   - Login with Property Manager credentials

4. **Review Onboarding**
   - Go to `/property-manager/tenants`
   - See pending count increase
   - Click "Review Now"

5. **Approve Tenant**
   - Click "Approve" on the request
   - Enter lease dates and rent amount
   - Submit approval

6. **Verify as Customer**
   - Logout PM
   - Login as customer again
   - Go to `/customer/onboarding`
   - Should see "Onboarding Approved" message

---

## 🛠️ Docker Commands

### Check Application Status
```powershell
docker compose -f docker/compose.yaml ps
```

### View Logs
```powershell
# All logs
docker compose -f docker/compose.yaml logs -f

# App logs only
docker compose -f docker/compose.yaml logs -f app
```

### Restart Application
```powershell
docker compose -f docker/compose.yaml restart app
```

### Rebuild and Deploy
```powershell
docker compose -f docker/compose.yaml up -d --build app
```

---

## 📊 Metrics Dashboard (Property Manager)

When you open the Tenant Management page, you'll see:

1. **Total Tenants** - All tenants in the system
2. **Active Tenants** - Approved and active tenants
3. **Pending Onboarding** - Awaiting approval (with "Review Now" link)
4. **Monthly Rent** - Total monthly rent from all active tenants

---

## 🎨 UI Features

### Customer Onboarding Form
- Clean, modern layout
- Sections: Personal Info, Property Info, Lease Info, Utility Meters
- Real-time building details preview
- Form validation with error messages
- Loading states for building dropdown
- Status display for existing requests

### PM Tenant Management Dashboard
- Overview tab with metrics and tenant list
- Pending tab with approval workflow
- Color-coded status badges (green=Active, yellow=Pending, gray=Inactive)
- Responsive table layout
- Action buttons with icons
- Empty states with helpful messages

---

## 🔜 Coming Soon (Implemented Backend, UI Pending)

The following features have **backend procedures ready** but need UI implementation:

1. **Rent Payment Recording**
   - Record rent payments
   - Track partial payments
   - View payment history

2. **Utility Reading Recording**
   - Record meter readings
   - Auto-calculate consumption
   - View reading history

3. **Tenant Detail View**
   - Full tenant profile
   - Maintenance request history
   - Rent payment history
   - Utility reading history

4. **Maintenance Integration**
   - Only approved tenants can submit to PM
   - Link maintenance requests to tenant records

---

## 📞 Support

**Application Running:** http://localhost:8000

**Documentation:**
- Full Implementation: `TENANT_MANAGEMENT_IMPLEMENTATION_SUMMARY.md`
- Quick Start: `TENANT_MANAGEMENT_QUICK_START.md` (this file)

**Logs Location:**
- Docker container logs: `docker compose -f docker/compose.yaml logs app`

---

## 🎉 Success Criteria

✅ Customer can submit onboarding request
✅ PM can view pending onboardings
✅ PM can approve tenant with lease details
✅ PM can reject tenant with reason
✅ Tenant status updates correctly
✅ Tenant overview dashboard displays metrics
✅ Navigation links added to dashboards
✅ Application deployed and accessible
✅ All Docker containers healthy
✅ Database migration applied successfully

**Status: ALL CRITERIA MET ✅**
