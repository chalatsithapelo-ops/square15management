import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";
import { clearPdfSettingsCache, DEFAULT_THEMES } from "~/server/utils/pdf-templates";

export const updatePdfSettings = baseProcedure
  .input(
    z.object({
      token: z.string(),
      templateLayout: z.enum(["classic", "modern"]).optional(),
      colorTheme: z.string().optional(),
      paymentTerms: z.string().optional(),
      companyTagline: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Only admins and senior admins can change PDF settings
    const allowedRoles = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN"];
    if (!allowedRoles.includes(user.role)) {
      throw new Error("Only admin users can update PDF settings");
    }

    const fieldMap: Record<string, string> = {
      templateLayout: "pdf_template_layout",
      colorTheme: "pdf_color_theme",
      paymentTerms: "pdf_payment_terms",
      companyTagline: "pdf_company_tagline",
    };

    const updates = Object.entries(input)
      .filter(([key]) => key !== "token" && input[key as keyof typeof input] !== undefined)
      .map(([key, value]) => {
        const dbKey = fieldMap[key];
        if (!dbKey) return null;
        return db.systemSettings.upsert({
          where: { key: dbKey },
          create: { key: dbKey, value: value as string },
          update: { value: value as string },
        });
      })
      .filter(Boolean);

    await Promise.all(updates);
    clearPdfSettingsCache();

    return { success: true };
  });

export const getPdfSettings = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    await authenticateUser(input.token);

    const rows = await db.systemSettings.findMany({
      where: {
        key: {
          in: [
            "pdf_template_layout",
            "pdf_color_theme",
            "pdf_payment_terms",
            "pdf_company_tagline",
          ],
        },
      },
    });

    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;

    return {
      templateLayout: map.pdf_template_layout || "classic",
      colorTheme: map.pdf_color_theme || "olive",
      paymentTerms: map.pdf_payment_terms || "",
      companyTagline: map.pdf_company_tagline || "Unsurpassed Services",
      availableThemes: Object.keys(DEFAULT_THEMES),
      availableLayouts: ["classic", "modern"],
    };
  });
