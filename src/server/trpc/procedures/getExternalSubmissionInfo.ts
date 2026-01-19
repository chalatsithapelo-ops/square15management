import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { getValidExternalTokenRecord } from "~/server/utils/external-submissions";

export const getExternalSubmissionInfo = baseProcedure
  .input(
    z.object({
      token: z.string().min(10),
    })
  )
  .query(async ({ input }) => {
    const record = await getValidExternalTokenRecord(input.token);

    return {
      type: record.type,
      email: record.email,
      name: record.name,
      usedAt: record.usedAt,
      expiresAt: record.expiresAt,
      rfq: record.rfq
        ? {
            id: record.rfq.id,
            rfqNumber: record.rfq.rfqNumber,
            title: record.rfq.title,
            description: record.rfq.description,
            scopeOfWork: record.rfq.scopeOfWork,
            buildingAddress: record.rfq.buildingAddress,
            buildingName: record.rfq.buildingName,
            urgency: record.rfq.urgency,
            estimatedBudget: record.rfq.estimatedBudget,
            propertyManager: record.rfq.propertyManager,
          }
        : null,
      order: record.order
        ? {
            id: record.order.id,
            orderNumber: record.order.orderNumber,
            title: record.order.title,
            description: record.order.description,
            scopeOfWork: record.order.scopeOfWork,
            buildingAddress: record.order.buildingAddress,
            buildingName: record.order.buildingName,
            totalAmount: record.order.totalAmount,
            status: record.order.status,
            propertyManager: record.order.propertyManager,
          }
        : null,
    };
  });
