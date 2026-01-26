import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export const analyzeProjectRisks = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
      includeFinancialRisks: z.boolean().default(true),
      includeTimelineRisks: z.boolean().default(true),
      includeResourceRisks: z.boolean().default(true),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    try {
      // Fetch project data
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
                take: 3,
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

      // Calculate risk indicators
      const totalBudget = project.estimatedBudget || 0;
      const totalSpent = project.actualCost || 0;
      const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
      
      const overallProgress = project.milestones.length > 0
        ? project.milestones.reduce((sum, m) => sum + (m.progressPercentage || 0), 0) / project.milestones.length
        : 0;
      
      // Calculate timeline metrics
      const now = new Date();
      const startDate = project.startDate ? new Date(project.startDate) : null;
      const endDate = project.endDate ? new Date(project.endDate) : null;
      
      let timelineProgress = 0;
      if (startDate && endDate) {
        const totalDuration = endDate.getTime() - startDate.getTime();
        const elapsed = now.getTime() - startDate.getTime();
        timelineProgress = (elapsed / totalDuration) * 100;
      }
      
      // Identify overdue milestones
      const overdueMilestones = project.milestones.filter(m => 
        m.endDate && new Date(m.endDate) < now && m.status !== "COMPLETED"
      );
      
      // Identify milestones with budget overruns
      const overBudgetMilestones = project.milestones.filter(m =>
        m.budgetAllocated && m.actualCost && m.actualCost > m.budgetAllocated
      );
      
      // Count existing risks
      const existingRisks = project.milestones.reduce((sum, m) => sum + m.risks.length, 0);
      const highSeverityRisks = project.milestones.reduce(
        (sum, m) => sum + m.risks.filter(r => r.probability === "HIGH" || r.impact === "HIGH").length,
        0
      );

      // Set up AI model
      const model = google("gemini-1.5-pro");

      // Analyze risks
      const { object } = await generateObject({
        model,
        output: "array",
        schema: z.object({
          riskTitle: z.string().describe("Short, clear title for the risk"),
          description: z.string().describe("Detailed description of the risk and its implications"),
          category: z.enum([
            "FINANCIAL",
            "TIMELINE",
            "RESOURCE",
            "QUALITY",
            "SCOPE",
            "COMMUNICATION",
            "TECHNICAL",
            "EXTERNAL"
          ]).describe("Category of risk"),
          severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).describe("Severity of the risk"),
          likelihood: z.enum(["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "VERY_LOW"]).describe("Likelihood of occurrence"),
          impact: z.string().describe("Potential impact if the risk materializes"),
          indicators: z.array(z.string()).describe("Data points or indicators that led to identifying this risk"),
          mitigationStrategies: z.array(z.string()).min(1).max(4).describe("1-4 specific mitigation strategies"),
          immediateActions: z.array(z.string()).optional().describe("Immediate actions to take if severity is HIGH or CRITICAL"),
          estimatedImpactCost: z.number().optional().describe("Estimated financial impact in Rands if risk occurs"),
        }),
        prompt: `You are a senior project risk analyst. Analyze the following project data and identify potential risks that may impact project success.

Project: ${project.name} (${project.projectNumber})
Status: ${project.status}
Customer: ${project.customerName}

Financial Metrics:
- Budget: R${totalBudget.toLocaleString()}
- Spent: R${totalSpent.toLocaleString()}
- Budget Utilization: ${budgetUtilization.toFixed(1)}%
- Remaining Budget: R${(totalBudget - totalSpent).toLocaleString()}

Timeline Metrics:
- Start Date: ${startDate ? startDate.toLocaleDateString() : "Not set"}
- End Date: ${endDate ? endDate.toLocaleDateString() : "Not set"}
- Timeline Progress: ${timelineProgress.toFixed(1)}%
- Work Progress: ${overallProgress.toFixed(1)}%
- Progress Gap: ${(timelineProgress - overallProgress).toFixed(1)}% ${timelineProgress > overallProgress ? "(BEHIND SCHEDULE)" : "(ON TRACK)"}

Milestone Status:
- Total: ${project.milestones.length}
- Completed: ${project.milestones.filter(m => m.status === "COMPLETED").length}
- In Progress: ${project.milestones.filter(m => m.status === "IN_PROGRESS").length}
- Not Started: ${project.milestones.filter(m => m.status === "NOT_STARTED").length}
- On Hold: ${project.milestones.filter(m => m.status === "ON_HOLD").length}
- Overdue: ${overdueMilestones.length}

Risk Indicators:
- Over Budget Milestones: ${overBudgetMilestones.length}
- Existing Logged Risks: ${existingRisks} (${highSeverityRisks} high severity)
- Change Orders: ${project.changeOrders.length}

Milestones:
${project.milestones.map((m, idx) => `${idx + 1}. ${m.name}
   Status: ${m.status}, Progress: ${m.progressPercentage || 0}%
   Budget: R${m.budgetAllocated?.toLocaleString() || 0} / Spent: R${m.actualCost?.toLocaleString() || 0}
   ${m.endDate ? `Due: ${new Date(m.endDate).toLocaleDateString()}${new Date(m.endDate) < now && m.status !== "COMPLETED" ? " (OVERDUE)" : ""}` : ""}
  ${m.risks.length > 0 ? `Existing Risks: ${m.risks.map(r => r.riskDescription).join("; ")}` : ""}
`).join("\n")}

${project.milestones.some(m => m.weeklyUpdates.length > 0) ? `Recent Updates:
${project.milestones.filter(m => m.weeklyUpdates.length > 0).map(m => 
  `${m.name}: ${m.weeklyUpdates[0]?.workDone || m.weeklyUpdates[0]?.notes || "No update"}`
).join("\n")}` : ""}

Analysis Focus Areas:
${input.includeFinancialRisks ? "- Financial risks (budget overruns, cash flow, cost escalation)" : ""}
${input.includeTimelineRisks ? "- Timeline risks (delays, schedule slippage, critical path issues)" : ""}
${input.includeResourceRisks ? "- Resource risks (availability, capacity, skill gaps)" : ""}

Risk Identification Guidelines:

1. CRITICAL Severity:
   - Project failure likely
   - Major financial loss (>20% of budget)
   - Significant timeline delay (>30 days)
   - Client relationship at risk

2. HIGH Severity:
   - Significant impact on deliverables
   - Moderate financial impact (10-20% of budget)
   - Timeline delay (15-30 days)
   - Requires immediate attention

3. MEDIUM Severity:
   - Noticeable impact but manageable
   - Minor financial impact (5-10% of budget)
   - Small timeline impact (<15 days)
   - Can be monitored and addressed proactively

4. LOW Severity:
   - Minimal impact
   - Negligible financial/timeline impact
   - Worth noting but not urgent

Risk Categories:
- FINANCIAL: Budget overruns, cost escalation, payment issues
- TIMELINE: Delays, schedule conflicts, milestone slippage
- RESOURCE: Staffing, equipment, material availability
- QUALITY: Workmanship, standards, defects
- SCOPE: Scope creep, unclear requirements, change orders
- COMMUNICATION: Stakeholder alignment, information gaps
- TECHNICAL: Technical challenges, design issues, complexity
- EXTERNAL: Weather, regulations, market conditions, dependencies

Provide:
1. Risk Title: Clear, concise name
2. Description: What the risk is and why it matters
3. Category: Primary category
4. Severity: How serious is it
5. Likelihood: How likely is it to occur
6. Impact: What happens if it occurs
7. Indicators: What data points reveal this risk
8. Mitigation Strategies: Specific actions to prevent or minimize
9. Immediate Actions: Urgent steps if severity is HIGH/CRITICAL
10. Estimated Impact Cost: Financial impact if applicable

Be proactive - identify risks even if they're not yet critical. Include 3-8 risks depending on project complexity and indicators.`,
      });

      return {
        projectId: input.projectId,
        projectName: project.name,
        analyzedAt: new Date().toISOString(),
        analyzedBy: `${user.firstName} ${user.lastName}`,
        risks: object as any[],
        summary: {
          totalRisksIdentified: (object as any[]).length,
          criticalRisks: (object as any[]).filter((r: any) => r.severity === "CRITICAL").length,
          highRisks: (object as any[]).filter((r: any) => r.severity === "HIGH").length,
          mediumRisks: (object as any[]).filter((r: any) => r.severity === "MEDIUM").length,
          lowRisks: (object as any[]).filter((r: any) => r.severity === "LOW").length,
        },
        projectMetrics: {
          budgetUtilization: Math.round(budgetUtilization * 10) / 10,
          overallProgress: Math.round(overallProgress * 10) / 10,
          timelineProgress: Math.round(timelineProgress * 10) / 10,
          overdueMilestones: overdueMilestones.length,
          existingRisks: existingRisks,
        },
      };
    } catch (error: any) {
      console.error("Error analyzing project risks:", error);
      
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
          message: "AI risk analysis is currently unavailable. Please perform manual risk assessment.",
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
        message: "Failed to analyze project risks. Please perform manual assessment.",
      });
    }
  });
