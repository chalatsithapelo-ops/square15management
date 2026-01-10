import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getProjectTypes = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Get distinct project types from projects
      const projects = await db.project.findMany({
        select: {
          projectType: true,
        },
        distinct: ["projectType"],
      });

      const projectTypes = projects
        .map((p) => p.projectType)
        .filter((type) => type && type.trim() !== "")
        .sort();

      return projectTypes;
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
