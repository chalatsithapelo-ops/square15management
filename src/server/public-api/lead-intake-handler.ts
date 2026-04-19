import { eventHandler, readBody, getMethod } from "h3";
import { db } from "~/server/db";
import { sendEmail } from "~/server/utils/email";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

/**
 * Public Lead Intake API - No authentication required.
 * Designed for integration with www.square15.co.za contact form.
 *
 * POST /api/leads/intake
 * Body: { name, email, phone, serviceType, message, company?, address?, source? }
 *
 * Returns: { success: true, leadId: number, message: string }
 */
const handler = eventHandler(async (event) => {
  const method = getMethod(event);

  // Handle preflight OPTIONS request
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await readBody(event);

    // Validate required fields
    const errors: string[] = [];
    if (!body?.name || typeof body.name !== "string" || body.name.trim().length < 2) {
      errors.push("name is required (min 2 characters)");
    }
    if (!body?.email || typeof body.email !== "string" || !body.email.includes("@")) {
      errors.push("email is required (valid email address)");
    }
    if (!body?.phone || typeof body.phone !== "string" || body.phone.trim().length < 7) {
      errors.push("phone is required (min 7 characters)");
    }
    if (!body?.serviceType || typeof body.serviceType !== "string") {
      errors.push("serviceType is required (e.g., Plumbing, Electrical, Roof Repair)");
    }
    if (!body?.message || typeof body.message !== "string" || body.message.trim().length < 5) {
      errors.push("message is required (min 5 characters, describe what you need)");
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, errors }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Rate limiting: check if same email submitted in last 10 minutes
    const recentLead = await db.lead.findFirst({
      where: {
        customerEmail: body.email.trim().toLowerCase(),
        createdAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        },
      },
    });

    if (recentLead) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Your enquiry has been received. We will contact you shortly.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Find an admin user as the default lead owner
    const adminUser = await db.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { id: "asc" },
    });

    if (!adminUser) {
      console.error("[lead-intake] No admin user found to assign lead to");
      return new Response(
        JSON.stringify({ success: false, error: "System configuration error" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Determine source
    const validSources = ["WEBSITE", "REFERRAL", "CAMPAIGN", "PHONE", "WALK_IN", "AI_AGENT", "SOCIAL_MEDIA", "OTHER"];
    const source = validSources.includes(body.source) ? body.source : "WEBSITE";

    // Create the lead in the CRM
    const lead = await db.lead.create({
      data: {
        customerName: body.name.trim(),
        companyName: body.company?.trim() || null,
        customerEmail: body.email.trim().toLowerCase(),
        customerPhone: body.phone.trim(),
        address: body.address?.trim() || null,
        serviceType: body.serviceType.trim(),
        description: body.message.trim(),
        estimatedValue: body.estimatedValue ? parseFloat(body.estimatedValue) : null,
        status: "NEW",
        source: source,
        createdById: adminUser.id,
        // Set follow-up for same day
        nextFollowUpDate: new Date(),
        followUpAssignedToId: adminUser.id,
      },
    });

    console.log(`[lead-intake] New website lead created: ID ${lead.id} from ${lead.customerEmail} (source: ${source})`);

    // Send auto-acknowledge email to the customer (fire and forget)
    (async () => {
      try {
        const companyDetails = await getCompanyDetails();
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR || "#1e40af"} 0%, ${env.BRAND_ACCENT_COLOR || "#3b82f6"} 100%); color: white; padding: 30px 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">${companyDetails.companyName}</h1>
              </div>
              
              <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                <h2 style="color: ${env.BRAND_PRIMARY_COLOR || "#1e40af"}; margin-top: 0;">Thank You for Your Enquiry!</h2>
                
                <p>Dear ${body.name.trim()},</p>
                
                <p>Thank you for reaching out to <strong>${companyDetails.companyName}</strong>. We have received your enquiry and one of our team members will be in touch with you shortly.</p>
                
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: ${env.BRAND_PRIMARY_COLOR || "#1e40af"};">Your Enquiry Summary</h3>
                  <p><strong>Service Needed:</strong> ${body.serviceType.trim()}</p>
                  <p><strong>Details:</strong> ${body.message.trim()}</p>
                  ${body.address ? `<p><strong>Location:</strong> ${body.address.trim()}</p>` : ""}
                  <p><strong>Reference #:</strong> SQR-${lead.id}</p>
                </div>
                
                <p>In the meantime, feel free to contact us directly:</p>
                <ul>
                  <li>Phone: ${companyDetails.companyPhone}</li>
                  <li>Email: ${companyDetails.companyEmail}</li>
                </ul>
                
                <p>We look forward to assisting you!</p>
                
                <p>Best regards,<br><strong>${companyDetails.companyName} Team</strong></p>
              </div>
              
              <div style="background: #f9fafb; text-align: center; padding: 20px; color: #666; font-size: 12px;">
                <p><strong>${companyDetails.companyName}</strong></p>
                <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
                <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await sendEmail({
          to: lead.customerEmail,
          subject: `Thank you for your enquiry - ${companyDetails.companyName}`,
          html,
        });

        console.log(`[lead-intake] Auto-acknowledge email sent to ${lead.customerEmail}`);
      } catch (emailError) {
        console.error("[lead-intake] Failed to send auto-acknowledge email:", emailError);
      }
    })();

    // Notify admin about the new lead (fire and forget)
    (async () => {
      try {
        await db.notification.create({
          data: {
            recipientId: adminUser.id,
            recipientRole: "ADMIN",
            message: `🌐 New website lead: ${lead.customerName} (${lead.serviceType}) - ${lead.customerEmail}`,
            type: "SYSTEM_ALERT",
            relatedEntityId: lead.id,
            relatedEntityType: "LEAD",
          },
        });
      } catch (notifyError) {
        console.error("[lead-intake] Failed to create admin notification:", notifyError);
      }
    })();

    return new Response(
      JSON.stringify({
        success: true,
        leadId: lead.id,
        message: "Thank you! Your enquiry has been received. We will contact you shortly.",
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[lead-intake] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: corsHeaders }
    );
  }
});

export default handler;
