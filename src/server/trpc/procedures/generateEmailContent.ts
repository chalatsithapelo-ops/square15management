import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { env } from "~/server/env";

const emailTypeSchema = z.enum([
  "LEAD_FOLLOW_UP",
  "QUOTATION_SUBMISSION",
  "INVOICE_REMINDER",
  "PROJECT_UPDATE",
  "MEETING_REQUEST",
  "THANK_YOU",
  "GENERAL",
]);

export const generateEmailContent = baseProcedure
  .input(
    z.object({
      token: z.string(),
      emailType: emailTypeSchema,
      recipientName: z.string(),
      context: z.object({
        leadDetails: z.string().optional(),
        projectName: z.string().optional(),
        invoiceNumber: z.string().optional(),
        amount: z.number().optional(),
        dueDate: z.string().optional(),
        customInstructions: z.string().optional(),
      }).optional(),
      tone: z.enum(["PROFESSIONAL", "FRIENDLY", "URGENT", "FORMAL"]).default("PROFESSIONAL"),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    try {
      // Set up AI model
      const model = google("gemini-2.0-flash-exp");

      // Build context-specific information
      let contextInfo = "";
      if (input.context) {
        if (input.context.leadDetails) {
          contextInfo += `\nLead Details: ${input.context.leadDetails}`;
        }
        if (input.context.projectName) {
          contextInfo += `\nProject Name: ${input.context.projectName}`;
        }
        if (input.context.invoiceNumber) {
          contextInfo += `\nInvoice Number: ${input.context.invoiceNumber}`;
        }
        if (input.context.amount) {
          contextInfo += `\nAmount: R${input.context.amount.toLocaleString()}`;
        }
        if (input.context.dueDate) {
          contextInfo += `\nDue Date: ${input.context.dueDate}`;
        }
        if (input.context.customInstructions) {
          contextInfo += `\nAdditional Instructions: ${input.context.customInstructions}`;
        }
      }

      // Map email type to description
      const emailTypeDescriptions = {
        LEAD_FOLLOW_UP: "Following up with a potential customer about their service inquiry",
        QUOTATION_SUBMISSION: "Submitting a quotation for review and approval",
        INVOICE_REMINDER: "Reminding a customer about an outstanding invoice payment",
        PROJECT_UPDATE: "Providing a status update on an ongoing project",
        MEETING_REQUEST: "Requesting a meeting or site visit",
        THANK_YOU: "Thanking a customer for their business",
        GENERAL: "General business communication",
      };

      // Generate email content
      const { object } = await generateObject({
        model,
        schema: z.object({
          subject: z.string().describe("Email subject line - clear, professional, and engaging"),
          greeting: z.string().describe("Professional greeting addressing the recipient"),
          body: z.string().describe("Main email body - well-structured with paragraphs"),
          callToAction: z.string().optional().describe("Clear call-to-action or next steps"),
          closing: z.string().describe("Professional closing statement"),
          signature: z.string().describe("Email signature line"),
        }),
        prompt: `You are a professional business communication specialist for ${env.COMPANY_NAME}, a South African facility management and construction services company.

Generate a professional business email with the following details:

Email Type: ${emailTypeDescriptions[input.emailType]}
Recipient Name: ${input.recipientName}
Tone: ${input.tone}
${contextInfo}

Sender Information:
- Name: ${user.firstName} ${user.lastName}
- Company: ${env.COMPANY_NAME}
- Role: ${user.role}

Guidelines:
1. Subject Line:
   - Clear and specific
   - Professional but engaging
   - Indicates the purpose immediately

2. Email Body:
   - Start with a warm, professional greeting
   - Be clear, concise, and well-structured
   - Use short paragraphs for readability
   - Include all relevant details from the context
   - Maintain a ${input.tone.toLowerCase()} tone throughout
   - Use South African English conventions

3. Call-to-Action (if applicable):
   - Be specific about next steps
   - Make it easy for the recipient to respond
   - Include deadlines if relevant

4. Closing:
   - Professional and warm
   - Reinforce the relationship
   - Express availability for questions

5. Tone Guidelines:
   - PROFESSIONAL: Polished and business-like, but approachable
   - FRIENDLY: Warm and personable while maintaining professionalism
   - URGENT: Convey importance without being aggressive
   - FORMAL: More structured and traditional business language

Remember:
- This is for a South African audience
- Use "R" for currency (e.g., R10,000)
- Be respectful and customer-focused
- Avoid overly salesy language
- Focus on building relationships

Format the email in a way that's ready to send - no placeholder text or brackets.`,
      });

      return {
        subject: object.subject,
        greeting: object.greeting,
        body: object.body,
        callToAction: object.callToAction,
        closing: object.closing,
        signature: object.signature,
        fullEmail: `${object.greeting}\n\n${object.body}${object.callToAction ? `\n\n${object.callToAction}` : ""}\n\n${object.closing}\n\n${object.signature}`,
      };
    } catch (error: any) {
      console.error("Error generating email content:", error);
      
      const errorMessage = error.message || error.toString();
      
      if (errorMessage.includes("Payment Required") || 
          errorMessage.includes("402") || 
          errorMessage.includes("insufficient credits") ||
          errorMessage.includes("insufficient_quota") ||
          errorMessage.includes("billing") ||
          errorMessage.includes("Invalid API key") ||
          errorMessage.includes("Incorrect API key") ||
          errorMessage.includes("401")) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI email generation is currently unavailable due to API configuration issues. Please write your email manually.",
        });
      }
      
      if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "AI service rate limit exceeded. Please try again in a few moments.",
        });
      }
      
      if (error instanceof TRPCError) throw error;
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate email content. Please write your email manually.",
      });
    }
  });
