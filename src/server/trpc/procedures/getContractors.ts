import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getContractors = baseProcedure
  .input(
    z.object({
      token: z.string(),
      propertyManagerId: z.number().int().positive().optional(),
      serviceType: z.string().optional(),
      status: z.string().optional(),
      searchQuery: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const isPropertyManager = user.role === "PROPERTY_MANAGER";
    const isAdmin = user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN";

    if (!isPropertyManager && !isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Admins or Property Managers can view contractors",
      });
    }

    try {
      const where: any = {
        propertyManagerId: isPropertyManager ? user.id : input.propertyManagerId,
      };

      // Admin without a filter should see all contractors
      if (isAdmin && !input.propertyManagerId) {
        delete where.propertyManagerId;
      }

      if (input.status) {
        where.status = input.status;
      }

      if (input.serviceType) {
        where.serviceType = {
          contains: input.serviceType,
          mode: "insensitive",
        };
      }

      if (input.searchQuery) {
        where.OR = [
          { firstName: { contains: input.searchQuery, mode: "insensitive" } },
          { lastName: { contains: input.searchQuery, mode: "insensitive" } },
          { email: { contains: input.searchQuery, mode: "insensitive" } },
          { companyName: { contains: input.searchQuery, mode: "insensitive" } },
        ];
      }

      const contractors = await db.contractor.findMany({
        where,
        include: {
          documents: true,
          kpis: {
            where: { status: "ACTIVE" },
          },
          performanceMetrics: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          propertyManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              pmCompanyName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Get User IDs for contractors with portal access
      const contractorEmails = contractors
        .filter(c => c.portalAccessEnabled)
        .map(c => c.email);
      
      console.log(`\n📋 Fetching User IDs for ${contractorEmails.length} contractors with portal access`);
      console.log(`Contractor emails:`, contractorEmails);
      
      const users = await db.user.findMany({
        where: {
          email: { in: contractorEmails },
          role: { in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER"] },
        },
        select: { id: true, email: true },
      });

      console.log(`Found ${users.length} matching User accounts with CONTRACTOR role`);
      users.forEach(u => console.log(`  - ${u.email} → User ID: ${u.id}`));

      const emailToUserId = new Map(users.map(u => [u.email, u.id]));

      // Log contractors without matching User accounts
      const contractorsWithoutUsers = contractors
        .filter(c => c.portalAccessEnabled && !emailToUserId.has(c.email))
        .map(c => c.email);
      
      if (contractorsWithoutUsers.length > 0) {
        console.warn(`\n⚠️ ${contractorsWithoutUsers.length} contractor(s) have portal access but NO User account:`);
        contractorsWithoutUsers.forEach(email => console.warn(`  - ${email}`));
      }

      return {
        success: true,
        contractors: contractors.map((c) => ({
          id: c.id,
          userId: emailToUserId.get(c.email) || null,
          hasPortalUser: emailToUserId.has(c.email),
          propertyManager: c.propertyManager,
          propertyManagerId: c.propertyManagerId,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          companyName: c.companyName,
          registrationNumber: c.registrationNumber,
          phone: c.phone,
          serviceType: c.serviceType,
          serviceCategory: c.serviceCategory,
          specializations: c.specializations,
          status: c.status,
          hourlyRate: c.hourlyRate,
          dailyRate: c.dailyRate,
          projectRate: c.projectRate,
          bankName: (c as any).bankName ?? null,
          bankAccountHolder: c.bankAccountHolder,
          bankAccountNumber: c.bankAccountNumber,
          bankCode: c.bankCode,
          notes: c.notes,
          totalSpent: c.totalSpent,
          averageRating: c.averageRating,
          totalJobsCompleted: c.totalJobsCompleted,
          portalAccessEnabled: c.portalAccessEnabled,
          lastJobDate: c.lastJobDate,
          documentsCount: c.documents.length,
          activeKPIs: c.kpis.length,
          latestPerformance: c.performanceMetrics[0] || null,
        })),
      };
    } catch (error) {
      console.error("Error fetching contractors:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch contractors",
      });
    }
  });
