import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getContractorDocuments = baseProcedure
  .input(
    z.object({
      token: z.string(),
      contractorId: z.number(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can view contractor documents",
      });
    }

    try {
      // Verify contractor belongs to this property manager
      const contractor = await db.contractor.findFirst({
        where: {
          id: input.contractorId,
          propertyManagerId: user.id,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contractor not found",
        });
      }

      const documents = await db.contractorDocument.findMany({
        where: { contractorId: input.contractorId },
        orderBy: { createdAt: "desc" },
      });

      return {
        success: true,
        documents: documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          documentType: doc.documentType,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          expiryDate: doc.expiryDate,
          isExpired: doc.expiryDate ? new Date(doc.expiryDate) < new Date() : false,
          createdAt: doc.createdAt,
          notes: doc.notes,
        })),
      };
    } catch (error) {
      console.error("Error fetching contractor documents:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch documents",
      });
    }
  });
