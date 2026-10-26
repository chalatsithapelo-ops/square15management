import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

// Shape returned to the statement UI. The UI shows mixed rows:
// "company" — aggregate across all buildings of a Client
// "building" — single building under a Client
// "customer" — invoice-snapshot fallback (legacy invoices not yet linked to a Client)
// "pm" — property-manager portal customers (existing behaviour, preserved)
export type CustomerSearchHit = {
  kind: "company" | "building" | "customer" | "pm";
  clientId?: number;
  clientBuildingId?: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  companyName?: string;
  buildingName?: string;
  managerName?: string;
  buildingCount?: number;
};

export const searchCustomersForStatement = baseProcedure
  .input(
    z.object({
      token: z.string(),
      query: z.string().min(1),
    })
  )
  .query(async ({ input }): Promise<CustomerSearchHit[]> => {
    const user = await authenticateUser(input.token);

    if (
      ![
        "ADMIN",
        "SENIOR_ADMIN",
        "JUNIOR_ADMIN",
        "MANAGER",
        "TECHNICAL_MANAGER",
        "PROPERTY_MANAGER",
      ].includes(user.role)
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins and property managers can search customers",
      });
    }

    const searchTerm = input.query.trim();
    const hits: CustomerSearchHit[] = [];
    const seenCompanyIds = new Set<number>();
    const seenBuildingIds = new Set<number>();
    const seenEmails = new Set<string>();

    // 1) Client/company search — also matches against the client's buildings
    //    (so a search for a building name still surfaces the parent company).
    if (user.role !== "PROPERTY_MANAGER") {
      const companyHits = await db.client.findMany({
        where: {
          OR: [
            { companyName: { contains: searchTerm, mode: "insensitive" } },
            { name: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
            { vatNumber: { contains: searchTerm, mode: "insensitive" } },
            {
              buildings: {
                some: {
                  OR: [
                    { name: { contains: searchTerm, mode: "insensitive" } },
                    { address: { contains: searchTerm, mode: "insensitive" } },
                    { managerName: { contains: searchTerm, mode: "insensitive" } },
                    { managerEmail: { contains: searchTerm, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
        include: {
          buildings: {
            select: {
              id: true,
              name: true,
              address: true,
              isPrimary: true,
              managerName: true,
              managerEmail: true,
              managerPhone: true,
            },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          },
        },
        take: 15,
      });

      for (const c of companyHits) {
        if (!seenCompanyIds.has(c.id)) {
          seenCompanyIds.add(c.id);
          hits.push({
            kind: "company",
            clientId: c.id,
            customerName: c.companyName || c.name,
            customerEmail: c.email,
            customerPhone: c.phone,
            address: c.address || "",
            companyName: c.companyName || undefined,
            buildingCount: c.buildings.length,
          });
        }
        for (const b of c.buildings) {
          if (seenBuildingIds.has(b.id)) continue;
          seenBuildingIds.add(b.id);
          hits.push({
            kind: "building",
            clientId: c.id,
            clientBuildingId: b.id,
            customerName: b.name,
            customerEmail: b.managerEmail || c.email,
            customerPhone: b.managerPhone || c.phone,
            address: b.address,
            companyName: c.companyName || c.name,
            buildingName: b.name,
            managerName: b.managerName || undefined,
          });
        }
      }
    }

    // 2) Invoice-snapshot fallback (catches invoices that aren't yet linked
    //    to a Client/Building record — legacy data).
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
        clientId: true,
        clientBuildingId: true,
        client: { select: { id: true, companyName: true, name: true } },
        clientBuilding: { select: { id: true, name: true, managerName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    for (const inv of invoiceResults) {
      if (inv.clientBuildingId && seenBuildingIds.has(inv.clientBuildingId)) continue;
      if (inv.clientId && seenCompanyIds.has(inv.clientId) && !inv.clientBuildingId) continue;
      const emailKey = (inv.customerEmail || "").toLowerCase();
      if (emailKey && seenEmails.has(emailKey)) continue;
      if (emailKey) seenEmails.add(emailKey);
      hits.push({
        kind: "customer",
        clientId: inv.clientId ?? undefined,
        clientBuildingId: inv.clientBuildingId ?? undefined,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        customerPhone: inv.customerPhone || "",
        address: inv.address || "",
        companyName: inv.client?.companyName || inv.client?.name || undefined,
        buildingName: inv.clientBuilding?.name || undefined,
        managerName: inv.clientBuilding?.managerName || undefined,
      });
    }

    // 3) Property-manager portal customers (preserved).
    const pmCustomerWhere: any = {
      OR: [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { address: { contains: searchTerm, mode: "insensitive" } },
        { buildingName: { contains: searchTerm, mode: "insensitive" } },
      ],
    };
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
        building: { select: { name: true } },
        propertyManager: { select: { pmCompanyName: true } },
      },
      take: 20,
    });

    for (const pmc of pmCustomerResults) {
      const emailKey = pmc.email.toLowerCase();
      if (seenEmails.has(emailKey)) continue;
      seenEmails.add(emailKey);
      hits.push({
        kind: "pm",
        customerName: `${pmc.firstName} ${pmc.lastName}`.trim(),
        customerEmail: pmc.email,
        customerPhone: pmc.phone || "",
        address: pmc.address || "",
        buildingName: pmc.buildingName || pmc.building?.name || undefined,
        companyName: pmc.propertyManager?.pmCompanyName || undefined,
      });
    }

    // Order: company → building → customer → pm; alphabetical within each.
    const kindOrder: Record<string, number> = { company: 0, building: 1, customer: 2, pm: 3 };
    hits.sort(
      (a, b) =>
        (kindOrder[a.kind] ?? 99) - (kindOrder[b.kind] ?? 99) ||
        a.customerName.localeCompare(b.customerName),
    );

    return hits.slice(0, 40);
  });
