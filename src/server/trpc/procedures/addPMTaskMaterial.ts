import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const addPMTaskMaterialSchema = z.object({
  token: z.string(),
  taskId: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().min(0),
  unit: z.string().default("unit"),
  unitPrice: z.number().min(0),
});

export const addPMTaskMaterial = baseProcedure
  .input(addPMTaskMaterialSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    try {
      const task = await db.pMTask.findFirst({
        where: { id: input.taskId, propertyManagerId: user.id },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found.",
        });
      }

      const material = await db.pMTaskMaterial.create({
        data: {
          taskId: input.taskId,
          name: input.name,
          description: input.description || null,
          quantity: input.quantity,
          unit: input.unit,
          unitPrice: input.unitPrice,
          totalCost: input.quantity * input.unitPrice,
        },
      });

      // Update task material cost
      const allMaterials = await db.pMTaskMaterial.findMany({
        where: { taskId: input.taskId },
      });
      const totalMaterialCost = allMaterials.reduce((sum, m) => sum + m.totalCost, 0);

      await db.pMTask.update({
        where: { id: input.taskId },
        data: { materialCost: totalMaterialCost },
      });

      return material;
    } catch (error) {
      console.error("Error adding task material:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to add task material.",
      });
    }
  });
