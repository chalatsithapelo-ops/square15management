import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { assertRecruiter } from "~/server/services/recruitment/atsHelpers";
import { sendCandidateEmail } from "~/server/services/recruitment/messaging";
import { sendEmail } from "~/server/utils/email";

// EMAILS_ADDED_v1
export const bookInterviewWithAssessors = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      assessorUserIds: z.array(z.number()).min(1),
      scheduledStart: z.string(),
      scheduledEnd: z.string(),
      location: z.string().default("VIDEO"),
      meetingUrl: z.string().optional(),
      stage: z.string().optional(),
      agenda: z.string().optional(),
      panelName: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);

    const app = await db.application.findUnique({
      where: { id: input.applicationId },
      select: {
        id: true, jobId: true, firstName: true, lastName: true, email: true, phone: true,
        accessToken: true, job: { select: { title: true } },
      },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

    const assessors = await db.user.findMany({
      where: { id: { in: input.assessorUserIds } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
    if (assessors.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Pick at least one assessor" });
    }
    const panelName =
      input.panelName ??
      `Interview for ${app.firstName} ${app.lastName} \u2014 ${assessors.map((a) => a.firstName).join(", ")}`;

    const panel = await db.interviewPanel.create({
      data: {
        name: panelName,
        jobId: app.jobId,
        members: { create: input.assessorUserIds.map((id) => ({ userId: id, required: true })) },
      },
    });

    const booking = await db.interviewBooking.create({
      data: {
        applicationId: input.applicationId,
        panelId: panel.id,
        scheduledStart: new Date(input.scheduledStart),
        scheduledEnd: new Date(input.scheduledEnd),
        location: input.location,
        meetingUrl: input.meetingUrl,
        stage: input.stage,
        agenda: input.agenda,
        createdById: user.id,
        status: "SCHEDULED",
      },
    });

    // â”€â”€ Email notifications (fire-and-forget so a mail failure does not abort the booking) â”€â”€
    void (async () => {
      const origin = (process.env.APP_URL || "https://square15management.co.za").replace(/\/+$/, "");
      const startStr = new Date(input.scheduledStart).toLocaleString("en-ZA", {
        weekday: "long", year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false,
      });
      const durationMin = Math.round((new Date(input.scheduledEnd).getTime() - new Date(input.scheduledStart).getTime()) / 60000);
      const locationLabel: Record<string, string> = {
        VIDEO: input.meetingUrl ? `Video call: ${input.meetingUrl}` : "Video call (link to follow)",
        OFFICE: "Head office (Modderfontein)",
        ONSITE: "On-site (address to follow)",
        PHONE: "Phone call",
      };
      const locStr = locationLabel[input.location] ?? input.location;
      const assessorList = assessors.map((a) => `${a.firstName} ${a.lastName} (${a.role.replace(/_/g, " ")})`).join(", ");

      // â†’ Candidate
      try {
        const portalUrl = `${origin}/candidate/${app.accessToken}`;
        await sendCandidateEmail({
          applicationId: app.id,
          to: app.email,
          subject: `Interview invitation \u2014 ${app.job?.title ?? "Square 15 role"}`,
          templateKey: "INTERVIEW_INVITE_MANUAL",
          sentById: user.id,
          html: `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
  <div style="background:#2D5016;color:#F4C430;padding:16px 20px;">
    <div style="font-size:12px;letter-spacing:2px;">SQUARE 15 FACILITY SOLUTIONS</div>
    <div style="font-size:20px;font-weight:700;color:#fff;">You\u2019re invited to an interview</div>
  </div>
  <div style="border:1px solid #eee;border-top:none;padding:20px 24px;">
    <p>Hi ${app.firstName},</p>
    <p>We\u2019ve scheduled your interview for the <b>${app.job?.title ?? "Square 15"}</b> role.</p>
    <ul>
      <li><b>When:</b> ${startStr} (${durationMin} minutes)</li>
      <li><b>Where:</b> ${locStr}</li>
      <li><b>Panel:</b> ${assessorList}</li>
      ${input.agenda ? `<li><b>Agenda:</b> ${input.agenda}</li>` : ""}
    </ul>
    <p style="margin-top:20px;">
      <a href="${portalUrl}" style="display:inline-block;padding:10px 18px;background:#2D5016;color:#F4C430;text-decoration:none;border-radius:6px;font-weight:600;">Open my candidate portal</a>
    </p>
    <p style="font-size:12px;color:#666;margin-top:24px;">If you need to reschedule, reply to this email or use the in-portal messaging.</p>
  </div>
</body></html>`,
        });
      } catch (e) {
        console.warn("[bookInterviewWithAssessors] candidate email failed:", (e as Error).message);
      }

      // â†’ Each assessor
      for (const a of assessors) {
        if (!a.email) continue;
        try {
          await sendEmail({
            to: a.email,
            subject: `Interview scheduled: ${app.firstName} ${app.lastName} \u2014 ${app.job?.title ?? "role"}`,
            html: `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
  <div style="background:#2D5016;color:#F4C430;padding:16px 20px;">
    <div style="font-size:12px;letter-spacing:2px;">SQUARE 15 RECRUITMENT</div>
    <div style="font-size:20px;font-weight:700;color:#fff;">You\u2019re on an interview panel</div>
  </div>
  <div style="border:1px solid #eee;border-top:none;padding:20px 24px;">
    <p>Hi ${a.firstName},</p>
    <p>You\u2019ve been assigned as an assessor for an upcoming interview.</p>
    <ul>
      <li><b>Candidate:</b> ${app.firstName} ${app.lastName}</li>
      <li><b>Role:</b> ${app.job?.title ?? "\u2014"}</li>
      <li><b>When:</b> ${startStr} (${durationMin} minutes)</li>
      <li><b>Where:</b> ${locStr}</li>
      <li><b>Panel:</b> ${assessorList}</li>
      ${input.agenda ? `<li><b>Agenda:</b> ${input.agenda}</li>` : ""}
    </ul>
    <p style="margin-top:20px;">
      <a href="${origin}/admin/recruitment/applications/${app.id}" style="display:inline-block;padding:10px 18px;background:#2D5016;color:#F4C430;text-decoration:none;border-radius:6px;font-weight:600;">Open candidate profile & scorecard</a>
    </p>
    <p style="font-size:12px;color:#666;margin-top:24px;">Please complete your Interview Kit scorecard within 24 hours of the interview.</p>
  </div>
</body></html>`,
          });
        } catch (e) {
          console.warn(`[bookInterviewWithAssessors] assessor email to ${a.email} failed:`, (e as Error).message);
        }
      }
    })();

    return { ok: true, panelId: panel.id, bookingId: booking.id, notified: assessors.length + 1 };
  });
