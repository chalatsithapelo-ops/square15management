import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export const suggestArtisanForJob = baseProcedure
  .input(
    z.object({
      token: z.string(),
      serviceType: z.string(),
      description: z.string(),
      address: z.string().optional(),
      estimatedValue: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    try {
      // Verify authentication
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Fetch all artisans with their performance data
      const artisans = await db.user.findMany({
        where: { role: "ARTISAN" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          hourlyRate: true,
          dailyRate: true,
        },
      });

      if (artisans.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No artisans available",
        });
      }

      // Fetch performance data for each artisan
      const artisanPerformance = await Promise.all(
        artisans.map(async (artisan) => {
          const completedOrders = await db.order.count({
            where: {
              assignedToId: artisan.id,
              status: "COMPLETED",
            },
          });

          const activeOrders = await db.order.count({
            where: {
              assignedToId: artisan.id,
              status: {
                in: ["ASSIGNED", "IN_PROGRESS"],
              },
            },
          });

          // Get all completed orders for comprehensive service type matching
          // This provides a more accurate picture of the artisan's experience
          const allCompletedOrders = await db.order.findMany({
            where: {
              assignedToId: artisan.id,
              status: "COMPLETED",
            },
            select: {
              serviceType: true,
              totalCost: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          });

          // Count service type matches across all completed work
          const serviceTypeMatches = allCompletedOrders.filter(
            (order) => order.serviceType.toLowerCase() === input.serviceType.toLowerCase()
          ).length;

          // Calculate average job value from recent work (last 20 jobs)
          const recentOrders = allCompletedOrders.slice(0, 20);
          const avgJobValue =
            recentOrders.length > 0
              ? recentOrders.reduce((sum, order) => sum + order.totalCost, 0) / recentOrders.length
              : 0;

          return {
            ...artisan,
            completedOrders,
            activeOrders,
            serviceTypeMatches,
            avgJobValue,
          };
        })
      );

      // Set up AI model
      const model = google("gemini-1.5-pro");

      // Get AI recommendation
      const { object } = await generateObject({
        model,
        schema: z.object({
          rankedArtisans: z.array(
            z.object({
              artisanId: z.number().describe("ID of the artisan"),
              matchScore: z.number().min(0).max(100).describe("Match score from 0-100"),
              reasoning: z.string().describe("Why this artisan is a good match"),
              strengths: z.array(z.string()).describe("Key strengths for this job"),
              concerns: z.array(z.string()).optional().describe("Potential concerns or considerations"),
            })
          ).describe("Artisans ranked by suitability, best first"),
          overallRecommendation: z.string().describe("Summary recommendation for the admin"),
        }),
        prompt: `You are a job assignment specialist for a South African facility management company. Analyze these artisans and recommend the best match for this job.

Job Details:
- Service Type: ${input.serviceType}
- Description: ${input.description}
- Address: ${input.address || "Not provided"}
- Estimated Value: ${input.estimatedValue ? `R${input.estimatedValue.toLocaleString()}` : "Not specified"}

Available Artisans:
${artisanPerformance.map((a, idx) => `
${idx + 1}. ${a.firstName} ${a.lastName} (ID: ${a.id})
   - Total Completed Jobs: ${a.completedOrders}
   - Active Jobs: ${a.activeOrders}
   - ${input.serviceType} Jobs: ${a.serviceTypeMatches}
   - Average Job Value: R${a.avgJobValue.toFixed(0)}
   - Hourly Rate: ${a.hourlyRate ? `R${a.hourlyRate}` : "Not set"}
   - Daily Rate: ${a.dailyRate ? `R${a.dailyRate}` : "Not set"}
   - Contact: ${a.phone || "No phone"} / ${a.email}
`).join("\n")}

Ranking Criteria:
1. Service Type Experience (35%): Prior experience with ${input.serviceType}
2. Availability (25%): Fewer active jobs = more available
3. Track Record (20%): Total completed jobs, reliability
4. Rate Appropriateness (15%): Rate matches job value/complexity
5. Capacity (5%): Can handle the workload

For each artisan, provide:
- Match score (0-100)
- Clear reasoning
- 2-4 key strengths for this specific job
- Any concerns (workload, experience gaps, rate mismatch)

Rank ALL artisans from best to worst match. Be honest about limitations but constructive in recommendations.`,
      });

      return {
        rankedArtisans: object.rankedArtisans.map((ranked) => {
          const artisan = artisanPerformance.find((a) => a.id === ranked.artisanId);
          return {
            ...ranked,
            artisan: artisan
              ? {
                  id: artisan.id,
                  firstName: artisan.firstName,
                  lastName: artisan.lastName,
                  email: artisan.email,
                  phone: artisan.phone,
                  hourlyRate: artisan.hourlyRate,
                  dailyRate: artisan.dailyRate,
                  completedOrders: artisan.completedOrders,
                  activeOrders: artisan.activeOrders,
                }
              : null,
          };
        }),
        overallRecommendation: object.overallRecommendation,
      };
    } catch (error: any) {
      console.error("Error suggesting artisan for job:", error);
      
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
          message: "AI service is currently unavailable due to API configuration issues. Please assign artisan manually.",
        });
      }
      
      if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "AI service rate limit exceeded. Please assign artisan manually.",
        });
      }
      
      if (error instanceof TRPCError) throw error;
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to suggest artisan with AI. Please assign manually.",
      });
    }
  });
