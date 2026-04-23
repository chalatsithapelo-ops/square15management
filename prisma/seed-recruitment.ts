/**
 * Demo seed for the modern ATS.
 *
 * Run: pnpm tsx prisma/seed-recruitment.ts
 *
 * Idempotent — safe to re-run.
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const db = new PrismaClient();

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("▶ Seeding recruitment demo data…");

  // 1. Find or create an admin user we can attribute ownership to.
  let admin = await db.user.findFirst({
    where: { role: { in: ["ADMIN", "SENIOR_ADMIN", "HR", "RECRUITER"] } },
  });
  if (!admin) {
    admin = await db.user.create({
      data: {
        email: "recruiter@sqr15.test",
        firstName: "Demo",
        lastName: "Recruiter",
        role: "RECRUITER",
        password: "demo-seed-placeholder",
        isActive: true,
      } as any,
    });
    console.log("  • Created demo recruiter user:", admin.email);
  } else {
    console.log("  • Using existing user:", admin.email);
  }

  // 2. Default pipeline
  let pipeline = await db.jobPipeline.findFirst({ where: { isDefault: true } });
  if (!pipeline) {
    pipeline = await db.jobPipeline.create({
      data: {
        name: "Standard hiring pipeline",
        description: "Applied → Screening → Assessment → Interview → Offer → Background → Hired",
        isDefault: true,
        stages: {
          create: [
            { name: "Applied", bucket: "APPLIED", order: 1 },
            { name: "Phone screen", bucket: "SCREENING", order: 2 },
            { name: "Assessments", bucket: "ASSESSMENT", order: 3, slaHours: 72 },
            { name: "First interview", bucket: "INTERVIEW", order: 4, slaHours: 120 },
            { name: "Panel interview", bucket: "INTERVIEW", order: 5, slaHours: 120 },
            { name: "Offer", bucket: "OFFER", order: 6, slaHours: 48 },
            { name: "Background check", bucket: "BACKGROUND_CHECK", order: 7, slaHours: 120 },
            { name: "Hired", bucket: "HIRED", order: 8 },
          ],
        },
      },
      include: { stages: true },
    });
    console.log("  • Created default pipeline with", (pipeline as any).stages.length, "stages");
  } else {
    console.log("  • Pipeline already exists");
  }
  pipeline = await db.jobPipeline.findUnique({ where: { id: pipeline!.id }, include: { stages: true } }) as any;

  // 3. Rejection reasons
  const rejCount = await db.rejectionReason.count();
  if (rejCount === 0) {
    await db.rejectionReason.createMany({
      data: [
        { code: "QUAL_EXP", category: "QUALIFICATIONS", label: "Insufficient experience" },
        { code: "QUAL_CERT", category: "QUALIFICATIONS", label: "Missing required certifications" },
        { code: "SKILL_GAP", category: "SKILLS", label: "Technical skills gap" },
        { code: "FIT", category: "FIT", label: "Culture fit concerns" },
        { code: "SALARY", category: "SALARY", label: "Salary expectations out of range" },
        { code: "AVAIL", category: "AVAILABILITY", label: "Start date mismatch" },
        { code: "LOCATION", category: "LOCATION", label: "Location / commute" },
        { code: "NO_RESP", category: "WITHDREW", label: "Candidate did not respond" },
        { code: "BETTER", category: "OTHER", label: "Better candidate selected" },
      ],
    });
    console.log("  • Seeded 9 rejection reasons");
  }

  // 4. Scorecard template
  let scorecard = await db.scorecard.findFirst({ where: { name: "Standard interview scorecard" } });
  if (!scorecard) {
    scorecard = await db.scorecard.create({
      data: {
        name: "Standard interview scorecard",
        description: "Default rubric for panel interviews",
        isTemplate: true,
        criteria: {
          create: [
            { name: "Technical skills", description: "Depth and breadth of role-specific skill", weight: 2, order: 1 },
            { name: "Problem solving", description: "Analytical thinking and judgement", weight: 1.5, order: 2 },
            { name: "Communication", description: "Clarity, listening, structure", weight: 1, order: 3 },
            { name: "Ownership & initiative", description: "Drive and proactiveness", weight: 1, order: 4 },
            { name: "Values alignment", description: "Fit with company values", weight: 1, order: 5 },
          ],
        },
      },
    });
    console.log("  • Created scorecard template");
  }

  // 5. Demo jobs
  const jobSpecs = [
    {
      title: "Senior Plumber",
      department: "Operations",
      category: "Plumbing",
      location: "Johannesburg",
      province: "Gauteng",
      employmentType: "FULL_TIME",
      experienceLevel: "SENIOR",
      description: "We're hiring a Senior Plumber to lead maintenance and installation work across our managed properties.",
      responsibilities: "- Diagnose and repair complex plumbing faults\n- Lead junior technicians\n- Maintain safety standards",
      requirements: "- 5+ years plumbing experience\n- Trade certification\n- Own reliable transport",
      minSalary: 18000,
      maxSalary: 28000,
    },
    {
      title: "Electrician",
      department: "Operations",
      category: "Electrical",
      location: "Cape Town",
      province: "Western Cape",
      employmentType: "FULL_TIME",
      experienceLevel: "MID",
      description: "Qualified electrician to service residential and commercial properties.",
      responsibilities: "- Install, repair, maintain electrical systems\n- Issue COC certificates\n- Respond to emergency callouts",
      requirements: "- Red seal\n- Wireman's licence preferred\n- Valid driver's licence",
      minSalary: 15000,
      maxSalary: 22000,
    },
    {
      title: "Property Sales Consultant",
      department: "Sales",
      category: "Sales",
      location: "Durban",
      province: "KwaZulu-Natal",
      employmentType: "FULL_TIME",
      experienceLevel: "MID",
      description: "Join our sales team to drive new property management contracts.",
      responsibilities: "- Generate and qualify leads\n- Conduct client meetings\n- Close property management contracts",
      requirements: "- 2+ years B2B sales experience\n- Excellent English communication\n- Own vehicle",
      minSalary: 12000,
      maxSalary: 20000,
    },
    {
      title: "Admin Assistant",
      department: "Administration",
      category: "Administration",
      location: "Johannesburg",
      province: "Gauteng",
      employmentType: "FULL_TIME",
      experienceLevel: "JUNIOR",
      description: "Support the operations team with scheduling, data entry, and client communication.",
      responsibilities: "- Handle inbound calls and emails\n- Schedule work orders\n- Maintain records",
      requirements: "- Matric\n- Computer literate\n- Strong written communication",
      minSalary: 8000,
      maxSalary: 12000,
    },
  ];

  const createdJobs: any[] = [];
  for (const spec of jobSpecs) {
    const slug = slugify(spec.title) + "-" + Math.random().toString(36).slice(2, 6);
    const existing = await db.job.findFirst({ where: { title: spec.title, status: "OPEN" } });
    if (existing) {
      createdJobs.push(existing);
      continue;
    }
    const job = await db.job.create({
      data: {
        ...spec,
        slug,
        employmentType: spec.employmentType as any,
        status: "OPEN",
        visibility: "PUBLIC",
        pipelineId: pipeline!.id,
        createdById: admin.id,
        hiringManagerId: admin.id,
        openedAt: new Date(),
        headcount: 1,
        currency: "ZAR",
        requireIQ: spec.category !== "Administration",
        requireEQ: true,
        requireBigFive: true,
        requireSJT: true,
        requireWorkSample: spec.category === "Plumbing" || spec.category === "Electrical",
        requireInterview: true,
      },
    });
    createdJobs.push(job);
    console.log(`  • Created job: ${job.title} (/careers/${job.slug})`);
  }

  // 6. Sample applications across stages
  const stages = (pipeline as any).stages as any[];
  const findStage = (bucket: string) => stages.find((s) => s.bucket === bucket);

  const candidateSeeds = [
    { firstName: "Thabo", lastName: "Mokoena", email: "thabo.m@example.com", phone: "+27821234567", bucket: "APPLIED", score: 68, aiMatch: 72 },
    { firstName: "Naledi", lastName: "Dlamini", email: "naledi.d@example.com", phone: "+27832223344", bucket: "SCREENING", score: 78, aiMatch: 85 },
    { firstName: "Pieter", lastName: "van der Merwe", email: "pieter.vdm@example.com", phone: "+27845556677", bucket: "ASSESSMENT", score: 82, aiMatch: 80 },
    { firstName: "Lerato", lastName: "Ndlovu", email: "lerato.n@example.com", phone: "+27829998888", bucket: "INTERVIEW", score: 88, aiMatch: 90 },
    { firstName: "Sipho", lastName: "Khumalo", email: "sipho.k@example.com", phone: "+27837778899", bucket: "OFFER", score: 91, aiMatch: 88 },
    { firstName: "Amahle", lastName: "Zulu", email: "amahle.z@example.com", phone: "+27841112233", bucket: "HIRED", score: 95, aiMatch: 92 },
    { firstName: "Johan", lastName: "Botha", email: "johan.b@example.com", phone: "+27825554433", bucket: "REJECTED", score: 42, aiMatch: 38 },
  ];

  for (const job of createdJobs.slice(0, 3)) {
    for (const c of candidateSeeds) {
      const exists = await db.application.findFirst({
        where: { email: c.email, jobId: job.id },
        select: { id: true },
      });
      if (exists) continue;
      const stage = findStage(c.bucket);
      await db.application.create({
        data: {
          jobId: job.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          primaryTrade: job.category,
          yearsExperience: Math.floor(Math.random() * 10) + 2,
          expectedSalary: String(Math.floor(Math.random() * 10000) + 12000),
          city: job.location,
          province: job.province,
          stageBucket: c.bucket as any,
          currentStageId: stage?.id,
          overallScore: c.score,
          aiMatchScore: c.aiMatch,
          aiMatchExplanation: c.aiMatch > 80
            ? "Strong alignment with core requirements: relevant experience and skills match highly. Recommended for interview."
            : c.aiMatch > 60
            ? "Moderate fit — some key requirements met; a screening call would clarify gaps."
            : "Low fit — consider other roles or talent pool.",
          sourceChannel: ["CAREER_SITE", "LINKEDIN", "REFERRAL", "INDEED"][Math.floor(Math.random() * 4)] as any,
          consentGivenAt: new Date(),
          consentVersion: "1.0",
          privacyPolicyVersion: "1.0",
          retainUntil: new Date(Date.now() + 24 * 30 * 24 * 3600 * 1000),
          accessTokenExpiresAt: new Date(Date.now() + 21 * 24 * 3600 * 1000),
          hiredAt: c.bucket === "HIRED" ? new Date() : null,
          rejectionDetail: c.bucket === "REJECTED" ? "Insufficient experience for role level." : null,
        },
      });
    }
    console.log(`  • Seeded ${candidateSeeds.length} applications for ${job.title}`);
  }

  // 7. Talent pool
  const poolExists = await db.talentPool.findFirst({ where: { name: "Silver medallists" } });
  if (!poolExists) {
    await db.talentPool.create({
      data: {
        name: "Silver medallists",
        description: "Strong candidates who narrowly missed out — re-engage for future roles.",
        createdById: admin.id,
      },
    });
    console.log("  • Created talent pool");
  }

  console.log("✓ Recruitment demo seed complete.");
  console.log("\nTry these URLs:");
  for (const j of createdJobs) console.log(`  → /careers/${j.slug}`);
  console.log("  → /careers");
  console.log("  → /admin/recruitment/jobs");
  console.log("  → /admin/recruitment/analytics");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
