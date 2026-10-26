import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getMyUpcomingInterviews = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const bookings = await db.interviewBooking.findMany({
      where: {
        status: { in: ["SCHEDULED", "PENDING"] },
        scheduledStart: { gte: new Date() },
        panel: { members: { some: { userId: user.id } } },
      },
      include: {
        application: {
          select: { id: true, firstName: true, lastName: true, email: true,
                    job: { select: { id: true, title: true, department: true } } },
        },
        panel: {
          include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } } },
        },
      },
      orderBy: { scheduledStart: "asc" },
      take: 20,
    });
    return bookings;
  });
