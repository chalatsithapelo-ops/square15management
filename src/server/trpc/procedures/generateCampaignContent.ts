import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { env } from '~/server/env';

const model = google('gemini-2.0-flash');

export const generateCampaignContent = baseProcedure
  .input(
    z.object({
      token: z.string(),
      prompt: z.string().min(1, "Please describe the campaign you want to create"),
      serviceType: z.string().optional(),
      discountPercent: z.number().optional(),
      targetAudience: z.string().optional(),
      tone: z.enum(['professional', 'friendly', 'urgent', 'festive', 'casual']).optional().default('professional'),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "AI service not configured. Please contact your administrator.",
      });
    }

    try {
      const systemPrompt = `You are a professional marketing content creator for Square 15 Property Maintenance (www.square15.co.za), a South African property maintenance company.

Your job is to generate complete, professional email campaign content based on the user's description.

IMPORTANT RULES:
1. Generate a campaign name, email subject line, and FULL HTML email body
2. The HTML must be professional, visually appealing, and responsive
3. Use inline CSS styles (no external stylesheets)
4. Include the company name "Square 15 Property Maintenance" in the design
5. Use these personalization tokens where appropriate: {{customerName}}, {{serviceType}}, {{address}}, {{estimatedValue}}
6. Include a clear call-to-action button linking to https://www.square15.co.za
7. Use modern email design with gradients, cards, icons (emoji), and clean typography
8. Max width should be 600px, centered
9. Include a professional footer with company info
10. The tone should be ${input.tone || 'professional'}
11. Design should look like a properly designed marketing email, not plain text
12. Use South African English (e.g., "colour" not "color" in content, but CSS uses "color")

${input.serviceType ? `Service focus: ${input.serviceType}` : ''}
${input.discountPercent ? `Include a ${input.discountPercent}% discount offer` : ''}
${input.targetAudience ? `Target audience: ${input.targetAudience}` : ''}

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{
  "name": "Campaign Name Here",
  "subject": "Email Subject Line Here",
  "htmlBody": "<div>...full HTML here...</div>",
  "description": "Brief description of the campaign"
}`;

      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: input.prompt,
        maxTokens: 4000,
        temperature: 0.7,
      });

      // Parse the AI response
      let parsed: { name: string; subject: string; htmlBody: string; description: string };
      try {
        // Clean up the response - remove code blocks if present
        let cleanText = result.text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.slice(7);
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.slice(3);
        }
        if (cleanText.endsWith('```')) {
          cleanText = cleanText.slice(0, -3);
        }
        cleanText = cleanText.trim();
        
        parsed = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('Failed to parse AI response:', result.text);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI generated invalid content. Please try again with a different description.",
        });
      }

      if (!parsed.name || !parsed.subject || !parsed.htmlBody) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI response missing required fields. Please try again.",
        });
      }

      return {
        success: true,
        content: {
          name: parsed.name,
          subject: parsed.subject,
          htmlBody: parsed.htmlBody,
          description: parsed.description || '',
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      
      console.error("Failed to generate campaign content:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });
