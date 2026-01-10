import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export const scoreLeadWithAI = baseProcedure
  .input(
    z.object({
      token: z.string(),
      leadId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate the user and get their role
    const user = await authenticateUser(input.token);

    // Fetch the lead
    const lead = await db.lead.findUnique({
      where: { id: input.leadId },
    });

    if (!lead) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Lead not found",
      });
    }

    // Check if user has permission to score this lead
    // Admins can score any lead, non-admins can only score their own leads
    if (!isAdmin(user) && lead.createdById !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to score this lead",
      });
    }

    try {
      // Fetch available artisans for matching
      const artisans = await db.user.findMany({
        where: { role: "ARTISAN" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          hourlyRate: true,
          dailyRate: true,
        },
      });

      // Fetch artisan performance data including real ratings
      const artisanPerformance = await Promise.all(
        artisans.map(async (artisan) => {
          const completedOrders = await db.order.count({
            where: {
              assignedToId: artisan.id,
              status: "COMPLETED",
            },
          });

          // Calculate real average rating from customer reviews
          const reviews = await db.review.findMany({
            where: {
              artisanId: artisan.id,
            },
          });

          const avgRating =
            reviews.length > 0
              ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
              : 0;

          return {
            ...artisan,
            completedOrders,
            avgRating: Math.round(avgRating * 10) / 10,
            totalReviews: reviews.length,
          };
        })
      );

      // Set up AI model
      const model = google("gemini-1.5-pro");

      // Generate lead score and recommendations
      const { object } = await generateObject({
        model,
        schema: z.object({
          score: z.number().min(0).max(100).describe("Lead quality score from 0-100"),
          priority: z.enum(["HIGH", "MEDIUM", "LOW"]).describe("Priority level for follow-up"),
          reasoning: z.string().describe("Explanation of the score and priority"),
          recommendedActions: z.array(z.string()).describe("List of 2-4 specific action items"),
          suggestedArtisanId: z.number().optional().describe("ID of the best-matched artisan, if applicable"),
          artisanMatchReasoning: z.string().optional().describe("Why this artisan is a good match"),
          estimatedProjectValue: z.number().optional().describe("Estimated project value in Rands"),
          urgencyLevel: z.enum(["IMMEDIATE", "URGENT", "NORMAL", "LOW"]).describe("How quickly this should be addressed"),
        }),
        prompt: `You are a CRM analyst for a South African facility management company. Analyze this lead and provide scoring and recommendations.

Lead Information:
- Customer Name: ${lead.customerName}
- Email: ${lead.customerEmail}
- Phone: ${lead.customerPhone}
- Address: ${lead.address || "Not provided"}
- Service Type: ${lead.serviceType}
- Description: ${lead.description}
- Estimated Value: ${lead.estimatedValue ? `R${lead.estimatedValue.toLocaleString()}` : "Not provided"}
- Current Status: ${lead.status}

Available Artisans:
${artisanPerformance.map((a, idx) => `${idx + 1}. ${a.firstName} ${a.lastName} (ID: ${a.id})
   - Completed Jobs: ${a.completedOrders}
   - Hourly Rate: R${a.hourlyRate || "N/A"}
   - Daily Rate: R${a.dailyRate || "N/A"}
   - Avg Rating: ${a.avgRating}/5 (${a.totalReviews} reviews)`).join("\n")}

Scoring Criteria:
1. Project Value (25%): Higher estimated value = higher score
2. Service Complexity (20%): Complex services like construction/electrical score higher
3. Lead Quality (20%): Complete information, professional communication
4. Urgency Indicators (15%): Words like "urgent", "emergency", "ASAP"
5. Geographic Feasibility (10%): Address provided vs not provided
6. Contact Information Quality (10%): Complete contact details

Priority Levels:
- HIGH: Score 75-100, high value, urgent need, complete info
- MEDIUM: Score 50-74, moderate value, standard timeline
- LOW: Score 0-49, low value, incomplete info, or exploratory

Provide:
1. A numerical score (0-100)
2. Priority level (HIGH/MEDIUM/LOW)
3. Clear reasoning for the score
4. 2-4 specific, actionable recommendations (e.g., "Call within 24 hours", "Request site visit", "Send detailed quotation")
5. Suggest the best artisan match based on service type, their experience (completed jobs), and rates. Consider:
   - Service type expertise
   - Availability (fewer ongoing jobs might mean more available)
   - Appropriate rate for project value
6. Estimate project value if not provided
7. Urgency level

Be practical and realistic in your assessment.`,
      });

      return {
        score: object.score,
        priority: object.priority,
        reasoning: object.reasoning,
        recommendedActions: object.recommendedActions,
        suggestedArtisanId: object.suggestedArtisanId,
        artisanMatchReasoning: object.artisanMatchReasoning,
        estimatedProjectValue: object.estimatedProjectValue,
        urgencyLevel: object.urgencyLevel,
      };
    } catch (error: any) {
      console.error("Error scoring lead with AI:", error);
      
      // Check for specific error types
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
          message: "AI service is currently unavailable due to API configuration issues. Please contact your administrator to check the Google Gemini API key and billing status.",
        });
      }
      
      // Check for rate limiting
      if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "AI service rate limit exceeded. Please try again in a few moments.",
        });
      }
      
      if (error instanceof TRPCError) throw error;
      
      // Generic error with more details
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to analyze lead with AI: ${errorMessage.substring(0, 200)}. Please try again or score manually.`,
      });
    }
  });
