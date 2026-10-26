import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

const ELIGIBLE_ROLES = [
  "ADMIN",
  "SENIOR_ADMIN",
  "JUNIOR_ADMIN",
  "MANAGER",
  "TECHNICAL_MANAGER",
  "HR",
  "RECRUITER",
];

export const getPotentialAssessors = baseProcedure
  .input(z.object({ token: z.string(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user) && !["HR", "RECRUITER", "MANAGER", "TECHNICAL_MANAGER"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const where: any = { role: { in: ELIGIBLE_ROLES } };
    if (input.search) {
      where.OR = [
        { firstName: { contains: input.search, mode: "insensitive" } },
        { lastName: { contains: input.search, mode: "insensitive" } },
        { email: { contains: input.search, mode: "insensitive" } },
      ];
    }
    return db.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
      take: 100,
    });
  });
