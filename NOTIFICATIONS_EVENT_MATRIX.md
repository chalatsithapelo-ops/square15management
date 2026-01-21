# Notifications + Emails Event Matrix

This document maps key business events to:
- **Recipients** (portal roles)
- **Channels** (in-app notification + email)
- **NotificationType enum** (authoritative values from `prisma/schema.prisma`)
- **Primary TRPC procedure(s)** where the event is emitted

Notes:
- In-app notifications are best-effort and should not block the main mutation.
- Email is best-effort and should not block the main mutation.
- In-app notification creation should prefer `createNotification(...)` / `notifyAdmins(...)` helpers so user preferences (`disabledNotificationTypes`) and realtime/web-push are respected.

---

## RFQs (Property Manager RFQ)

| Event | Recipients | In-app type | Email | Main procedures |
|------|------------|-------------|-------|----------------|
| RFQ submitted | Contractors (portal users) | `RFQ_SUBMITTED` | Yes | `createPropertyManagerRFQ`, `updatePropertyManagerRFQ` (when status becomes SUBMITTED) |
| RFQ submitted (no contractor selected) | Admins | `RFQ_SUBMITTED` | Optional | `createPropertyManagerRFQ`, `updatePropertyManagerRFQ` |
| Quotation submitted for RFQ | Property Manager | `RFQ_QUOTED` | Yes | `createQuotationFromPMRFQ` |
| RFQ approved by PM (admin quote workflow) | Admins | `RFQ_APPROVED` | Optional | `updatePropertyManagerRFQStatus` |
| RFQ rejected by PM (admin quote workflow) | Admins | `RFQ_REJECTED` | Optional | `updatePropertyManagerRFQStatus` |
| PM selects winning quotation (contractor quotation workflow) | Quotation creators (contractor/artisan users) | `RFQ_APPROVED` / `RFQ_REJECTED` | Yes | `selectQuotationForRFQ` |

---

## Property Manager Orders

| Event | Recipients | In-app type | Email | Main procedures |
|------|------------|-------------|-------|----------------|
| PM order created + assigned to portal contractor | Contractor | `ORDER_ASSIGNED` | Yes | `createPropertyManagerOrder` |
| PM order created + no contractor selected | Admins | `PM_ORDER_SUBMITTED` | Optional | `createPropertyManagerOrder` |
| PM order accepted by contractor | Property Manager + Admins | `PM_ORDER_ACCEPTED` | Yes (PM) | `acceptPMOrder` |
| PM order status updated | Property Manager | `PM_ORDER_STATUS_UPDATED` | Optional | `updatePropertyManagerOrderStatus` |
| PM order completed | Property Manager + Admins (recommended) | `PM_ORDER_COMPLETED` | Optional | (where completion is finalized) |

---

## Maintenance Requests linked to PM Orders

| Event | Recipients | In-app type | Email | Main procedures |
|------|------------|-------------|-------|----------------|
| Maintenance request converted order moves in-progress | Customer | `MAINTENANCE_REQUEST_APPROVED` (best match) | Optional | `updatePropertyManagerOrderStatus` |
| Maintenance request converted order completed | Customer | `MAINTENANCE_REQUEST_COMPLETED` | Optional | `updatePropertyManagerOrderStatus` |

---

## Property Manager Invoices

| Event | Recipients | In-app type | Email | Main procedures |
|------|------------|-------------|-------|----------------|
| Contractor sends PM invoice to Property Manager | Property Manager + Admins | `PM_INVOICE_SENT` | Yes (PM) | `updateContractorPMInvoiceStatus` (when status becomes SENT_TO_PM) |
| PM approves invoice | Contractor + Admins | `PM_INVOICE_APPROVED` | Yes (contractor) | `updatePropertyManagerInvoiceStatus` |
| PM rejects invoice | Contractor + Admins | `PM_INVOICE_REJECTED` | Yes (contractor) | `updatePropertyManagerInvoiceStatus` |
| PM marks invoice paid | Contractor + Admins | (no dedicated enum; use `PM_INVOICE_APPROVED` as best match) | Yes (contractor) | `updatePropertyManagerInvoiceStatus` |

---

## Regular Orders / Invoices / Statements (non-PM)

These are covered by existing procedures and the earlier enhancements:
- `updateOrderStatus`
- `updateInvoiceStatus`
- `generateStatement`
- `updateMaintenanceRequestStatus`

NotificationType enums used in those flows include:
- `ORDER_STATUS_UPDATED`, `INVOICE_STATUS_UPDATED`, `STATEMENT_GENERATED`, and maintenance-specific enums.

---

## Production Verification Checklist

Use this checklist after deploying to confirm notifications + emails are live end-to-end.

### Preconditions
- Use real accounts for each role: **Property Manager**, **Contractor**, **Admin**, and (if applicable) **Customer**.
- Ensure recipients have not disabled the notification type in their preferences (`disabledNotificationTypes`).
- Ensure SMTP is configured (company SMTP, or per-user SMTP if you expect “send as user”).

### What to verify (per event)

#### RFQ submitted
- Action: submit an RFQ.
- Expect in-app: contractor portal users get `RFQ_SUBMITTED`; admins get `RFQ_SUBMITTED` only when no contractors selected.
- Expect email: contractor users and email-only contractors receive RFQ email.
- Portal screens to check:
	- Contractor: RFQs list (and the notification dropdown)
	- Admin: notifications panel

#### Quotation submitted for RFQ
- Action: contractor/artisan submits a quotation for an RFQ.
- Expect in-app: Property Manager gets `RFQ_QUOTED`.
- Expect email: Property Manager receives “New Quotation Received”.
- Portal screen to check: Property Manager RFQs list.

#### PM selects winning quotation
- Action: Property Manager selects the winning quotation.
- Expect in-app: quotation creator gets `RFQ_APPROVED` (winner) or `RFQ_REJECTED` (non-winners).
- Expect email: quotation creator(s) receive decision email.

#### PM order accepted
- Action: contractor accepts the PM order.
- Expect in-app: Property Manager + admins get `PM_ORDER_ACCEPTED`.
- Expect email: Property Manager receives acceptance email.
- Portal screens to check:
	- Property Manager Orders list
	- Admin notifications

#### PM invoice sent to PM
- Action: contractor sends PM invoice (transition to `SENT_TO_PM`).
- Expect in-app: Property Manager + admins get `PM_INVOICE_SENT`.
- Expect email: Property Manager receives invoice notification email.
- Portal screen to check: Property Manager Invoices list.

#### PM invoice approved / rejected / marked paid
- Action: Property Manager approves/rejects/marks paid.
- Expect in-app: contractor gets `PM_INVOICE_APPROVED` or `PM_INVOICE_REJECTED`.
- Expect email: contractor receives invoice update email.

### Quick failure triage
- In-app missing:
	- Confirm the recipient user exists and has the right role.
	- Check the recipient didn’t disable that `NotificationType`.
	- Confirm the code path uses `createNotification` / `notifyAdmins` and the notification row exists in DB.
- Email missing:
	- Check server logs around the mutation (email sending is best-effort and logs failures).
	- Confirm SMTP config and sender identity rules (company vs per-user SMTP).

