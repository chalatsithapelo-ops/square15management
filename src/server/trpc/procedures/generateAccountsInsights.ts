import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

/**
 * Generate AI-powered insights for Management Accounts
 * Analyzes revenue, expenses, profitability, cash flow, and provides recommendations
 */
export const generateAccountsInsights = baseProcedure
  .input(
    z.object({
      token: z.string(),
      financialData: z.object({
        period: z.string(),
        revenue: z.object({
          total: z.number(),
          breakdown: z.record(z.number()).optional(),
        }),
        expenses: z.object({
          total: z.number(),
          artisanPayments: z.number(),
          materialCosts: z.number(),
          labourCosts: z.number(),
        }),
        profitability: z.object({
          netProfit: z.number(),
          profitMargin: z.number(),
        }),
        cashFlow: z.object({
          operatingCashFlow: z.number().optional(),
          investingCashFlow: z.number().optional(),
          financingCashFlow: z.number().optional(),
        }).optional(),
        assets: z.object({
          total: z.number(),
          breakdown: z.record(z.number()).optional(),
        }).optional(),
        liabilities: z.object({
          total: z.number(),
          breakdown: z.record(z.number()).optional(),
        }).optional(),
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

      const { period, revenue, expenses, profitability, cashFlow, assets, liabilities } =
        input.financialData;

      const grossMargin =
        revenue.total > 0
          ? (((revenue.total - expenses.total) / revenue.total) * 100).toFixed(1)
          : "0.0";
      const costOfGoodsSold = expenses.materialCosts + expenses.labourCosts;
      const operatingExpenses = expenses.artisanPayments;
      const ebitda = revenue.total - costOfGoodsSold - operatingExpenses;

      const debtToAssetRatio =
        assets && liabilities && assets.total > 0
          ? ((liabilities.total / assets.total) * 100).toFixed(1)
          : "0.0";

      const prompt = `You are a senior financial analyst and business advisor analyzing management accounts for a construction/services company. Provide strategic financial insights and recommendations.

FINANCIAL OVERVIEW (Period: ${period}):

INCOME STATEMENT:
- Total Revenue: R${revenue.total.toLocaleString()}
- Total Expenses: R${expenses.total.toLocaleString()}
  - Material Costs: R${expenses.materialCosts.toLocaleString()}
  - Labour Costs: R${expenses.labourCosts.toLocaleString()}
  - Artisan Payments: R${expenses.artisanPayments.toLocaleString()}
- Net Profit: R${profitability.netProfit.toLocaleString()}
- Profit Margin: ${profitability.profitMargin.toFixed(1)}%
- Gross Margin: ${grossMargin}%
- EBITDA: R${ebitda.toLocaleString()}

${cashFlow ? `CASH FLOW:
- Operating Cash Flow: R${(cashFlow.operatingCashFlow || 0).toLocaleString()}
- Investing Cash Flow: R${(cashFlow.investingCashFlow || 0).toLocaleString()}
- Financing Cash Flow: R${(cashFlow.financingCashFlow || 0).toLocaleString()}` : ""}

${assets && liabilities ? `BALANCE SHEET:
- Total Assets: R${assets.total.toLocaleString()}
- Total Liabilities: R${liabilities.total.toLocaleString()}
- Equity: R${(assets.total - liabilities.total).toLocaleString()}
- Debt-to-Asset Ratio: ${debtToAssetRatio}%` : ""}

COST STRUCTURE:
- Cost of Goods Sold: R${costOfGoodsSold.toLocaleString()} (${((costOfGoodsSold / revenue.total) * 100).toFixed(1)}% of revenue)
- Operating Expenses: R${operatingExpenses.toLocaleString()} (${((operatingExpenses / revenue.total) * 100).toFixed(1)}% of revenue)

INDUSTRY BENCHMARKS:
- Healthy Profit Margin: ≥15%
- Good Gross Margin: ≥30%
- Operating Expense Ratio: ≤20%
- Current Ratio: ≥1.5
- Debt-to-Asset Ratio: ≤60%

Please provide:
1. **Financial Health Assessment** (2-3 sentences): Overall evaluation of financial performance
2. **Key Financial Strengths** (2-3 bullet points): What's performing well
3. **Financial Concerns** (2-3 bullet points): Issues requiring attention
4. **Top 5 Financial Recommendations**: Specific actions to improve profitability and financial stability
5. **Cost Optimization Opportunities**: Where to reduce expenses without compromising quality
6. **Revenue Growth Strategies**: Suggestions to increase revenue
7. **Cash Flow Management**: Tips for improving liquidity
8. **Financial Health Score** (1-10): Overall rating with brief justification

Focus on practical financial management strategies, cost control, revenue optimization, and sustainable growth. Use South African Rand (R) currency.`;

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
          financialData: {
            profitMargin: profitability.profitMargin,
            grossMargin: parseFloat(grossMargin),
            revenue: revenue.total,
            expenses: expenses.total,
            netProfit: profitability.netProfit,
          },
        },
      };
    } catch (error) {
      console.error("Error generating accounts insights:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate AI insights",
      });
    }
  });
