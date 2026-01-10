import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const deletePropertyManager = baseProcedure
  .input(
    z.object({
      token: z.string(),
      propertyManagerId: z.number().int().positive(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const isAdmin = user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN";
    if (!isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Admins can delete Property Managers",
      });
    }

    const pm = await db.user.findUnique({
      where: { id: input.propertyManagerId },
      select: { id: true, role: true },
    });

    if (!pm) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Property Manager not found" });
    }

    if (pm.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Selected user is not a Property Manager",
      });
    }

    try {
      await db.user.delete({ where: { id: input.propertyManagerId } });
      return {
        success: true,
        message: "Property Manager deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting Property Manager:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete Property Manager",
      });
    }
  });
