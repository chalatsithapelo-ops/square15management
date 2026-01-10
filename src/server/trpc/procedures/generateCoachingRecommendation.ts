import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export const generateCoachingRecommendation = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Fetch employee details
      const employee = await db.user.findUnique({
        where: { id: input.employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      });

      if (!employee) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Employee not found",
        });
      }

      // Fetch employee's leads for performance analysis
      const leads = await db.lead.findMany({
        where: { createdById: input.employeeId },
      });

      // Calculate employee metrics
      const totalLeads = leads.length;
      const wonLeads = leads.filter((l) => l.status === "WON").length;
      const lostLeads = leads.filter((l) => l.status === "LOST").length;
      const contactedLeads = leads.filter((l) =>
        ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(l.status)
      );
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;
      const contactRate = totalLeads > 0 ? (contactedLeads.length / totalLeads) * 100 : 0;

      const wonLeadsWithValue = leads.filter((l) => l.status === "WON" && l.estimatedValue);
      const totalWonValue = wonLeadsWithValue.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
      const avgDealValue = wonLeadsWithValue.length > 0 ? totalWonValue / wonLeadsWithValue.length : 0;

      // Calculate response time
      let totalResponseTimeHours = 0;
      let responseTimeCount = 0;
      contactedLeads.forEach((lead) => {
        const createdTime = new Date(lead.createdAt).getTime();
        const contactedTime = new Date(lead.updatedAt).getTime();
        const diffHours = (contactedTime - createdTime) / (1000 * 60 * 60);
        if (diffHours > 0 && lead.status !== "NEW") {
          totalResponseTimeHours += diffHours;
          responseTimeCount++;
        }
      });
      const avgResponseTimeHours = responseTimeCount > 0 ? totalResponseTimeHours / responseTimeCount : 0;

      // Fetch team-wide metrics for comparison
      const allLeads = await db.lead.findMany();
      const teamTotalLeads = allLeads.length;
      const teamWonLeads = allLeads.filter((l) => l.status === "WON").length;
      const teamConversionRate = teamTotalLeads > 0 ? (teamWonLeads / teamTotalLeads) * 100 : 0;

      const teamWonLeadsWithValue = allLeads.filter((l) => l.status === "WON" && l.estimatedValue);
      const teamTotalWonValue = teamWonLeadsWithValue.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
      const teamAvgDealValue = teamWonLeadsWithValue.length > 0 ? teamTotalWonValue / teamWonLeadsWithValue.length : 0;

      // Fetch employee KPIs
      const kpis = await db.employeeKPI.findMany({
        where: {
          employeeId: input.employeeId,
          status: "ACTIVE",
        },
        orderBy: {
          periodStart: "desc",
        },
        take: 5,
      });

      // Fetch completed orders (if artisan)
      const completedOrders = await db.order.findMany({
        where: {
          assignedToId: input.employeeId,
          status: "COMPLETED",
        },
      });

      // Fetch reviews (if artisan)
      const reviews = await db.review.findMany({
        where: {
          artisanId: input.employeeId,
        },
      });

      const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 0;

      // Set up AI model
      const model = google("gemini-1.5-pro");

      // Generate coaching recommendations
      const { object } = await generateObject({
        model,
        schema: z.object({
          overallAssessment: z.string().describe("A comprehensive 2-3 sentence assessment of the employee's current performance"),
          strengths: z.array(z.string()).min(2).max(4).describe("List of 2-4 key strengths the employee demonstrates"),
          areasForImprovement: z.array(
            z.object({
              area: z.string().describe("The specific area needing improvement"),
              currentPerformance: z.string().describe("Brief description of current performance in this area"),
              targetPerformance: z.string().describe("What good performance looks like in this area"),
              priority: z.enum(["HIGH", "MEDIUM", "LOW"]).describe("Priority level for this improvement area"),
            })
          ).min(2).max(5).describe("List of 2-5 areas for improvement with details"),
          actionableRecommendations: z.array(
            z.object({
              recommendation: z.string().describe("Specific, actionable recommendation"),
              expectedImpact: z.string().describe("Expected impact if implemented"),
              timeframe: z.string().describe("Suggested timeframe for implementation (e.g., 'Immediate', '2 weeks', '1 month')"),
            })
          ).min(3).max(6).describe("List of 3-6 specific, actionable recommendations"),
          trainingNeeds: z.array(z.string()).describe("List of suggested training topics or skills to develop"),
          shortTermGoals: z.array(z.string()).min(2).max(4).describe("2-4 short-term goals (next 1-3 months)"),
          longTermGoals: z.array(z.string()).min(1).max(3).describe("1-3 long-term goals (next 6-12 months)"),
          coachingStyle: z.string().describe("Recommended coaching approach for this employee based on their performance pattern"),
        }),
        prompt: `You are an expert business coach and HR consultant for a South African facility management company. Analyze this employee's performance data and provide personalized, actionable coaching recommendations.

Employee Information:
- Name: ${employee.firstName} ${employee.lastName}
- Role: ${employee.role}
- Email: ${employee.email}

Performance Metrics:
- Total Leads Created: ${totalLeads}
- Won Leads: ${wonLeads}
- Lost Leads: ${lostLeads}
- Conversion Rate: ${conversionRate.toFixed(1)}% (Team Average: ${teamConversionRate.toFixed(1)}%)
- Contact Rate: ${contactRate.toFixed(1)}%
- Average Response Time: ${avgResponseTimeHours > 0 ? `${avgResponseTimeHours.toFixed(1)} hours` : "No data"}
- Average Deal Value: R${Math.round(avgDealValue).toLocaleString()} (Team Average: R${Math.round(teamAvgDealValue).toLocaleString()})
- Total Won Value: R${Math.round(totalWonValue).toLocaleString()}

${completedOrders.length > 0 ? `
Artisan Performance:
- Completed Orders: ${completedOrders.length}
- Average Rating: ${avgRating.toFixed(1)}/5 (${reviews.length} reviews)
` : ''}

${kpis.length > 0 ? `
Recent KPIs:
${kpis.map((kpi) => `- ${kpi.kpiName}: ${kpi.actualValue}/${kpi.targetValue} ${kpi.unit} (${kpi.achievementRate.toFixed(0)}% achieved)`).join('\n')}
` : ''}

Context:
- This is a South African facility management company
- Focus on practical, culturally appropriate recommendations
- Consider both sales performance (if applicable) and operational excellence
- Be specific and actionable, not generic

Your coaching recommendations should:
1. Be honest but constructive and encouraging
2. Compare performance to team benchmarks where relevant
3. Provide specific, actionable steps (not vague advice like "improve communication")
4. Consider the employee's role and responsibilities
5. Be realistic and achievable
6. Focus on measurable improvements
7. Include both quick wins and longer-term development areas

Prioritize recommendations based on:
- Impact on business results
- Ease of implementation
- Employee's current skill level and role`,
      });

      return {
        employeeId: input.employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        generatedAt: new Date().toISOString(),
        coaching: object,
        metrics: {
          totalLeads,
          conversionRate: Math.round(conversionRate * 10) / 10,
          avgDealValue: Math.round(avgDealValue),
          avgResponseTimeHours: Math.round(avgResponseTimeHours * 10) / 10,
          completedOrders: completedOrders.length,
          avgRating: Math.round(avgRating * 10) / 10,
        },
      };
    } catch (error: any) {
      console.error("Error generating coaching recommendation:", error);
      
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
          message: "AI coaching insights are currently unavailable due to API configuration issues. Please contact your administrator to check the Google Gemini API key and ensure there are sufficient credits. The key can be updated in the .env file (GEMINI_API_KEY).",
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
        message: `Failed to generate coaching recommendation: ${errorMessage.substring(0, 200)}. Please try again later.`,
      });
    }
  });
