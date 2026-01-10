import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const uploadContractorDocument = baseProcedure
  .input(
    z.object({
      token: z.string(),
      contractorId: z.number(),
      documentType: z.string(),
      title: z.string(),
      description: z.string().optional(),
      fileUrl: z.string(),
      fileName: z.string(),
      expiryDate: z.date().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can upload contractor documents",
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

      const document = await db.contractorDocument.create({
        data: {
          contractorId: input.contractorId,
          documentType: input.documentType as any,
          title: input.title,
          description: input.description,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          expiryDate: input.expiryDate,
          notes: input.notes,
        },
      });

      return {
        success: true,
        document: {
          id: document.id,
          title: document.title,
          documentType: document.documentType,
          fileName: document.fileName,
          expiryDate: document.expiryDate,
        },
        message: "Document uploaded successfully",
      };
    } catch (error) {
      console.error("Error uploading contractor document:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to upload document",
      });
    }
  });
