import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export const generateProjectSummary = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
      summaryType: z.enum(["EXECUTIVE", "DETAILED", "STATUS_UPDATE"]).default("EXECUTIVE"),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    try {
      // Fetch comprehensive project data
      const project = await db.project.findUnique({
        where: { id: input.projectId },
        include: {
          assignedTo: {
            select: { firstName: true, lastName: true },
          },
          milestones: {
            include: {
              assignedTo: {
                select: { firstName: true, lastName: true },
              },
              risks: true,
              weeklyUpdates: {
                orderBy: { weekStartDate: "desc" },
                take: 5,
              },
            },
            orderBy: { sequenceOrder: "asc" },
          },
          changeOrders: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Calculate project metrics
      const totalMilestones = project.milestones.length;
      const completedMilestones = project.milestones.filter(m => m.status === "COMPLETED").length;
      const inProgressMilestones = project.milestones.filter(m => m.status === "IN_PROGRESS").length;
      const notStartedMilestones = project.milestones.filter(m => m.status === "NOT_STARTED").length;
      const onHoldMilestones = project.milestones.filter(m => m.status === "ON_HOLD").length;
      
      const totalBudget = project.estimatedBudget || 0;
      const totalSpent = project.actualCost || 0;
      const budgetRemaining = totalBudget - totalSpent;
      const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
      
      const totalRisks = project.milestones.reduce((sum, m) => sum + m.risks.length, 0);
      const highRisks = project.milestones.reduce(
        (sum, m) =>
          sum + m.risks.filter((r) => r.probability === "HIGH" || r.impact === "HIGH").length,
        0
      );
      
      const overallProgress = project.milestones.length > 0
        ? project.milestones.reduce((sum, m) => sum + (m.progressPercentage || 0), 0) / project.milestones.length
        : 0;

      // Get recent updates
      const recentUpdates = project.milestones
        .flatMap(m => m.weeklyUpdates)
        .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())
        .slice(0, 3);

      // Set up AI model
      const model = google("gemini-1.5-pro");

      // Generate project summary
      const { object } = await generateObject({
        model,
        schema: z.object({
          executiveSummary: z.string().describe("2-3 sentence high-level overview of project status"),
          keyHighlights: z.array(z.string()).min(2).max(5).describe("2-5 key positive developments or achievements"),
          progressAnalysis: z.string().describe("Detailed analysis of current progress and milestone completion"),
          budgetAnalysis: z.string().describe("Analysis of budget utilization and financial health"),
          riskAssessment: z.string().describe("Assessment of current risks and their potential impact"),
          upcomingMilestones: z.array(
            z.object({
              name: z.string(),
              dueDate: z.string().optional(),
              priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
            })
          ).describe("List of important upcoming milestones"),
          recommendations: z.array(z.string()).min(2).max(5).describe("2-5 actionable recommendations for project leadership"),
          overallStatus: z.enum(["ON_TRACK", "AT_RISK", "DELAYED", "AHEAD_OF_SCHEDULE"]).describe("Overall project health status"),
          confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]).describe("Confidence in meeting project objectives"),
        }),
        prompt: `You are a senior project management analyst. Generate a ${input.summaryType.toLowerCase()} summary for the following project.

Project Information:
- Name: ${project.name}
- Project Number: ${project.projectNumber}
- Customer: ${project.customerName}
- Type: ${project.projectType || "Not specified"}
- Status: ${project.status}
- Assigned To: ${project.assignedTo ? `${project.assignedTo.firstName} ${project.assignedTo.lastName}` : "Unassigned"}

Timeline:
- Start Date: ${project.startDate ? new Date(project.startDate).toLocaleDateString() : "Not set"}
- End Date: ${project.endDate ? new Date(project.endDate).toLocaleDateString() : "Not set"}

Financial Summary:
- Estimated Budget: R${totalBudget.toLocaleString()}
- Actual Cost: R${totalSpent.toLocaleString()}
- Remaining Budget: R${budgetRemaining.toLocaleString()}
- Budget Utilization: ${budgetUtilization.toFixed(1)}%

Progress Metrics:
- Overall Progress: ${overallProgress.toFixed(1)}%
- Total Milestones: ${totalMilestones}
- Completed: ${completedMilestones}
- In Progress: ${inProgressMilestones}
- Not Started: ${notStartedMilestones}
- On Hold: ${onHoldMilestones}

Risk Overview:
- Total Risks: ${totalRisks}
- High Severity Risks: ${highRisks}

Milestones:
${project.milestones.map((m, idx) => `${idx + 1}. ${m.name}
   Status: ${m.status}
   Progress: ${m.progressPercentage || 0}%
   Budget: R${m.budgetAllocated?.toLocaleString() || 0} (Spent: R${m.actualCost?.toLocaleString() || 0})
   ${m.startDate ? `Start: ${new Date(m.startDate).toLocaleDateString()}` : ""}
   ${m.endDate ? `End: ${new Date(m.endDate).toLocaleDateString()}` : ""}
  ${m.risks.length > 0 ? `Risks: ${m.risks.map(r => `${r.riskDescription} (${r.probability}/${r.impact})`).join(", ")}` : ""}
`).join("\n")}

${recentUpdates.length > 0 ? `Recent Updates:
${recentUpdates.map(u => `- Week of ${new Date(u.weekStartDate).toLocaleDateString()}: ${u.workDone || u.notes || "No details"}`).join("\n")}` : ""}

${project.changeOrders.length > 0 ? `Change Orders: ${project.changeOrders.length} change orders have been issued` : ""}

Summary Type Guidelines:
- EXECUTIVE: Focus on high-level insights, strategic decisions, and overall health. Suitable for senior management.
- DETAILED: Include more technical details, specific milestone analysis, and granular progress tracking.
- STATUS_UPDATE: Focus on recent progress, immediate next steps, and short-term outlook.

Provide:
1. Executive Summary: Concise overview that captures the essence
2. Key Highlights: Positive developments and achievements
3. Progress Analysis: Detailed look at milestone completion and timeline
4. Budget Analysis: Financial health and spending patterns
5. Risk Assessment: Current risks and their implications
6. Upcoming Milestones: What's next and priorities
7. Recommendations: Specific, actionable advice for project leadership
8. Overall Status: Honest assessment of project health
9. Confidence Level: How confident are you in meeting objectives

Be honest, data-driven, and actionable. If there are concerns, state them clearly with solutions.`,
      });

      return {
        projectId: input.projectId,
        projectName: project.name,
        projectNumber: project.projectNumber,
        generatedAt: new Date().toISOString(),
        generatedBy: `${user.firstName} ${user.lastName}`,
        summary: object,
        metrics: {
          overallProgress: Math.round(overallProgress * 10) / 10,
          budgetUtilization: Math.round(budgetUtilization * 10) / 10,
          completedMilestones,
          totalMilestones,
          totalRisks,
          highRisks,
        },
      };
    } catch (error: any) {
      console.error("Error generating project summary:", error);
      
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
          message: "AI project summary generation is currently unavailable. Please create a manual summary.",
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
        message: "Failed to generate project summary. Please create manually.",
      });
    }
  });
