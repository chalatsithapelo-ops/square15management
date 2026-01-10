import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const getHRDocuments = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number().optional(),
      documentType: z.enum([
        "CONTRACT",
        "ID_DOCUMENT",
        "QUALIFICATION",
        "CERTIFICATE",
        "PERFORMANCE_REVIEW",
        "WARNING",
        "OTHER",
      ]).optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const documents = await db.hRDocument.findMany({
      where: {
        employeeId: input.employeeId,
        documentType: input.documentType,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return documents;
  });
