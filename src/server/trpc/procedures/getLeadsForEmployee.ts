import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const getLeadsForEmployee = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
      status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]).optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    // Build where clause
    const whereClause: any = {
      createdById: input.employeeId,
    };

    if (input.status) {
      whereClause.status = input.status;
    }

    const leads = await db.lead.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        followUpAssignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return leads;
  });
