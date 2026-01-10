import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { createCaller } from "~/server/trpc/root";

async function main() {
  const userId = Number(process.argv[2] ?? 6);
  const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "30m" });

  const caller = createCaller({});

  const created = await caller.createNotification({
    token,
    recipientId: userId,
    message: `Test notification at ${new Date().toISOString()}`,
    type: "ORDER_ASSIGNED",
    relatedEntityId: 1,
    relatedEntityType: "ORDER",
  });

  const unreadBefore = await caller.getUnreadNotificationCount({ token });
  const list = await caller.getNotifications({ token, limit: 5 });

  console.log("created:", { id: (created as any).id, recipientRole: (created as any).recipientRole, type: (created as any).type });
  console.log("unreadCount:", unreadBefore);
  console.log(
    "latest:",
    list.map((n: any) => ({ id: n.id, isRead: n.isRead, type: n.type, recipientRole: n.recipientRole }))
  );

  if (list[0]?.id) {
    await caller.markNotificationAsRead({ token, notificationId: list[0].id });
    const unreadAfter = await caller.getUnreadNotificationCount({ token });
    console.log("unreadAfterMarkOne:", unreadAfter);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
