import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getStatements = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerEmail: z.string().email().optional(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate user using helper function
    const user = await authenticateUser(input.token);

    const where: any = {};

    // If customer, only show their statements
    if (user.role === "CUSTOMER") {
      where.client_email = user.email;
    } else if (input.customerEmail) {
      // Admin filtering by specific customer
      where.client_email = input.customerEmail;
    }

    const statements = await db.statement.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return statements;
  });
