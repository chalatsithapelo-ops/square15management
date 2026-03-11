import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { getAllTemplates, getTemplatesByCategory, getTemplateById, getTemplateCategories } from '~/server/services/campaignTemplates';

export const getCampaignTemplates = baseProcedure
  .input(
    z.object({
      token: z.string(),
      category: z.string().optional(),
      templateId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    // Return a specific template
    if (input.templateId) {
      const template = getTemplateById(input.templateId);
      return {
        templates: template ? [template] : [],
        categories: getTemplateCategories(),
      };
    }

    // Return templates by category or all
    const templates = input.category && input.category !== 'all'
      ? getTemplatesByCategory(input.category as any)
      : getAllTemplates();

    return {
      templates,
      categories: getTemplateCategories(),
    };
  });
