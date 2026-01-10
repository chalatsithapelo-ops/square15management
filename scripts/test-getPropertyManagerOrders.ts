import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { createCaller } from "~/server/trpc/root";

async function main() {
  const userId = Number(process.argv[2] ?? 6);
  const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "30m" });

  const caller = createCaller({});
  const orders = await caller.getPropertyManagerOrders({ token, status: null });

  console.log(`userId=${userId} -> getPropertyManagerOrders returned ${orders.length} order(s)`);
  console.log(
    orders.map((o: any) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, contractorId: o.contractorId }))
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
