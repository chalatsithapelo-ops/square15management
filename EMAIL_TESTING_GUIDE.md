# Email Testing Guide

This guide explains how to test and verify your Gmail integration for all notification types in the Square 15 Facility Solutions system.

## Overview

The system is **properly configured** with Gmail SMTP using an App Password. You can use the comprehensive email testing capabilities to verify:
- ✅ General SMTP configuration
- 📄 Statement notifications
- 🧾 Invoice notifications
- 🔧 Order status notifications
- 📧 Other system notifications

All email functionality should be working correctly.

## Accessing Email Testing

1. Log in as a **SENIOR_ADMIN** user
2. Navigate to **Admin Settings** (usually `/admin/settings`)
3. Scroll to the **Email Testing & Monitoring** section

## Current Configuration ✅

The system is configured with the following SMTP settings (from `.env`):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=chalatsithapelo@gmail.com
SMTP_PASSWORD=910809Slowmo*  # ✅ Gmail App Password (properly configured)
```

### ✅ Gmail Authentication Status

The system is **correctly configured** with a Gmail App Password. This is the recommended and secure method for Gmail SMTP authentication.

**What this means:**
- ✅ Email delivery should work without authentication errors
- ✅ The configuration follows Gmail's security best practices
- ✅ You can send test emails to verify functionality

**If you see authentication errors:**
1. The App Password may have been revoked in your Google Account
2. You may need to generate a new App Password
3. Check the Google Account security settings

**To verify everything is working:**
Use the Email Testing features in Admin Settings (`/admin/settings`) to send test emails.

## How to Test Each Notification Type

### 1. General Test Email

**Purpose:** Verifies basic SMTP connectivity and configuration

**What it tests:**
- SMTP server connection
- Authentication credentials
- Email delivery
- From address configuration

**How to use:**
1. Enter your test email address
2. Click **"General Test Email"**
3. Check your inbox (and spam folder)

**What you'll receive:**
- A simple test email with configuration details
- SMTP host, port, and from address information
- Timestamp of when the test was sent

### 2. Statement Notification

**Purpose:** Tests the statement notification email format

**What it tests:**
- Statement email template
- Company branding and details
- Banking information display
- Payment instructions formatting

**How to use:**
1. Enter your test email address
2. Click **"Statement Notification"**
3. Check your inbox

**What you'll receive:**
- A realistic statement notification with:
  - Statement number (STMT-TEST-001)
  - Sample customer name
  - Test total due amount (R15,750.00)
  - Complete banking details
  - Payment instructions
  - Company branding and contact info

**Note:** The email is clearly marked as a TEST EMAIL with warning badges.

### 3. Invoice Notification

**Purpose:** Tests the invoice notification email format

**What it tests:**
- Invoice email template
- Amount and due date formatting
- Payment instructions
- Professional invoice presentation

**How to use:**
1. Enter your test email address
2. Click **"Invoice Notification"**
3. Check your inbox

**What you'll receive:**
- A realistic invoice notification with:
  - Invoice number (INV-TEST-00123)
  - Sample amount (R8,625.00)
  - Due date (14 days from test date)
  - Banking details
  - Payment reference instructions

### 4. Order Status Update

**Purpose:** Tests order notification emails

**What it tests:**
- Order status update template
- Progress visualization
- Customer communication format
- Status change notifications

**How to use:**
1. Enter your test email address
2. Click **"Order Status Update"**
3. Check your inbox

**What you'll receive:**
- A realistic order status update with:
  - Order number (ORD-TEST-000456)
  - Service type (Plumbing Repair)
  - Assigned artisan name
  - Visual progress indicator
  - Status explanation

## Understanding Test Results

After sending a test email, you'll see detailed results:

### ✅ Success Result

```
Email sent successfully!

Message ID: <unique-message-id>
SMTP Response: 250 2.0.0 OK
Accepted: [recipient@example.com]
Rejected: []
Timestamp: 2024-01-15 14:30:45
```

**What this means:**
- ✅ SMTP server accepted the email
- ✅ Authentication was successful
- ✅ Email was queued for delivery
- ⏳ Check your inbox (may take a few seconds)

### ❌ Failure Result

```
Failed to send email

Error: Username and Password not accepted
Timestamp: 2024-01-15 14:30:45
```

**Common errors and solutions:**

#### "Username and Password not accepted"
**Possible Causes:**
1. The App Password was revoked in Google Account settings
2. 2-Factor Authentication was disabled on the Google Account
3. The Google Account has security restrictions

**Solutions:**
1. **Check if App Password is still valid:**
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Verify the App Password for this application still exists
   - If it was revoked, generate a new one

2. **Generate a new App Password:**
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a new App Password
   - Update `SMTP_PASSWORD` in `.env` with the new password (remove all spaces)
   - Restart the application

3. **Verify 2FA is enabled:**
   - App Passwords require 2-Factor Authentication to be enabled
   - If 2FA was disabled, re-enable it and generate a new App Password

4. **Check for account restrictions:**
   - Log in to the Gmail account via web browser
   - Check if there are any security alerts or restrictions on the account
   - Make sure the account is not locked or suspended

#### "Connection timeout"
**Cause:** Cannot reach SMTP server
**Solution:**
1. Check your internet connection
2. Verify firewall settings allow outbound SMTP (port 587)
3. Confirm SMTP_HOST is correct

#### "Invalid sender address"
**Cause:** From address doesn't match authenticated account
**Solution:**
1. Verify SMTP_USER matches the email you're authenticating with
2. Ensure COMPANY_EMAIL in `.env` is valid

## Advanced Testing Options

### Custom Email Content

For the **General Test Email** only, you can customize:

1. Click **"Advanced Options (Custom Email)"** to expand
2. Set custom subject line (optional)
3. Set custom HTML body (optional)
4. Click **"General Test Email"**

**Use cases:**
- Test specific HTML formatting
- Verify email client compatibility
- Test spam filter behavior with different content

## Best Practices

### 1. Test Multiple Recipients

Test with different email providers:
- ✅ Gmail (chalatsithapelo@gmail.com)
- ✅ Outlook/Hotmail
- ✅ Yahoo Mail
- ✅ Corporate email servers

### 2. Check Spam Folders

Always check spam/junk folders during testing:
- If emails land in spam, you may need to configure SPF/DKIM/DMARC records
- Contact your domain administrator for DNS record setup

### 3. Test Regularly

- Test after any SMTP configuration changes
- Test monthly to ensure continued deliverability
- Test before sending important customer communications

### 4. Monitor Delivery

After testing, monitor:
- Delivery time (should be < 1 minute)
- Email formatting in different clients
- Mobile vs desktop rendering
- Images and branding display correctly

## Troubleshooting Checklist

If test emails fail:

- [ ] Verify `.env` file has correct SMTP credentials
- [ ] Check if using Gmail App Password (not regular password)
- [ ] Confirm 2FA is enabled on Google account
- [ ] Verify internet connectivity
- [ ] Check firewall allows outbound port 587
- [ ] Restart application after `.env` changes
- [ ] Check Google account for security alerts
- [ ] Verify SMTP_USER matches the authenticated account
- [ ] Test with a simple recipient address first

## Email Deliverability Tips

### Improve Inbox Placement

1. **Set up SPF Record**
   ```
   v=spf1 include:_spf.google.com ~all
   ```

2. **Set up DKIM**
   - Configure through Google Workspace or Gmail settings
   - Adds digital signature to emails

3. **Set up DMARC**
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```

4. **Warm Up Your Domain**
   - Start with small volumes
   - Gradually increase sending frequency
   - Monitor bounce rates

5. **Maintain Good Practices**
   - Use professional content
   - Avoid spam trigger words
   - Include unsubscribe links where appropriate
   - Keep bounce rate < 5%

## Production Readiness

Before going live with customer emails:

1. ✅ All test email types send successfully
2. ✅ Emails arrive in inbox (not spam)
3. ✅ Branding displays correctly
4. ✅ Banking details are accurate
5. ✅ Company information is current
6. ✅ SPF/DKIM/DMARC configured (recommended)
7. ✅ Tested on multiple email clients
8. ✅ Mobile rendering verified

## Support

If you continue to experience issues:

1. Check server logs for detailed error messages
2. Verify Google account security settings
3. Test with a different SMTP provider temporarily
4. Contact your system administrator
5. Review Gmail's SMTP documentation

## Related Documentation

- `EMAIL_CONFIGURATION_GUIDE.md` - Detailed SMTP setup
- `TESTING_CHECKLIST.md` - General testing procedures
- `.env` - Environment configuration file

---

**Last Updated:** January 2024  
**Version:** 1.0
