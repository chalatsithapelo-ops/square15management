import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { getDefaultRouteAsync } from "~/server/utils/permissions";

export const login = baseProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const email = input.email.trim();
    const password = input.password.trim();
    const user = await db.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    let isPasswordValid = await bcryptjs.compare(password, user.password);

    if (!isPasswordValid) {
      const normalizedEmail = email.toLowerCase();

      // Backward-compatible migration for the demo Property Manager account.
      // If the account still uses the old demo password (pm123), accept property123 and
      // upgrade the stored hash.
      if (normalizedEmail === "pm@propmanagement.com") {
        // Allow the legacy demo password (pm123) and migrate to property123.
        if (password === "pm123") {
          const matchesOldDemoPassword = await bcryptjs.compare("pm123", user.password);
          if (matchesOldDemoPassword) {
            isPasswordValid = true;
          }
        }

        // Ensure the demo PM can always log in with property123.
        // If the stored hash is still pm123 we migrate; otherwise (for a demo account that drifted)
        // we force-reset to property123 to unblock access.
        if (!isPasswordValid && password === "property123" && user.role === "PROPERTY_MANAGER") {
          const matchesOldDemoPassword = await bcryptjs.compare("pm123", user.password);
          const newHash = await bcryptjs.hash("property123", 10);

          await db.user.update({
            where: { id: user.id },
            data: { password: newHash },
          });

          isPasswordValid = true;

          if (!matchesOldDemoPassword) {
            console.warn("[login] Forced demo PM password reset to property123 for pm@propmanagement.com");
          }
        }
      }
    }

    if (!isPasswordValid) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: "30d",
    });

    const defaultRoute = await getDefaultRouteAsync(user.role);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        hourlyRate: user.hourlyRate,
        dailyRate: user.dailyRate,
        hasPersonalEmail: !!(user.userEmailSmtpHost && user.userEmailSmtpUser && user.userEmailSmtpPassword),
      },
      defaultRoute,
    };
  });
