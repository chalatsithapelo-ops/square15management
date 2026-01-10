import { db } from "~/server/db";
import { notifyLeadFollowUpReminder } from "~/server/utils/notifications";
import { sendFollowUpReminderEmail } from "~/server/utils/email";

async function checkLeadReminders() {
  console.log("Checking for lead follow-up reminders...");
  
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    // Find leads with follow-ups due today or overdue
    // Exclude WON and LOST leads as they don't need follow-ups
    const leadsNeedingFollowUp = await db.lead.findMany({
      where: {
        nextFollowUpDate: {
          lte: endOfToday,
        },
        status: {
          notIn: ["WON", "LOST"],
        },
        followUpAssignedToId: {
          not: null,
        },
      },
      include: {
        followUpAssignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    console.log(`Found ${leadsNeedingFollowUp.length} leads needing follow-up`);

    for (const lead of leadsNeedingFollowUp) {
      if (!lead.followUpAssignedTo || !lead.nextFollowUpDate) {
        continue;
      }

      // Calculate days overdue
      const followUpDate = new Date(lead.nextFollowUpDate);
      const diffTime = now.getTime() - followUpDate.getTime();
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      try {
        // Send in-app notification
        await notifyLeadFollowUpReminder({
          assignedToId: lead.followUpAssignedTo.id,
          leadId: lead.id,
          customerName: lead.customerName,
          serviceType: lead.serviceType,
          daysOverdue,
        });

        // Send email reminder
        await sendFollowUpReminderEmail({
          recipientEmail: lead.followUpAssignedTo.email,
          recipientName: `${lead.followUpAssignedTo.firstName} ${lead.followUpAssignedTo.lastName}`,
          leadId: lead.id,
          customerName: lead.customerName,
          customerEmail: lead.customerEmail,
          customerPhone: lead.customerPhone,
          serviceType: lead.serviceType,
          description: lead.description,
          estimatedValue: lead.estimatedValue || undefined,
          address: lead.address || undefined,
          nextFollowUpDate: followUpDate,
          daysOverdue,
          leadStatus: lead.status,
        });

        console.log(
          `✓ Sent reminder for lead #${lead.id} (${lead.customerName}) to ${lead.followUpAssignedTo.email}`
        );
      } catch (error) {
        console.error(
          `Failed to send reminder for lead #${lead.id}:`,
          error
        );
        // Continue with other leads even if one fails
      }
    }

    console.log("✓ Lead reminder check completed successfully");
  } catch (error) {
    console.error("Lead reminder check failed:", error);
    throw error;
  }
}

// Run the check
checkLeadReminders()
  .then(() => {
    console.log("check-lead-reminders.ts complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
