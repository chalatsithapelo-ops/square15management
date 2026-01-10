import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";

export const getLeads = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]).nullable().optional(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate the user and get their role
    const user = await authenticateUser(input.token);

    // Build the where clause based on user role
    const whereClause: any = {};
    
    // Add status filter if provided
    if (input.status) {
      whereClause.status = input.status;
    }

    // Role-based filtering
    if (user.role === "CONTRACTOR") {
      // Contractors see only leads they created for their own business
      whereClause.createdById = user.id;
    } else if (!isAdmin(user)) {
      // Non-admin, non-contractor users only see leads they created
      whereClause.createdById = user.id;
    }
    // Admins see all leads (no additional filtering)

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
