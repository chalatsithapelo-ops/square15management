import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const uploadHRDocument = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
      documentType: z.enum([
        "CONTRACT",
        "ID_DOCUMENT",
        "QUALIFICATION",
        "CERTIFICATE",
        "PERFORMANCE_REVIEW",
        "WARNING",
        "OTHER",
      ]),
      title: z.string(),
      description: z.string().optional(),
      fileUrl: z.string(),
      fileName: z.string(),
      expiryDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const employee = await db.user.findUnique({
      where: { id: input.employeeId },
    });

    if (!employee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    const document = await db.hRDocument.create({
      data: {
        employeeId: input.employeeId,
        documentType: input.documentType,
        title: input.title,
        description: input.description,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        uploadedById: user.id,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        notes: input.notes,
      },
    });

    return document;
  });
