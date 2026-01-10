import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export const classifyServiceType = baseProcedure
  .input(
    z.object({
      token: z.string(),
      description: z.string().min(1, "Description is required"),
      address: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      // Verify authentication
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Set up AI model
      const model = google("gemini-2.0-flash-exp");

      // Service types available in the system
      const serviceTypes = [
        "Painting",
        "Plumbing",
        "Electrical",
        "Construction",
        "General Maintenance",
        "Affordable Housing",
        "Social Housing",
        "Shopping Center",
        "HVAC",
        "Carpentry",
        "Roofing",
        "Flooring",
        "Tiling",
        "Glazing",
        "Landscaping",
        "Pest Control",
        "Security Systems",
        "Fire Safety",
        "Waterproofing",
        "Paving",
      ];

      // Classify the service type
      const { object } = await generateObject({
        model,
        output: "enum",
        enum: serviceTypes,
        prompt: `Classify the following service request into the most appropriate category.

Description: ${input.description}
${input.address ? `Address: ${input.address}` : ""}

Available categories:
${serviceTypes.map((type, idx) => `${idx + 1}. ${type}`).join("\n")}

Guidelines:
- "Painting" includes interior/exterior painting, wall prep, coating
- "Plumbing" includes pipes, drains, water systems, fixtures
- "Electrical" includes wiring, lighting, power systems, panels
- "Construction" includes building, renovation, structural work
- "General Maintenance" includes routine upkeep, repairs, cleaning
- "Affordable Housing" and "Social Housing" are specific housing project types
- "Shopping Center" includes retail/commercial facility management
- "HVAC" includes heating, ventilation, air conditioning
- "Carpentry" includes woodwork, cabinetry, doors, windows
- "Roofing" includes roof repairs, installation, waterproofing
- "Flooring" includes floor installation, repairs, refinishing
- "Tiling" includes tile installation, grouting, repairs
- "Glazing" includes windows, glass installation, repairs
- "Landscaping" includes gardens, outdoor spaces, irrigation
- "Pest Control" includes extermination, prevention
- "Security Systems" includes alarms, cameras, access control
- "Fire Safety" includes fire alarms, extinguishers, safety systems
- "Waterproofing" includes damp proofing, sealing, protection
- "Paving" includes driveways, pathways, concrete work

Choose the MOST SPECIFIC category that matches the description. If multiple categories apply, choose the primary one.`,
      });

      return {
        suggestedServiceType: object as string,
      };
    } catch (error: any) {
      console.error("Error classifying service type:", error);
      
      const errorMessage = error.message || error.toString();
      
      // Check for API key or billing issues
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
          message: "AI service is currently unavailable due to API configuration issues. Please select service type manually.",
        });
      }
      
      if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "AI service rate limit exceeded. Please select service type manually.",
        });
      }
      
      if (error instanceof TRPCError) throw error;
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to classify service type with AI. Please select manually.",
      });
    }
  });
