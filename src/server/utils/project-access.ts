import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import type { AuthenticatedUser } from "~/server/utils/auth";

const contractorRoles = new Set([
  "CONTRACTOR",
  "CONTRACTOR_SENIOR_MANAGER",
  "CONTRACTOR_JUNIOR_MANAGER",
]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function assertCanAccessProject(
  user: AuthenticatedUser,
  projectId: number
): Promise<{ id: number; customerEmail: string; assignedToId: number | null }> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      customerEmail: true,
      assignedToId: true,
    },
  });

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  if (user.role === "CUSTOMER") {
    if (normalizeEmail(project.customerEmail) !== normalizeEmail(user.email)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this project",
      });
    }
    return project;
  }

  if (user.role === "PROPERTY_MANAGER") {
    const managesCustomer = await db.propertyManagerCustomer.findFirst({
      where: {
        propertyManagerId: user.id,
        email: {
          equals: project.customerEmail,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (!managesCustomer) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this project",
      });
    }
    return project;
  }

  if (contractorRoles.has(user.role)) {
    const contractorCompanyName = (user as any).contractorCompanyName?.trim();

    if (contractorCompanyName) {
      const companyContractors = await db.user.findMany({
        where: {
          contractorCompanyName,
          role: {
            in: [
              "CONTRACTOR",
              "CONTRACTOR_SENIOR_MANAGER",
              "CONTRACTOR_JUNIOR_MANAGER",
            ],
          },
        },
        select: { id: true },
      });
      const allowedIds = new Set(companyContractors.map((c) => c.id));

      if (!project.assignedToId || !allowedIds.has(project.assignedToId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this project",
        });
      }

      return project;
    }

    if (project.assignedToId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this project",
      });
    }

    return project;
  }

  // Admin and other privileged roles: allow.
  return project;
}
