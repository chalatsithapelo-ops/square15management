import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";

const contractorRoles = ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"] as const;

export const getCreditNotes = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const where: any = {};
    if (input.invoiceId) where.invoiceId = input.invoiceId;

    if (isAdmin(user as any)) {
      // no extra filter
    } else if (contractorRoles.includes(user.role as any)) {
      if (user.role === "CONTRACTOR") {
        where.invoice = { createdById: user.id };
      } else {
        const company = user.contractorCompanyName?.trim();
        if (company) {
          const companyUsers = await db.user.findMany({
            where: {
              contractorCompanyName: company,
              role: { in: [...contractorRoles] },
            },
            select: { id: true },
          });
          const ids = companyUsers.map((u) => u.id);
          where.invoice = { createdById: { in: ids.length > 0 ? ids : [user.id] } };
        } else {
          where.invoice = { createdById: user.id };
        }
      }
    } else {
      where.customerEmail = user.email;
    }

    return db.creditNote.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            customerName: true,
            order: { select: { id: true, orderNumber: true } },
            project: { select: { id: true, name: true, projectNumber: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });
