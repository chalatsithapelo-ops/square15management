import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";
import { clearPdfSettingsCache, DEFAULT_THEMES } from "~/server/utils/pdf-templates";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

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
            "admin_brand_primary",
            "admin_brand_secondary",
            "admin_brand_accent",
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
      availableThemes: [...Object.keys(DEFAULT_THEMES), "custom"],
      availableLayouts: ["classic", "modern"],
      brandPrimaryColor: map.admin_brand_primary || "#2D5016",
      brandSecondaryColor: map.admin_brand_secondary || "#F4C430",
      brandAccentColor: map.admin_brand_accent || "#5A9A47",
    };
  });

export const updateAdminBranding = baseProcedure
  .input(
    z.object({
      token: z.string(),
      primaryColor: z.string().regex(HEX_COLOR_REGEX, "Invalid hex color"),
      secondaryColor: z.string().regex(HEX_COLOR_REGEX, "Invalid hex color"),
      accentColor: z.string().regex(HEX_COLOR_REGEX, "Invalid hex color"),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const allowedRoles = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN"];
    if (!allowedRoles.includes(user.role)) {
      throw new Error("Only admin users can update branding");
    }

    await Promise.all([
      db.systemSettings.upsert({
        where: { key: "admin_brand_primary" },
        create: { key: "admin_brand_primary", value: input.primaryColor },
        update: { value: input.primaryColor },
      }),
      db.systemSettings.upsert({
        where: { key: "admin_brand_secondary" },
        create: { key: "admin_brand_secondary", value: input.secondaryColor },
        update: { value: input.secondaryColor },
      }),
      db.systemSettings.upsert({
        where: { key: "admin_brand_accent" },
        create: { key: "admin_brand_accent", value: input.accentColor },
        update: { value: input.accentColor },
      }),
      // Auto-set color theme to "custom"
      db.systemSettings.upsert({
        where: { key: "pdf_color_theme" },
        create: { key: "pdf_color_theme", value: "custom" },
        update: { value: "custom" },
      }),
    ]);

    clearPdfSettingsCache();

    return { success: true };
  });

export const getAdminBranding = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    await authenticateUser(input.token);

    const rows = await db.systemSettings.findMany({
      where: {
        key: { in: ["admin_brand_primary", "admin_brand_secondary", "admin_brand_accent"] },
      },
    });

    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;

    return {
      primaryColor: map.admin_brand_primary || "#2D5016",
      secondaryColor: map.admin_brand_secondary || "#F4C430",
      accentColor: map.admin_brand_accent || "#5A9A47",
    };
  });
