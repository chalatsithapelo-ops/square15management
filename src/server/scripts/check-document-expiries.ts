import { db } from "~/server/db";
import { notifyAdminsDocumentExpiry } from "~/server/utils/notifications";

async function checkDocumentExpiries() {
  console.log("Checking for expiring HR documents...");
  
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Find documents with expiry dates within the next 30 days or already expired
    const expiringDocuments = await db.hRDocument.findMany({
      where: {
        expiryDate: {
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    console.log(`Found ${expiringDocuments.length} documents expiring within 30 days`);

    for (const document of expiringDocuments) {
      if (!document.expiryDate) {
        continue;
      }

      // Calculate days until expiry
      const expiryDate = new Date(document.expiryDate);
      const diffTime = expiryDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      try {
        // Send notification to admins
        await notifyAdminsDocumentExpiry({
          documentId: document.id,
          employeeName: `${document.employee.firstName} ${document.employee.lastName}`,
          documentTitle: document.title,
          documentType: document.documentType,
          expiryDate: expiryDate,
          daysUntilExpiry: daysUntilExpiry,
        });

        console.log(
          `✓ Sent expiry notification for document #${document.id} (${document.title}) for ${document.employee.firstName} ${document.employee.lastName} - ${daysUntilExpiry} days until expiry`
        );
      } catch (error) {
        console.error(
          `Failed to send notification for document #${document.id}:`,
          error
        );
        // Continue with other documents even if one fails
      }
    }

    console.log("✓ Document expiry check completed successfully");
  } catch (error) {
    console.error("Document expiry check failed:", error);
    throw error;
  }
}

// Run the check
checkDocumentExpiries()
  .then(() => {
    console.log("check-document-expiries.ts complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
