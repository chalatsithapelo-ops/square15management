import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { env } from "~/server/env";

export const generateInvoiceDescription = baseProcedure
  .input(
    z.object({
      token: z.string(),
      briefDescription: z.string().min(3, "Description must be at least 3 characters"),
      serviceType: z.string().optional(),
      quantity: z.number().optional(),
      context: z.object({
        projectName: z.string().optional(),
        location: z.string().optional(),
        specifications: z.string().optional(),
      }).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    try {
      // Set up AI model
      const model = google("gemini-2.0-flash-exp");

      // Build context
      let contextInfo = "";
      if (input.context) {
        if (input.context.projectName) {
          contextInfo += `\nProject: ${input.context.projectName}`;
        }
        if (input.context.location) {
          contextInfo += `\nLocation: ${input.context.location}`;
        }
        if (input.context.specifications) {
          contextInfo += `\nSpecifications: ${input.context.specifications}`;
        }
      }

      // Generate description
      const { object } = await generateObject({
        model,
        schema: z.object({
          fullDescription: z.string().describe("Complete, professional description suitable for invoice"),
          shortDescription: z.string().describe("Concise version for summaries (max 60 characters)"),
          technicalDetails: z.string().optional().describe("Technical specifications or details, if applicable"),
          includedItems: z.array(z.string()).optional().describe("List of specific items or services included"),
          notes: z.string().optional().describe("Additional notes or clarifications"),
        }),
        prompt: `You are a professional billing specialist for ${env.COMPANY_NAME}, a South African facility management and construction company.

Generate a detailed, professional invoice line item description from the following input:

Brief Description: ${input.briefDescription}
${input.serviceType ? `Service Type: ${input.serviceType}` : ""}
${input.quantity ? `Quantity: ${input.quantity}` : ""}
${contextInfo}

Guidelines:

1. Full Description:
   - Clear and professional
   - Specific enough to avoid ambiguity
   - Include key details (materials, scope, location if relevant)
   - Use proper industry terminology
   - Follow South African conventions
   - Typically 1-3 sentences

2. Short Description:
   - Maximum 60 characters
   - Suitable for invoice line item summary
   - Captures the essence

3. Technical Details (if applicable):
   - Specifications, standards, or codes
   - Materials or brands used
   - Technical requirements met
   - Only include if relevant

4. Included Items:
   - Break down what's included in this line item
   - Materials, labor, equipment, etc.
   - Only if it adds clarity

5. Notes:
   - Important disclaimers or clarifications
   - Warranty information
   - Exclusions
   - Only if necessary

Examples:

Input: "Painted office walls"
Output:
- Full: "Interior wall preparation, priming, and painting of office walls (45m²) with premium acrylic paint (2 coats). Includes surface preparation, filling of minor imperfections, and final cleanup."
- Short: "Interior office wall painting - 45m²"
- Technical: "Dulux Premium Acrylic, color code: Whisper White"
- Included: ["Surface preparation and cleaning", "Primer coat", "2 finish coats", "Final cleanup"]

Input: "Fixed plumbing leak"
Output:
- Full: "Emergency plumbing repair: diagnosed and repaired water leak in kitchen under-sink piping. Replaced damaged section of PVC pipe, installed new compression fittings, and tested for leaks."
- Short: "Emergency plumbing repair - kitchen leak"
- Technical: "40mm PVC pipe, compression fittings, SABS approved materials"
- Included: ["Leak diagnosis", "Pipe replacement", "Fitting installation", "Leak testing"]

Input: "Electrical work"
Output:
- Full: "Installation of 3x double electrical socket outlets in boardroom, including cable routing through existing conduit, connection to distribution board, and compliance testing per SANS 10142-1."
- Short: "Electrical socket installation - 3x double outlets"
- Technical: "SANS 10142-1 compliant, COC issued"
- Included: ["Cable routing", "Socket installation", "DB connection", "Compliance testing", "COC documentation"]

Be professional, clear, and specific. Avoid vague language.`,
      });

      return {
        fullDescription: object.fullDescription,
        shortDescription: object.shortDescription,
        technicalDetails: object.technicalDetails,
        includedItems: object.includedItems,
        notes: object.notes,
        generatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Error generating invoice description:", error);
      
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
          message: "AI description generation is currently unavailable. Please write description manually.",
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
        message: "Failed to generate description. Please write manually.",
      });
    }
  });
