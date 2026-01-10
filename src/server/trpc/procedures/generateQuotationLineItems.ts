import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export const generateQuotationLineItems = baseProcedure
  .input(
    z.object({
      token: z.string(),
      serviceDescription: z.string().min(1, "Service description is required"),
      serviceType: z.string().optional(),
      address: z.string().optional(),
      estimatedValue: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      // Verify authentication
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Set up AI model
      const model = google("gemini-2.0-flash-exp");

      // Generate line items
      const { object } = await generateObject({
        model,
        output: "array",
        schema: z.object({
          description: z.string().describe("Detailed description of the line item"),
          quantity: z.number().min(0).describe("Quantity needed"),
          unitPrice: z.number().min(0).describe("Estimated unit price in Rands"),
          unitOfMeasure: z.enum(["m2", "Lm", "Sum", "m3", "Hr"]).describe("Unit of measure"),
          notes: z.string().optional().describe("Additional notes or specifications"),
        }),
        prompt: `You are a professional estimator for a South African facility management company. Break down the following service request into detailed quotation line items.

Service Information:
- Description: ${input.serviceDescription}
${input.serviceType ? `- Service Type: ${input.serviceType}` : ""}
${input.address ? `- Address: ${input.address}` : ""}
${input.estimatedValue ? `- Estimated Budget: R${input.estimatedValue.toLocaleString()}` : ""}

Generate a detailed breakdown of line items needed to complete this work. Each line item should include:

1. Description: Clear, specific description of the work or material
2. Quantity: Realistic quantity estimate
3. Unit Price: Estimated price in South African Rands (be realistic for the local market)
4. Unit of Measure: Choose from:
   - "m2" for square meters (flooring, painting walls, etc.)
   - "Lm" for linear meters (piping, edging, etc.)
   - "Sum" for lump sum items (installation, one-time services)
   - "m3" for cubic meters (concrete, excavation)
   - "Hr" for hours (labor, consulting)
5. Notes: Any important specifications or assumptions

Guidelines:
- Include labor as separate line items where appropriate
- Break down materials into specific categories
- Consider prep work, cleanup, and finishing
- Be thorough but realistic
- Typical South African market rates:
  * Skilled labor: R200-400/hr
  * Painting: R30-80/m2
  * Plumbing fixtures: R500-3000 per item
  * Electrical points: R300-800 per point
  * Tiling: R150-400/m2 (including materials)
- Generate 4-8 line items depending on complexity
- If estimated budget is provided, ensure total is reasonable

Example line items:
- "Interior wall preparation and priming" - 45 m2 @ R25/m2
- "Premium acrylic paint application (2 coats)" - 45 m2 @ R55/m2
- "Skilled painter labor" - 16 Hr @ R280/Hr
- "Paint and materials supply" - 1 Sum @ R2500
`,
      });

      // Calculate totals for each line item
      const lineItems = (object as any[]).map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice,
      }));

      return {
        lineItems,
      };
    } catch (error: any) {
      console.error("Error generating quotation line items:", error);
      
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
          message: "AI service is currently unavailable due to API configuration issues. Please create line items manually.",
        });
      }
      
      if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "AI service rate limit exceeded. Please create line items manually.",
        });
      }
      
      if (error instanceof TRPCError) throw error;
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate line items with AI. Please create manually.",
      });
    }
  });
