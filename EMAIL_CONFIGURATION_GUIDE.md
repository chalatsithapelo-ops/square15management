# Email Configuration Guide

## Current Status ⚠️

Gmail SMTP authentication requires an **App Password** for security and reliability.

The system is currently configured with:
- **SMTP Host:** smtp.gmail.com
- **SMTP Port:** 587
- **SMTP User:** chalatsithapelo@gmail.com
- **SMTP Password:** ⚠️ **NEEDS TO BE UPDATED** - Currently using a regular Gmail password

**ACTION REQUIRED:** The current SMTP_PASSWORD appears to be a regular Gmail password (`910809Slowmo*`), which is insecure and may cause authentication failures. You must generate a Gmail App Password and update the `.env` file.

## Why This Matters

Gmail no longer accepts regular account passwords for SMTP authentication from third-party applications. Using a regular password will result in:
- ❌ Authentication errors ("Invalid login: 535-5.7.8 Username and Password not accepted")
- ❌ Security vulnerabilities
- ❌ Account lockouts
- ❌ Failed email delivery

**You must use a Gmail App Password instead.**

## Background: Why Gmail Requires App Passwords

Gmail requires **App Passwords** for SMTP authentication when using third-party applications for security reasons:

1. **Two-Factor Authentication (2FA)**: App Passwords work with 2FA, providing an extra layer of security
2. **Limited Scope**: App Passwords can be revoked individually without changing your main password
3. **Audit Trail**: Google tracks which apps use which App Passwords
4. **No Account Access**: App Passwords only allow email sending, not full account access

**Regular Gmail passwords are NOT supported** and will result in authentication failures.

## ⚠️ IMMEDIATE ACTION REQUIRED

Your current `.env` file contains what appears to be a regular Gmail password:

```env
SMTP_PASSWORD=910809Slowmo*  # ❌ This is NOT a Gmail App Password
```

This needs to be replaced with a proper Gmail App Password (a 16-character code like `abcdefghijklmnop`).

## How to Generate a Gmail App Password

### Step 1: Enable 2-Step Verification (if not already enabled)

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** in the left sidebar
3. Under "How you sign in to Google", click on **2-Step Verification**
4. Follow the prompts to enable 2-Step Verification if it's not already enabled
   - You'll need to verify your phone number
   - Choose your preferred second verification method (SMS, Google Authenticator, etc.)

### Step 2: Generate an App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** in the left sidebar
3. Under "How you sign in to Google", click on **2-Step Verification**
4. Scroll down to the bottom and click on **App passwords**
   - If you don't see this option, make sure 2-Step Verification is enabled
5. You may need to sign in again
6. Under "Select app", choose **Mail**
7. Under "Select device", choose **Other (Custom name)**
8. Enter a name like "Square 15 Management System" or "SMTP Server"
9. Click **Generate**
10. Google will display a 16-character App Password (e.g., `abcd efgh ijkl mnop`)
11. **IMPORTANT**: Copy this password immediately - you won't be able to see it again!

### Step 3: Update the .env File

1. Open the `.env` file in your project root
2. Find the line that says:
   ```
   SMTP_PASSWORD=910809Slowmo*
   ```
3. Replace it with your new App Password (remove all spaces):
   ```
   SMTP_PASSWORD=abcdefghijklmnop
   ```
   - Example: If Google shows `abcd efgh ijkl mnop`, enter `abcdefghijklmnop`
4. Save the file

### Step 4: Restart the Application

After updating the `.env` file, restart your application for the changes to take effect:

```bash
./scripts/stop
./scripts/run
```

### Step 5: Test Email Delivery

1. Log in to the admin dashboard
2. Navigate to **Settings** (or wherever the email test feature is located)
3. Send a test email to verify the configuration is working

## Troubleshooting

### "App passwords" option is not available

**Cause**: 2-Step Verification is not enabled on your Google Account.

**Solution**: Follow Step 1 above to enable 2-Step Verification first.

### Still getting authentication errors after updating

1. **Verify the App Password is correct**:
   - Make sure you removed all spaces from the App Password
   - Make sure you copied the entire 16-character password
   - The password is case-insensitive, but make sure you didn't accidentally include extra characters

2. **Generate a new App Password**:
   - Go back to Google Account → Security → 2-Step Verification → App passwords
   - Generate a new App Password
   - Update the `.env` file with the new password
   - Restart the application

3. **Check for account restrictions**:
   - Log in to the Gmail account via web browser
   - Check if there are any security alerts or restrictions on the account
   - Make sure the account is not locked or suspended

4. **Verify SMTP settings**:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Secure: `false` (STARTTLS will be used automatically)
   - User: Your full Gmail address (e.g., `chalatsithapelo@gmail.com`)

### Account uses Google Workspace (G Suite)

If your email is a Google Workspace account:

1. The workspace administrator may need to enable "Less secure apps" or configure SMTP relay
2. Contact your Google Workspace administrator
3. Alternatively, use the Gmail SMTP relay service:
   - Host: `smtp-relay.gmail.com`
   - Port: `587`
   - Requires additional workspace configuration

## Security Best Practices

1. **Keep App Passwords secure**: Treat them like regular passwords
2. **Use unique App Passwords**: Generate separate App Passwords for different applications
3. **Revoke unused App Passwords**: Regularly review and revoke App Passwords you're no longer using
4. **Monitor account activity**: Check your Google Account security page regularly for suspicious activity

## Alternative: Using a Different Email Provider

If you continue to have issues with Gmail, consider using a dedicated transactional email service:

- **SendGrid**: Free tier includes 100 emails/day
- **Mailgun**: Free tier includes 5,000 emails/month
- **Amazon SES**: Very low cost, high deliverability
- **Postmark**: Excellent deliverability, focused on transactional emails

These services often provide better deliverability and easier configuration for application-sent emails.

## Support

If you continue to experience issues after following this guide:

1. Check the application logs for detailed error messages
2. Verify the `.env` file has been saved correctly
3. Ensure the application has been restarted after making changes
4. Try sending a test email through the admin interface

For Gmail-specific issues, refer to:
- [Google Account Help - App Passwords](https://support.google.com/accounts/answer/185833)
- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
