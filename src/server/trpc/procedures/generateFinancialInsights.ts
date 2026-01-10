import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

/**
 * Generate AI-powered financial insights and recommendations
 * for Property Manager's portfolio performance
 */
export const generateFinancialInsights = baseProcedure
  .input(
    z.object({
      token: z.string(),
      financialData: z.object({
        portfolio: z.object({
          numberOfProperties: z.number(),
          totalUnits: z.number(),
          occupancyRate: z.number(),
          revenue: z.object({
            total: z.number(),
            rentalIncome: z.number(),
            otherIncome: z.number(),
            trend: z.number(),
          }),
          expenses: z.object({
            budgetExpenses: z.number(),
            contractorPayments: z.number(),
            orderCosts: z.number(),
            total: z.number(),
          }),
          profitability: z.object({
            netOperatingIncome: z.number(),
            profitMargin: z.number(),
          }),
          performance: z.object({
            revenuePerUnit: z.number(),
            expensePerUnit: z.number(),
            netIncomePerUnit: z.number(),
            rentCollectionRate: z.number(),
          }),
          budgets: z.object({
            total: z.number(),
            spent: z.number(),
            remaining: z.number(),
            utilization: z.number(),
          }),
        }),
        buildings: z.array(
          z.object({
            buildingName: z.string(),
            revenue: z.object({
              totalRevenue: z.number(),
              rentCollectionRate: z.number(),
            }),
            expenses: z.object({
              totalExpenses: z.number(),
            }),
            profitability: z.object({
              netOperatingIncome: z.number(),
              profitMargin: z.number(),
            }),
            occupancy: z.object({
              occupancyRate: z.number(),
              totalUnits: z.number(),
            }),
          })
        ),
        period: z.object({
          start: z.date(),
          end: z.date(),
        }),
      }),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can access AI insights",
      });
    }

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

      const { portfolio, buildings, period } = input.financialData;

      // Format data for AI analysis
      const periodStr = `${period.start.toLocaleDateString()} to ${period.end.toLocaleDateString()}`;
      
      const buildingsSummary = buildings
        .map(
          (b) =>
            `- ${b.buildingName}: Revenue R${b.revenue.totalRevenue.toLocaleString()}, ` +
            `Expenses R${b.expenses.totalExpenses.toLocaleString()}, ` +
            `NOI R${b.profitability.netOperatingIncome.toLocaleString()}, ` +
            `Profit Margin ${b.profitability.profitMargin.toFixed(1)}%, ` +
            `Occupancy ${b.occupancy.occupancyRate.toFixed(1)}%, ` +
            `Collection Rate ${b.revenue.rentCollectionRate.toFixed(1)}%`
        )
        .join("\n");

      const prompt = `You are a senior property management financial advisor analyzing a real estate portfolio's performance. Provide actionable insights and recommendations.

PORTFOLIO OVERVIEW (${periodStr}):
- Properties: ${portfolio.numberOfProperties}
- Total Units: ${portfolio.totalUnits} (${portfolio.occupancyRate.toFixed(1)}% occupied)
- Total Revenue: R${portfolio.revenue.total.toLocaleString()}
- Total Expenses: R${portfolio.expenses.total.toLocaleString()}
- Net Operating Income: R${portfolio.profitability.netOperatingIncome.toLocaleString()}
- Profit Margin: ${portfolio.profitability.profitMargin.toFixed(1)}%
- Revenue Trend: ${portfolio.revenue.trend >= 0 ? '+' : ''}${portfolio.revenue.trend.toFixed(1)}%

PER-UNIT METRICS:
- Revenue per Unit: R${portfolio.performance.revenuePerUnit.toLocaleString()}
- Expense per Unit: R${portfolio.performance.expensePerUnit.toLocaleString()}
- Net Income per Unit: R${portfolio.performance.netIncomePerUnit.toLocaleString()}
- Rent Collection Rate: ${portfolio.performance.rentCollectionRate.toFixed(1)}%

BUDGET PERFORMANCE:
- Total Budget: R${portfolio.budgets.total.toLocaleString()}
- Spent: R${portfolio.budgets.spent.toLocaleString()}
- Remaining: R${portfolio.budgets.remaining.toLocaleString()}
- Utilization: ${portfolio.budgets.utilization.toFixed(1)}%

EXPENSE BREAKDOWN:
- Budget Expenses: R${portfolio.expenses.budgetExpenses.toLocaleString()}
- Contractor Payments: R${portfolio.expenses.contractorPayments.toLocaleString()}
- Order Costs: R${portfolio.expenses.orderCosts.toLocaleString()}

INDIVIDUAL BUILDING PERFORMANCE:
${buildingsSummary}

INDUSTRY BENCHMARKS:
- Excellent Profit Margin: ≥15%
- Good Occupancy Rate: ≥90%
- Target Rent Collection: ≥95%
- Budget Utilization Target: ≤90%

Please provide:
1. **Overall Performance Assessment** (2-3 sentences): Brief evaluation of portfolio health
2. **Key Strengths** (2-3 bullet points): What's working well
3. **Areas of Concern** (2-3 bullet points): Issues requiring attention
4. **Top 3 Actionable Recommendations**: Specific, practical steps to improve performance
5. **Building-Specific Insights** (if any buildings significantly underperform or outperform)
6. **Financial Health Score** (1-10): Overall rating with brief justification

Keep recommendations practical, specific, and focused on property management best practices. Use South African Rand (R) currency formatting.`;

      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt,
        maxTokens: 2000,
        temperature: 0.7,
      });

      const aiInsights = text;

      // Parse AI response into structured format
      const sections = aiInsights.split("\n\n");
      
      return {
        success: true,
        insights: {
          rawText: aiInsights,
          generatedAt: new Date(),
          portfolioData: {
            profitMargin: portfolio.profitability.profitMargin,
            occupancyRate: portfolio.occupancyRate,
            rentCollectionRate: portfolio.performance.rentCollectionRate,
            budgetUtilization: portfolio.budgets.utilization,
            revenueTrend: portfolio.revenue.trend,
          },
        },
      };
    } catch (error) {
      console.error("Error generating AI insights:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate AI insights",
      });
    }
  });
