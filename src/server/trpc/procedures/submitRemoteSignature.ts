import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { publicProcedure } from "~/server/trpc/main";
import { minioClient, minioBaseUrl } from "~/server/minio";

export const submitRemoteSignature = publicProcedure
  .input(
    z.object({
      signatureToken: z.string().min(1),
      signatureDataUrl: z.string().min(1), // base64 data URL from canvas
      clientRepName: z.string().min(1, "Name is required"),
    })
  )
  .mutation(async ({ input }) => {
    // Find the order by token
    let order = await db.order.findUnique({
      where: { signatureRequestToken: input.signatureToken },
      select: { id: true, orderNumber: true, signedJobCardUrl: true },
    });

    let isPMOrder = false;
    let pmOrder: any = null;

    if (!order) {
      pmOrder = await db.propertyManagerOrder.findUnique({
        where: { signatureRequestToken: input.signatureToken },
        select: { id: true, orderNumber: true, signedJobCardUrl: true },
      });
      if (!pmOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired signature request link",
        });
      }
      isPMOrder = true;
    }

    const targetOrder = order || pmOrder;

    if (targetOrder.signedJobCardUrl) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This job card has already been signed",
      });
    }

    // Convert base64 data URL to buffer
    const base64Match = input.signatureDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid signature image format",
      });
    }

    const imageBuffer = Buffer.from(base64Match[1]!, "base64");

    // Validate image size (max 2MB)
    if (imageBuffer.length > 2 * 1024 * 1024) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Signature image is too large",
      });
    }

    // Upload to MinIO - use "property-management" bucket to match existing convention
    const timestamp = Date.now();
    const objectName = `signatures/remote-signature-${targetOrder.orderNumber}-${timestamp}.png`;

    await minioClient.putObject("property-management", objectName, imageBuffer, imageBuffer.length, {
      "Content-Type": "image/png",
    });

    // URL follows the nginx proxy pattern: /minio/property-management/<objectName>
    const signatureUrl = `${minioBaseUrl}/property-management/${objectName}`;
    const now = new Date();

    // Update the order with signature data
    if (isPMOrder) {
      await db.propertyManagerOrder.update({
        where: { id: targetOrder.id },
        data: {
          signedJobCardUrl: signatureUrl,
          clientRepName: input.clientRepName,
          clientRepSignDate: now,
          clientUnavailableToSign: false, // Clear since they've now signed
          signatureRequestToken: null, // Invalidate the token
        },
      });
    } else {
      await db.order.update({
        where: { id: targetOrder.id },
        data: {
          signedJobCardUrl: signatureUrl,
          clientRepName: input.clientRepName,
          clientRepSignDate: now,
          clientUnavailableToSign: false,
          signatureRequestToken: null,
        },
      });
    }

    return {
      success: true,
      orderNumber: targetOrder.orderNumber,
      message: "Job card signed successfully. Thank you!",
    };
  });
