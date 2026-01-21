import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { getInternalMinioUrl, minioClient } from "~/server/minio";
import { authenticateUser } from "~/server/utils/auth";

export const generateStatementPdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      statementId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user using helper function
    const user = await authenticateUser(input.token);

    const statement = await db.statement.findUnique({
      where: { id: input.statementId },
    });

    if (!statement) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Statement not found",
      });
    }

    // Check authorization
    if (user.role === "CUSTOMER" && statement.client_email !== user.email) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only access your own statements",
      });
    }

    if (!statement.pdfUrl) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Statement PDF is not available yet",
      });
    }

    // Allow downloading draft/generated statements (PM review workflow) and overdue statements.
    // The only hard requirement is that the PDF exists.
    const allowedStatuses = ["generated", "sent", "paid", "viewed", "overdue"];
    if (!allowedStatuses.includes(statement.status)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Statement PDF is not available yet",
      });
    }

    // Fetch PDF from MinIO using the MinIO client (with authentication)
    // Parse the pdfUrl to extract bucket and object path
    // Expected format: http://host:port/bucket/path/to/file.pdf
    const urlParts = statement.pdfUrl.split('/');
    const bucketName = urlParts[3]; // After http://host:port/
    const objectPath = urlParts.slice(4).join('/'); // Everything after bucket name

    if (!bucketName || !objectPath) {
      console.error(`Invalid pdfUrl format: ${statement.pdfUrl}`);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid statement PDF URL format",
      });
    }

    try {
      // Use MinIO client to get the object (authenticated)
      const stream = await minioClient.getObject(bucketName, objectPath);
      
      // Collect the stream data into a buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const pdfBuffer = Buffer.concat(chunks);
      const pdfBase64 = pdfBuffer.toString("base64");

      return { pdf: pdfBase64 };
    } catch (error: any) {
      console.error(`Failed to fetch PDF from MinIO bucket=${bucketName} path=${objectPath}:`, error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch statement PDF from storage",
      });
    }
  });
