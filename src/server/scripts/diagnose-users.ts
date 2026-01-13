import { config as dotenvConfig } from "dotenv";
import { join } from "path";

// Ensure env is loaded for DB connection
dotenvConfig({ path: join(process.cwd(), ".env") });

import bcryptjs from "bcryptjs";
import { db } from "~/server/db";

async function main() {
  const emails = [
    "admin@propmanagement.com",
    "chalatsithapelo@gmail.com",
    "pm@propmanagement.com",
  ];

  const users = await db.user.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
    orderBy: { email: "asc" },
  });

  console.log("\n=== User records (by email) ===");
  for (const u of users) {
    console.log(
      JSON.stringify(
        {
          id: u.id,
          email: u.email,
          role: u.role,
          firstName: u.firstName,
          lastName: u.lastName,
          createdAt: u.createdAt,
        },
        null,
        0
      )
    );
  }

  const admin = users.find((u) => u.email === "admin@propmanagement.com");
  const personal = users.find((u) => u.email === "chalatsithapelo@gmail.com");

  console.log("\n=== Account separation check ===");
  console.log(
    JSON.stringify(
      {
        adminFound: !!admin,
        personalFound: !!personal,
        sameUserId: !!(admin && personal && admin.id === personal.id),
      },
      null,
      0
    )
  );

  const pm = users.find((u) => u.email === "pm@propmanagement.com");
  if (pm) {
    const fullPm = await db.user.findUnique({
      where: { email: "pm@propmanagement.com" },
      select: { password: true },
    });

    console.log("\n=== PM password check ===");
    const storedHash = fullPm?.password ?? "";
    const matchesPm123 = storedHash ? await bcryptjs.compare("pm123", storedHash) : false;
    const matchesProperty123 = storedHash ? await bcryptjs.compare("property123", storedHash) : false;

    console.log(
      JSON.stringify(
        {
          pmUserId: pm.id,
          matchesPm123,
          matchesProperty123,
        },
        null,
        0
      )
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.$disconnect();
    } catch {
      // ignore
    }
  });
