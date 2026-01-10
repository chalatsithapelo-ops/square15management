# Gmail App Password Setup Guide

## 🎯 Objective

Replace the current insecure Gmail password in the `.env` file with a secure Gmail App Password for the email account: **chalatsithapelo@gmail.com**

## ⚠️ Current Status

**Email Account**: chalatsithapelo@gmail.com  
**Current Password Type**: Regular Gmail password (INSECURE)  
**Required Password Type**: Gmail App Password (16-character code)  
**Status**: ❌ **ACTION REQUIRED**

## 📋 Prerequisites

- Access to the Gmail account: chalatsithapelo@gmail.com
- Ability to receive verification codes (via SMS or authenticator app)
- Access to the project's `.env` file

## 🔐 Step-by-Step Instructions

### Part 1: Enable 2-Step Verification (if not already enabled)

1. **Open your Google Account settings**
   - Go to: https://myaccount.google.com/
   - Sign in with chalatsithapelo@gmail.com if prompted

2. **Navigate to Security**
   - Click on "Security" in the left sidebar
   - Or go directly to: https://myaccount.google.com/security

3. **Enable 2-Step Verification**
   - Look for "How you sign in to Google" section
   - Click on "2-Step Verification"
   - If it says "Off", click to turn it on
   - If it says "On", skip to Part 2

4. **Complete 2-Step Verification Setup**
   - Enter your phone number for verification
   - Choose how to receive codes (SMS or Voice call)
   - Enter the verification code you receive
   - Click "Turn on" to complete setup

### Part 2: Generate an App Password

1. **Access App Passwords**
   - Go to: https://myaccount.google.com/security
   - Scroll down to "How you sign in to Google"
   - Click on "2-Step Verification"
   - Scroll to the bottom of the page
   - Click on "App passwords"
   
   **Note**: If you don't see "App passwords", make sure:
   - 2-Step Verification is enabled (see Part 1)
   - You're using a personal Gmail account (not a work/school account)

2. **Generate the Password**
   - You may need to sign in again for security
   - Under "Select app", choose **"Mail"**
   - Under "Select device", choose **"Other (Custom name)"**
   - Type a name like: **"Square 15 Management System"**
   - Click **"Generate"**

3. **Copy the App Password**
   - Google will display a 16-character password in a yellow box
   - Example format: `abcd efgh ijkl mnop`
   - **CRITICAL**: Copy this password immediately!
   - You will NOT be able to see it again
   - Click "Done" after copying

### Part 3: Update the .env File

1. **Open the .env file**
   - Located in the project root directory
   - Open with a text editor

2. **Find the SMTP_PASSWORD line**
   - Look for this section:
   ```env
   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=chalatsithapelo@gmail.com
   SMTP_PASSWORD=910809Slowmo*
   ```

3. **Replace the password**
   - Replace `910809Slowmo*` with your new App Password
   - **IMPORTANT**: Remove all spaces from the App Password
   - If Google showed: `abcd efgh ijkl mnop`
   - You should enter: `abcdefghijklmnop`
   
   **Example**:
   ```env
   SMTP_PASSWORD=abcdefghijklmnop
   ```

4. **Save the file**
   - Save the `.env` file
   - Make sure there are no extra spaces or line breaks

### Part 4: Restart the Application

1. **Stop the application**
   ```bash
   ./scripts/stop
   ```

2. **Start the application**
   ```bash
   ./scripts/run
   ```

3. **Wait for startup**
   - Wait for the application to fully start
   - Check that there are no errors in the startup logs

### Part 5: Test Email Delivery

1. **Log in to the admin dashboard**
   - Navigate to the application in your browser
   - Log in with your admin credentials

2. **Go to Settings**
   - Navigate to: Admin → Settings
   - Or go directly to: http://localhost:8000/admin/settings

3. **Test email sending**
   - Scroll to "Email Testing & Monitoring" section
   - Enter a test email address (e.g., your personal email)
   - Click one of the test email buttons:
     - "General Test Email"
     - "Statement Notification"
     - "Invoice Notification"
     - "Order Status Update"

4. **Verify success**
   - Check for success message in the UI
   - Check the test email inbox (including spam folder)
   - Verify the email was received correctly

## ✅ Success Criteria

You'll know the setup was successful when:

1. ✅ The test email sends without errors
2. ✅ The test email arrives in the inbox (or spam folder)
3. ✅ No authentication errors appear in the application logs
4. ✅ The "Last Test Result" section shows a green success message

## ❌ Troubleshooting

### Problem: "App passwords" option not visible

**Cause**: 2-Step Verification is not enabled

**Solution**:
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification (see Part 1)
3. Wait a few minutes for the change to propagate
4. Refresh the page and try again

### Problem: Still getting "Invalid login" errors

**Possible causes and solutions**:

1. **Spaces in the App Password**
   - App Password format from Google: `abcd efgh ijkl mnop`
   - Required format in .env: `abcdefghijklmnop` (no spaces)
   - Solution: Remove ALL spaces from the password

2. **Incorrect App Password**
   - Solution: Generate a new App Password and try again
   - Go to https://myaccount.google.com/apppasswords
   - Revoke the old one and create a new one

3. **Application not restarted**
   - Solution: Make sure you stopped and restarted the application
   - Run: `./scripts/stop` then `./scripts/run`

4. **Wrong email address**
   - Verify SMTP_USER is: `chalatsithapelo@gmail.com`
   - Make sure there are no typos

### Problem: App Password works but emails go to spam

**Solution**:
1. This is normal for new sending addresses
2. Ask recipients to mark your emails as "Not Spam"
3. Over time, your sender reputation will improve
4. Consider setting up SPF, DKIM, and DMARC records for your domain

### Problem: Can't access Google Account

**Solution**:
1. Try resetting your password: https://accounts.google.com/signin/recovery
2. Check if the account is locked or suspended
3. Contact Google Support if needed

## 📝 Important Notes

1. **Security**:
   - Treat the App Password like a regular password
   - Don't share it with anyone
   - Don't commit it to version control

2. **App Password Management**:
   - You can have multiple App Passwords for different applications
   - You can revoke individual App Passwords without affecting others
   - Review and revoke unused App Passwords regularly

3. **If You Lose the App Password**:
   - You cannot retrieve a lost App Password
   - Simply generate a new one and update the `.env` file
   - Revoke the old one if you remember which one it was

4. **Regular Gmail Password**:
   - Your regular Gmail password remains unchanged
   - You use the regular password to sign in to Gmail
   - You use the App Password only for third-party applications

## 🔗 Useful Links

- [Google Account Security](https://myaccount.google.com/security)
- [Google App Passwords Help](https://support.google.com/accounts/answer/185833)
- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
- [2-Step Verification Help](https://support.google.com/accounts/answer/185839)

## 📞 Need Help?

If you're still experiencing issues after following this guide:

1. Check the application logs for detailed error messages
2. Verify the `.env` file syntax is correct
3. Make sure the application was restarted after changes
4. Try generating a fresh App Password
5. Test with a different email address to rule out recipient issues

## ✨ After Successful Setup

Once your Gmail App Password is working:

1. ✅ Mark this task as complete
2. ✅ Delete or securely store any notes containing the App Password
3. ✅ Test all email features in the application:
   - Invoice emails
   - Statement emails
   - Order notifications
   - Lead follow-up reminders
4. ✅ Monitor email delivery for the first few days
5. ✅ Consider setting up email domain authentication (SPF/DKIM/DMARC) for better deliverability

---

**Last Updated**: December 2024  
**Email Account**: chalatsithapelo@gmail.com  
**Application**: Square 15 Facility Solutions Management System
