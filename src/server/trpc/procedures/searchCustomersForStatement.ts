import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const searchCustomersForStatement = baseProcedure
  .input(
    z.object({
      token: z.string(),
      query: z.string().min(1),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (!["SENIOR_ADMIN", "JUNIOR_ADMIN", "PROPERTY_MANAGER"].includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins and property managers can search customers",
      });
    }

    const searchTerm = input.query.trim();
    const searchPattern = `%${searchTerm}%`;

    // Search invoices for matching customer name, email, or address
    const invoiceResults = await db.invoice.findMany({
      where: {
        OR: [
          { customerName: { contains: searchTerm, mode: "insensitive" } },
          { customerEmail: { contains: searchTerm, mode: "insensitive" } },
          { address: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: {
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        address: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Search property manager customers for company/building match
    const pmCustomerWhere: any = {
      OR: [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { address: { contains: searchTerm, mode: "insensitive" } },
        { buildingName: { contains: searchTerm, mode: "insensitive" } },
      ],
    };

    // If property manager, restrict to own customers
    if (user.role === "PROPERTY_MANAGER") {
      pmCustomerWhere.propertyManagerId = user.id;
    }

    const pmCustomerResults = await db.propertyManagerCustomer.findMany({
      where: pmCustomerWhere,
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        buildingName: true,
        building: {
          select: {
            name: true,
          },
        },
        propertyManager: {
          select: {
            pmCompanyName: true,
          },
        },
      },
      take: 50,
    });

    // Search buildings by name
    const buildingWhere: any = {
      name: { contains: searchTerm, mode: "insensitive" },
    };
    if (user.role === "PROPERTY_MANAGER") {
      buildingWhere.propertyManagerId = user.id;
    }

    const buildingResults = await db.building.findMany({
      where: buildingWhere,
      select: {
        name: true,
        address: true,
        tenants: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            address: true,
            buildingName: true,
          },
        },
      },
      take: 20,
    });

    // Search property managers by company name
    const pmCompanyResults = await db.user.findMany({
      where: {
        role: "PROPERTY_MANAGER",
        pmCompanyName: { contains: searchTerm, mode: "insensitive" },
      },
      select: {
        id: true,
        pmCompanyName: true,
        propertyManagerCustomers: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            address: true,
            buildingName: true,
            building: {
              select: { name: true },
            },
          },
        },
      },
      take: 10,
    });

    // Deduplicate results by email
    const seen = new Map<string, {
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      address: string;
      buildingName?: string;
      companyName?: string;
    }>();

    // Add invoice results
    for (const inv of invoiceResults) {
      if (!seen.has(inv.customerEmail)) {
        seen.set(inv.customerEmail, {
          customerName: inv.customerName,
          customerEmail: inv.customerEmail,
          customerPhone: inv.customerPhone,
          address: inv.address,
        });
      }
    }

    // Add PM customer results
    for (const pmc of pmCustomerResults) {
      const bldgName = pmc.buildingName || pmc.building?.name || undefined;
      const compName = pmc.propertyManager?.pmCompanyName || undefined;
      if (!seen.has(pmc.email)) {
        seen.set(pmc.email, {
          customerName: `${pmc.firstName} ${pmc.lastName}`,
          customerEmail: pmc.email,
          customerPhone: pmc.phone || "",
          address: pmc.address,
          buildingName: bldgName,
          companyName: compName,
        });
      } else {
        // Enrich existing with building/company info
        const existing = seen.get(pmc.email)!;
        if (!existing.buildingName && bldgName) existing.buildingName = bldgName;
        if (!existing.companyName && compName) existing.companyName = compName;
      }
    }

    // Add building tenant results
    for (const bldg of buildingResults) {
      for (const tenant of bldg.tenants) {
        if (!seen.has(tenant.email)) {
          seen.set(tenant.email, {
            customerName: `${tenant.firstName} ${tenant.lastName}`,
            customerEmail: tenant.email,
            customerPhone: tenant.phone || "",
            address: tenant.address,
            buildingName: bldg.name,
          });
        } else {
          const existing = seen.get(tenant.email)!;
          if (!existing.buildingName) existing.buildingName = bldg.name;
        }
      }
    }

    // Add PM company customer results
    for (const pm of pmCompanyResults) {
      for (const cust of pm.propertyManagerCustomers) {
        if (!seen.has(cust.email)) {
          seen.set(cust.email, {
            customerName: `${cust.firstName} ${cust.lastName}`,
            customerEmail: cust.email,
            customerPhone: cust.phone || "",
            address: cust.address,
            buildingName: cust.buildingName || cust.building?.name || undefined,
            companyName: pm.pmCompanyName || undefined,
          });
        } else {
          const existing = seen.get(cust.email)!;
          if (!existing.companyName && pm.pmCompanyName) existing.companyName = pm.pmCompanyName;
        }
      }
    }

    return Array.from(seen.values()).slice(0, 30);
  });
