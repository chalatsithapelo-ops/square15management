import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

/**
 * Generate AI-powered insights for project management
 * Analyzes project status, timelines, budgets, and provides recommendations
 */
export const generateProjectInsights = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectsData: z.object({
        projects: z.array(
          z.object({
            name: z.string(),
            status: z.string(),
            projectType: z.string().optional(),
            estimatedBudget: z.number().optional(),
            actualCost: z.number().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            customerName: z.string().optional(),
            milestones: z.array(z.any()).optional(),
          })
        ),
        summary: z.object({
          total: z.number(),
          planning: z.number(),
          inProgress: z.number(),
          onHold: z.number(),
          completed: z.number(),
          cancelled: z.number(),
          totalEstimatedBudget: z.number(),
          totalActualCost: z.number(),
        }),
      }),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "AI service not configured",
      });
    }

    try {
      const anthropic = createAnthropic({
        apiKey: apiKey,
      });

      const { projects, summary } = input.projectsData;

      // Calculate key metrics
      const completionRate =
        summary.total > 0
          ? ((summary.completed / summary.total) * 100).toFixed(1)
          : "0.0";
      const overBudgetProjects = projects.filter(
        (p) =>
          p.actualCost &&
          p.estimatedBudget &&
          p.actualCost > p.estimatedBudget
      );
      const onTimeProjects = projects.filter((p) => {
        if (!p.endDate || p.status !== "COMPLETED") return false;
        return true; // Simplified - in real scenario would check actual completion date
      });
      const avgBudgetVariance =
        projects
          .filter((p) => p.actualCost && p.estimatedBudget)
          .reduce(
            (sum, p) =>
              sum +
              ((p.actualCost! - p.estimatedBudget!) / p.estimatedBudget!) *
                100,
            0
          ) / (projects.filter((p) => p.actualCost && p.estimatedBudget).length || 1);

      const projectsList = projects
        .slice(0, 10)
        .map(
          (p) =>
            `- ${p.name}: ${p.status}${p.estimatedBudget ? `, Budget R${p.estimatedBudget.toLocaleString()}` : ""}${p.actualCost ? `, Actual Cost R${p.actualCost.toLocaleString()}` : ""}${p.startDate ? `, Start ${new Date(p.startDate).toLocaleDateString()}` : ""}`
        )
        .join("\n");

      const prompt = `You are a senior project management consultant analyzing a portfolio of construction/service projects. Provide strategic insights and recommendations.

PROJECT PORTFOLIO OVERVIEW:
- Total Projects: ${summary.total}
- Planning: ${summary.planning}
- In Progress: ${summary.inProgress}
- On Hold: ${summary.onHold}
- Completed: ${summary.completed}
- Cancelled: ${summary.cancelled}
- Completion Rate: ${completionRate}%

FINANCIAL OVERVIEW:
- Total Estimated Budget: R${summary.totalEstimatedBudget.toLocaleString()}
- Total Actual Cost: R${summary.totalActualCost.toLocaleString()}
- Cost Variance: R${(summary.totalActualCost - summary.totalEstimatedBudget).toLocaleString()}
- Average Budget Variance: ${avgBudgetVariance.toFixed(1)}%
- Over-Budget Projects: ${overBudgetProjects.length}

PROJECT DETAILS (Top 10):
${projectsList}

INDUSTRY BENCHMARKS:
- Healthy Completion Rate: ≥80%
- On-Time Delivery: ≥85%
- Budget Variance: ±10%
- Projects On Hold: ≤10%

Please provide:
1. **Portfolio Health Assessment** (2-3 sentences): Overall evaluation of project portfolio performance
2. **Key Strengths** (2-3 bullet points): What's working well
3. **Critical Issues** (2-3 bullet points): Problems requiring immediate attention
4. **Top 5 Strategic Recommendations**: Actionable steps to improve project delivery and profitability
5. **Risk Analysis**: Identify high-risk projects (on hold, over budget, or delayed)
6. **Resource Optimization**: Suggestions for better resource allocation
7. **Performance Score** (1-10): Overall portfolio rating with justification

Focus on practical project management advice, cost control, timeline management, and resource optimization. Use South African Rand (R) currency.`;

      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt,
        maxTokens: 2500,
        temperature: 0.7,
      });

      return {
        success: true,
        insights: {
          rawText: text,
          generatedAt: new Date(),
          projectData: {
            totalProjects: summary.total,
            completionRate: parseFloat(completionRate),
            budgetVariance: avgBudgetVariance,
            overBudgetCount: overBudgetProjects.length,
            onHoldCount: summary.onHold,
          },
        },
      };
    } catch (error) {
      console.error("Error generating project insights:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate AI insights",
      });
    }
  });
