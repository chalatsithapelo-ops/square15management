/**
 * One-time data cleanup for the recruitment bugs reported 2026-09-13:
 *  1) Any Job with location containing "Sandton" or "Rosebank" OR a blank /
 *     province-only location is normalised to plain "Johannesburg / Gauteng".
 *  2) Any Job with "(Rosebank)" or "(Sandton)" tacked on to the title has the
 *     suffix stripped so the career-site shows a single "Painter" instead of
 *     "Painter (Rosebank)".
 *  3) Every OPEN / DRAFT job has its assessment requirement flags flipped ON
 *     (IQ, EQ, MBTI, Big Five, Work Sample, Interview) so candidates see the
 *     full 5-assessment pack, matching the new schema defaults.
 *
 * Idempotent — re-running is safe.
 * Run: node backfill-recruitment-2026-09-13.cjs
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // ─── 1. Location normalisation ───
  const rawJobs = await prisma.job.findMany({
    select: { id: true, title: true, location: true, province: true, status: true },
  });

  let locFixed = 0;
  let titleFixed = 0;
  for (const j of rawJobs) {
    const patch = {};

    // Title: strip trailing " (Rosebank)" / " (Sandton)" / " (Gauteng)" etc.
    const cleanTitle = (j.title || "").replace(/\s*\((Sandton|Rosebank|Gauteng|Johannesburg)\)\s*$/i, "").trim();
    if (cleanTitle && cleanTitle !== j.title) patch.title = cleanTitle;

    // Location: any Sandton / Rosebank / bare "Gauteng" → "Johannesburg"
    const loc = (j.location || "").trim();
    const locLower = loc.toLowerCase();
    if (
      locLower === "" ||
      locLower === "gauteng" ||
      locLower.includes("sandton") ||
      locLower.includes("rosebank")
    ) {
      patch.location = "Johannesburg";
      patch.province = "Gauteng";
    }

    if (Object.keys(patch).length > 0) {
      await prisma.job.update({ where: { id: j.id }, data: patch });
      if (patch.location) locFixed++;
      if (patch.title) titleFixed++;
      console.log(`Job #${j.id}: ${JSON.stringify(patch)}`);
    }
  }

  // ─── 2. Assessment flag backfill ───
  const flagResult = await prisma.job.updateMany({
    where: { status: { in: ["OPEN", "DRAFT", "PENDING_APPROVAL"] } },
    data: {
      requireIQ: true,
      requireEQ: true,
      requireBigFive: true,
      requireMBTI: true,
      requireWorkSample: true,
      requireInterview: true,
    },
  });

  console.log("");
  console.log(`Location fixes:   ${locFixed}`);
  console.log(`Title fixes:      ${titleFixed}`);
  console.log(`Assessment flags: ${flagResult.count} rows updated`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
