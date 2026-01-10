import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export const suggestExpenseCategory = baseProcedure
  .input(
    z.object({
      token: z.string(),
      imageDataBuffer: z.instanceof(Buffer).optional(),
      imageUrl: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      if (!input.imageDataBuffer && !input.imageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either imageDataBuffer or imageUrl must be provided",
        });
      }

      // If URL is provided, fetch the image
      let imageData = input.imageDataBuffer;
      if (!imageData && input.imageUrl) {
        const response = await fetch(input.imageUrl);
        if (!response.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to fetch image from URL",
          });
        }
        const arrayBuffer = await response.arrayBuffer();
        imageData = Buffer.from(arrayBuffer);
      }

      if (!imageData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to get image data",
        });
      }

      const model = google("gemini-2.0-flash-exp");

      const { object } = await generateObject({
        model,
        output: "enum",
        enum: ["MATERIALS", "TOOLS", "TRANSPORTATION", "OTHER"],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this receipt/expense slip and categorize it into one of these categories:
- MATERIALS: Building materials, supplies, consumables (cement, paint, pipes, etc.)
- TOOLS: Equipment, tools, machinery purchases or rentals
- TRANSPORTATION: Fuel, vehicle maintenance, transport costs, travel expenses
- OTHER: Any other expenses that don't fit the above categories

Look at the vendor name, items purchased, and any visible text to determine the most appropriate category.`,
              },
              {
                type: "image",
                image: imageData,
              },
            ],
          },
        ],
      });

      return {
        suggestedCategory: object as "MATERIALS" | "TOOLS" | "TRANSPORTATION" | "OTHER",
      };
    } catch (error: any) {
      console.error("Error suggesting expense category:", error);
      
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
          message: "AI service is currently unavailable due to API configuration issues. Please categorize manually.",
        });
      }
      
      if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "AI service rate limit exceeded. Please categorize manually.",
        });
      }
      
      if (error instanceof TRPCError) throw error;
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to analyze receipt with AI. Please categorize manually.",
      });
    }
  });
