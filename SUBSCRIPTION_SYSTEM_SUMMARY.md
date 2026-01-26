# Subscription System Implementation Summary

## ✅ Completed

### 1. Database Schema
- Created `Package`, `Subscription`, `Payment`, `PendingRegistration` models
- Added enums: `PackageType`, `SubscriptionStatus`, `PaymentStatus`, `PaymentMethod`
- Established relationships with User model
- **8 Packages Created**:
  - **Contractors**: S1 (R195), S2 (R350), S3 (R400), S4 (R450), S5 (R600), S6 (R650)
  - **Property Managers**: PM1 (R2500), PM2 (R3500)
  - Additional user cost: R100 (contractors), R950 (PM employees/contractors)
  - Additional tenant cost: R50 (PM only)
  - **Free 30-day trial** on S6 and PM2

### 2. Feature Access Control
Each package has specific feature flags:
- S1: Quotations, Invoices, Statements
- S2: + Operations Management
- S3: + Payments
- S4: + CRM, Project Management
- S5: + Assets, HR, Messages
- S6: + AI Agent, AI Insights (Full Access)
- PM1: Full system without AI
- PM2: Full system with AI (Full Access)

### 3. Backend Infrastructure
- **Subscription Utilities** (`src/server/utils/subscription.ts`):
  - `hasActiveSubscription()` - Check if user has active/trial subscription
  - `getUserSubscription()` - Get subscription with auto-expiry checks
  - `hasFeatureAccess()` - Verify access to specific features
  - `canAddUser()` - Check user limit
  - `incrementUserCount()` / `decrementUserCount()` - Manage user counts
  - `requireSubscription()` - Throw error if no access
  - `calculateSubscriptionCost()` - Calculate total monthly cost

- **tRPC Procedures** (`src/server/trpc/procedures/subscriptions.ts`):
  - `getPackages` - List all active packages (filtered by type)
  - `getUserSubscription` - Get current user subscription with payment history
  - `createSubscription` - Admin creates subscription for user
  - `updateSubscriptionPackage` - Admin changes package/users
  - `updatePackagePricing` - Admin adjusts pricing (no code changes needed)
  - `activateSubscription` - Admin activates suspended account
  - `suspendSubscription` - Admin suspends account
  - `getAllSubscriptions` - Admin views all subscriptions with filters

- **Registration Procedures** (`src/server/trpc/procedures/registration.ts`):
  - `createPendingRegistration` - Self-registration submission
  - `getPendingRegistrations` - Admin views pending approvals
  - `approvePendingRegistration` - Admin creates account + subscription
  - `rejectPendingRegistration` - Admin rejects with reason
  - `markRegistrationAsPaid` - Admin confirms payment received

### 4. Trial Period Logic
- Automatic 30-day trial for S6 and PM2 packages
- Auto-expiry check on `getUserSubscription()`
- Status changes: `TRIAL` → `EXPIRED` when trial ends
- Manual activation after payment required

## 🔧 Next Steps (To Be Implemented)

### 1. Payment Gateway Integration (Priority: HIGH)
**Recommended**: PayFast (South African, widely used)
- Create PayFast integration service
- Add webhook handler for payment notifications
- Implement automatic activation on successful payment
- Support card payments, EFT, instant EFT
- **Alternative**: Paystack (also good for SA)

### 2. Admin UI Components
**Location**: `/admin/subscriptions`
- **Package Management**:
  - View all 8 packages in cards/table
  - Edit pricing inline (no code changes)
  - Toggle package active/inactive
- **Subscription Management**:
  - List all subscriptions (Active, Trial, Suspended, Expired)
  - View details: user, package, dates, payment status
  - Actions: Activate, Suspend, Change Package, Add Users
- **Pending Registrations**:
  - List with filters (Paid/Unpaid, Approved/Pending)
  - Approve/Reject actions
  - Manual payment confirmation

### 3. Self-Registration Landing Page
**Location**: Public landing page or `/register`
- Package selection (Contractor S1-S6 or PM PM1-PM2)
- User count selector (shows price calculation)
- Tenant/contractor count selector (PM only)
- Company information form
- Payment integration
- Success message: "Pending approval"

### 4. Dashboard Access Control
**Files to modify**:
- Admin Dashboard: No restrictions (full access)
- Contractor Dashboard: Check `hasFeatureAccess()` before showing:
  - Operations section (S2+)
  - Payments (S3+)
  - CRM (S4+)
  - Projects (S4+)
  - Assets (S5+)
  - HR (S5+)
  - Messages (S5+)
  - AI Agent (S6 only)
- Property Manager Dashboard: Similar checks for PM1/PM2
- Show upgrade prompts for locked features

### 5. Middleware Implementation
**Where to add**:
- Add `requireSubscription()` checks in sensitive tRPC procedures:
  - `createQuotation` → requires `hasQuotations`
  - `createInvoice` → requires `hasInvoices`
  - `createOrder` → requires `hasOperations`
  - `createLead` → requires `hasCRM`
  - `createProject` → requires `hasProjectManagement`
  - `createAsset` → requires `hasAssets`
  - `createEmployee` → requires `hasHR`
  - `sendMessage` → requires `hasMessages`
  - `aiAgent` → requires `hasAIAgent`

### 6. Payment Webhooks
- Create the PayFast ITN (notify) endpoint (implemented as a Vinxi http router)
  - Live URL pattern: `/api/payments/payfast/notify/payfast-notify`
- Verify payment signature
- Update `PendingRegistration.hasPaid = true`
- Auto-approve if configured (or send admin notification)
- Create `Payment` record
- Activate subscription if approved

### 7. Billing Automation
- Create cron job to check `nextBillingDate`
- Send payment reminders 7 days before
- Suspend subscriptions with overdue payments
- Generate monthly invoices

### 8. User Notifications
- Email on registration submission
- Email on approval/rejection
- Email on trial expiration (7 days, 3 days, 1 day)
- Email on payment due
- Email on suspension

## 📋 Admin Workflow

### Onboard New Client (Admin Portal)
1. Navigate to `/admin/subscriptions/pending`
2. Review registration: company, email, package, users
3. Verify payment received (manual or webhook)
4. Click "Approve" → Set password → Client account created
5. Client receives email with credentials

### Self-Registration Workflow (Landing Page)
1. Client selects Contractor or Property Manager
2. Client chooses package (S1-S6 or PM1-PM2)
3. Client specifies additional users/tenants/contractors
4. System calculates total monthly cost
5. Client completes payment (PayFast)
6. Registration marked as "Paid"
7. Admin approves → Account activated
8. Client receives welcome email

### Trial Management
- S6 and PM2 start with 30-day trial
- Status: `TRIAL`
- Auto-expires after 30 days → Status: `EXPIRED`
- Admin can manually activate after payment

### Package Upgrade/Downgrade
1. Admin navigates to user's subscription
2. Clicks "Change Package"
3. Selects new package
4. Adjusts user/tenant counts if needed
5. Saves → Takes effect immediately

### Pricing Changes
1. Admin navigates to `/admin/subscriptions/packages`
2. Finds package (e.g., S3)
3. Edits pricing fields inline
4. Saves → New pricing applies to new subscriptions
5. Existing subscriptions renew at current rates

## 🔐 Access Control Matrix

| Feature | S1 | S2 | S3 | S4 | S5 | S6 | PM1 | PM2 | Admin |
|---------|----|----|----|----|----|----|-----|-----|-------|
| Quotations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invoices | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Statements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Operations | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payments | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CRM | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Projects | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assets | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| HR | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Messages | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Agent | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| AI Insights | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |

## 💰 Pricing Calculator

### Contractor Example:
- S2 Package (R350) + 3 additional users (3 × R100 = R300) = **R650/month**

### Property Manager Example:
- PM2 Package (R3500) + 2 employees (2 × R950 = R1900) + 50 tenants (50 × R50 = R2500) = **R7900/month**

## 🚀 Deployment Status
- ✅ Database migrated to production
- ✅ Packages seeded (S1-S6, PM1-PM2)
- ✅ tRPC procedures registered
- ⏳ UI components (next step)
- ⏳ Payment gateway (next step)
- ⏳ Access control middleware (next step)
