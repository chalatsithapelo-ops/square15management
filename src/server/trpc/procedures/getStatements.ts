import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { TRPCError } from "@trpc/server";
import { authenticateUser, isAdmin } from "~/server/utils/auth";

const StatementView = z.enum(["ISSUED", "RECEIVED"]);

export const getStatements = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerEmail: z.string().email().optional(),
      view: StatementView.optional(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate user using helper function
    const user = await authenticateUser(input.token);

    const where: any = {};

    // If customer, only show their statements
    if (user.role === "CUSTOMER") {
      where.client_email = user.email;
      const statements = await db.statement.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
      });

      return statements;
    }

    // Property Manager: supports two views
    if (user.role === "PROPERTY_MANAGER") {
      const view = input.view;
      if (!view) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Property manager must specify a statement view",
        });
      }

      if (view === "RECEIVED") {
        where.client_email = user.email;
      }

      if (view === "ISSUED") {
        const managedCustomers = await db.propertyManagerCustomer.findMany({
          where: { propertyManagerId: user.id },
          select: { email: true },
        });
        const managedEmails = managedCustomers.map((c) => c.email).filter(Boolean);

        if (input.customerEmail) {
          const isManaged = managedEmails.includes(input.customerEmail);
          if (!isManaged) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You can only view statements for customers you manage",
            });
          }
          where.client_email = input.customerEmail;
        } else {
          // If PM has no customers, return empty list
          if (managedEmails.length === 0) return [];
          where.client_email = { in: managedEmails };
        }
      }

      const statements = await db.statement.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
      });

      return statements;
    }

    // Admins can see all statements, with optional filtering
    if (isAdmin(user)) {
      if (input.customerEmail) {
        where.client_email = input.customerEmail;
      }

      const statements = await db.statement.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
      });

      return statements;
    }

    // Default: non-admin users can only view statements addressed to their own email
    where.client_email = user.email;
    const statements = await db.statement.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return statements;
  });
