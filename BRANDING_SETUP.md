# Square 15 Facility Solutions - Branding Setup Guide

This document explains how to properly set up and maintain the Square 15 Facility Solutions branding throughout the system.

## 1. Logo Setup

### Current Status
The system is configured to use a logo file located at `public/logo.png`. Currently, this is a placeholder transparent image.

### Action Required: Replace the Logo
1. Obtain the official Square 15 Facility Solutions logo in PNG format
2. Ensure the logo has a transparent background for best results
3. Recommended dimensions: 300-500px width (height will auto-scale)
4. Replace the file at `public/logo.png` with your actual logo

### Where the Logo Appears
The logo is automatically displayed on:
- **Quotation PDFs** - Top left corner (100px width)
- **Invoice PDFs** - Top left corner (100px width)
- Additional PDF documents (job cards, order summaries)

## 2. Brand Colors Setup

### Current Configuration
The system uses a centralized color scheme defined in environment variables, now updated to match the Square 15 Facility Solutions logo:

- **Primary Color** (`#2D5016` - Dark Earthy Green): The main brand color from the logo, used for headers, primary buttons, and main branding elements
- **Secondary Color** (`#F4C430` - Vibrant Golden Yellow): The accent color from the logo, used for highlights and call-to-action elements
- **Accent Color** (`#5A9A47` - Medium Green): A complementary green shade, used for secondary highlights and accents
- **Success Color** (`#10b981` - Emerald Green): Used for completed items, success messages, and positive states
- **Warning Color** (`#f59e0b` - Amber): Used for pending items, warnings, and caution states
- **Danger Color** (`#dc2626` - Red): Used for urgent items, errors, and overdue status

These colors have been extracted from the Square 15 Facility Solutions logo and match the brand's professional, facility management identity.

### Action Required: Update Colors to Match Logo

Once you have the Square 15 Facility Solutions logo, extract the primary colors and update them in the `.env` file:

```bash
# Brand Colors (from Square 15 Facility Solutions logo)
BRAND_PRIMARY_COLOR=#1e40af      # Replace with your primary brand color
BRAND_SECONDARY_COLOR=#ea580c    # Replace with your secondary brand color
BRAND_ACCENT_COLOR=#0d9488       # Replace with your accent color
BRAND_SUCCESS_COLOR=#10b981      # Keep or adjust for success states
BRAND_WARNING_COLOR=#f59e0b      # Keep or adjust for warning states
BRAND_DANGER_COLOR=#dc2626       # Keep or adjust for error states
```

**Important Notes:**
- Colors must be in 6-digit hexadecimal format (e.g., `#1e40af`)
- Include the `#` symbol
- Use lowercase letters for consistency
- After changing colors, restart the application for changes to take effect

### How to Extract Colors from Your Logo

1. **Using an Image Editor** (Photoshop, GIMP, etc.):
   - Open your logo file
   - Use the eyedropper/color picker tool
   - Click on the main color in your logo
   - Copy the hexadecimal color code

2. **Using Online Tools**:
   - Upload your logo to a color palette generator (e.g., coolors.co, imagecolorpicker.com)
   - Extract the dominant colors
   - Use these hex codes in your `.env` file

3. **Recommended Color Distribution**:
   - **Primary**: The most dominant color in your logo (usually used for headers, main elements)
   - **Secondary**: The second most prominent color (used for accents, highlights)
   - **Accent**: A complementary color from your logo (used sparingly for emphasis)

## 3. Where Brand Colors Are Applied

### PDFs
- **Quotations**: Table headers, total sections, and accents use `BRAND_PRIMARY_COLOR`
- **Invoices**: Table headers, total sections use `BRAND_PRIMARY_COLOR`; status badges use success/danger colors
- **Job Cards & Orders**: Will be updated to use brand colors in future enhancements

### Frontend Components
The Tailwind CSS configuration has been set up with custom color classes:

```javascript
// You can use these classes in your components:
bg-brand-primary       // Background with primary color
text-brand-secondary   // Text with secondary color
border-brand-accent    // Border with accent color
bg-brand-success       // Success state background
bg-brand-warning       // Warning state background
bg-brand-danger        // Danger state background

// With opacity variants:
bg-brand-primary-100   // Lighter shade
bg-brand-primary-500   // Medium shade
bg-brand-primary-900   // Darker shade
```

### Current Component Usage
The system currently uses these brand colors in:
- Admin dashboard cards and metrics
- Quotations page (headers, buttons, status badges)
- Invoices page (headers, buttons, status badges)
- CRM, Operations, Projects, and other admin pages
- All status indicators and badges
- Form inputs and buttons

## 4. Testing Your Branding

After updating the logo and colors:

1. **Test PDFs**:
   - Create a test quotation and generate its PDF
   - Create a test invoice and generate its PDF
   - Verify the logo appears correctly
   - Verify colors match your brand

2. **Test Frontend**:
   - Navigate through the admin dashboard
   - Check that colors are consistent across all pages
   - Verify buttons, headers, and status badges use your brand colors

3. **Test Responsiveness**:
   - View the application on different screen sizes
   - Ensure branding looks good on mobile, tablet, and desktop

## 5. Maintenance

### Updating Colors
If you need to adjust colors later:
1. Update the hex codes in `.env`
2. Restart the application
3. Clear browser cache if colors don't update immediately

### Updating Logo
If you need to replace the logo:
1. Replace `public/logo.png` with your new logo
2. Keep the same filename
3. Refresh the application (no restart needed)
4. Regenerate any previously created PDFs to show the new logo

## 6. Banking Details

### Current Configuration
The system is configured with the following banking details for payment information on invoices:

- **Bank Name**: Nedbank
- **Account Name**: Square 15 Facility Solutions
- **Account Number**: 1229572716
- **Branch Code**: 198765

These details are automatically displayed on all invoice PDFs in the "PAYMENT DETAILS" section.

### Updating Banking Details
If you need to update the banking information:
1. Open the `.env` file
2. Update the following variables:
   ```bash
   COMPANY_BANK_NAME=Nedbank
   COMPANY_BANK_ACCOUNT_NAME="Square 15 Facility Solutions"
   COMPANY_BANK_ACCOUNT_NUMBER=1229572716
   COMPANY_BANK_BRANCH_CODE=198765
   ```
3. Restart the application for changes to take effect
4. Regenerate any invoices to show the new banking details

**Security Note**: Banking details are stored in environment variables and are only displayed on official invoices. They are not exposed through the public API.

## 7. Troubleshooting

### Logo Not Appearing in PDFs
- Verify the file exists at `public/logo.png`
- Check that the file is a valid PNG image
- Ensure the file isn't corrupted
- Check file permissions (should be readable)

### Colors Not Updating
- Verify hex codes are in correct format (`#RRGGBB`)
- Ensure you've restarted the application after changing `.env`
- Clear browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check that there are no typos in the environment variable names

### Colors Look Different in PDFs vs. Frontend
- PDFs use exact hex values from environment variables
- Frontend uses Tailwind's color system which includes opacity variants
- Both should use the same base colors, but may appear slightly different due to rendering engines

## 8. Support

For questions or issues with branding setup, contact your development team or refer to:
- Tailwind CSS documentation: https://tailwindcss.com/docs/customizing-colors
- PDFKit documentation: http://pdfkit.org/

---

**Current Status Summary:**
- ✅ System is configured to use centralized brand colors
- ✅ Tailwind CSS theme includes custom brand color classes
- ✅ PDF generation uses environment-based colors
- ✅ Logo replaced with official Square 15 Facility Solutions logo
- ✅ Brand colors updated to match Square 15 logo (dark green and golden yellow)
- ✅ Banking details configured and documented
