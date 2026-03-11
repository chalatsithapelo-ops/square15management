import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { env } from '~/server/env';

const model = google('gemini-2.0-flash');

export const amendCampaignWithAI = baseProcedure
  .input(
    z.object({
      token: z.string(),
      campaignId: z.number().optional(),
      currentHtmlBody: z.string().optional(),
      currentSubject: z.string().optional(),
      currentName: z.string().optional(),
      instruction: z.string().min(1, "Please provide an amendment instruction"),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "AI service not configured.",
      });
    }

    // If campaignId provided, fetch current campaign data
    let currentContent = {
      name: input.currentName || '',
      subject: input.currentSubject || '',
      htmlBody: input.currentHtmlBody || '',
    };

    if (input.campaignId) {
      const campaign = await db.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      currentContent = {
        name: campaign.name,
        subject: campaign.subject,
        htmlBody: campaign.htmlBody,
      };
    }

    try {
      const systemPrompt = `You are a marketing content editor for Square 15 Property Maintenance.

You are given an existing email campaign and an instruction to modify it. Apply the requested changes while maintaining the overall design quality and structure.

IMPORTANT RULES:
1. Modify the campaign according to the user's instruction
2. Keep the HTML responsive and professional
3. Maintain inline CSS styles
4. Keep personalization tokens ({{customerName}}, {{serviceType}}, etc.) intact unless told to remove them
5. Keep the call-to-action button
6. Preserve the professional look and feel
7. If the instruction is about content changes, only change content not design
8. If the instruction is about design changes, only change design not content
9. Keep the max-width at 600px

Current campaign:
Name: ${currentContent.name}
Subject: ${currentContent.subject}
HTML Body: ${currentContent.htmlBody}

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{
  "name": "Updated Campaign Name",
  "subject": "Updated Subject Line",
  "htmlBody": "<div>...updated full HTML here...</div>",
  "changesSummary": "Brief description of what was changed"
}`;

      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: input.instruction,
        maxTokens: 4000,
        temperature: 0.5,
      });

      let parsed: { name: string; subject: string; htmlBody: string; changesSummary: string };
      try {
        let cleanText = result.text.trim();
        if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
        else if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
        if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
        cleanText = cleanText.trim();
        parsed = JSON.parse(cleanText);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI generated invalid response. Please try again.",
        });
      }

      // If campaignId provided, update the campaign in the database
      if (input.campaignId) {
        await db.campaign.update({
          where: { id: input.campaignId },
          data: {
            name: parsed.name,
            subject: parsed.subject,
            htmlBody: parsed.htmlBody,
          },
        });
      }

      return {
        success: true,
        content: {
          name: parsed.name,
          subject: parsed.subject,
          htmlBody: parsed.htmlBody,
          changesSummary: parsed.changesSummary || 'Campaign updated',
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("Failed to amend campaign:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to amend campaign: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });
