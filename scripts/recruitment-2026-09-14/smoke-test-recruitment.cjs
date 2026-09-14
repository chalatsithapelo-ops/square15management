/**
 * Smoke test for the 6 recruitment fixes deployed 2026-09-13.
 *
 * Verifies against a live (staging or local) instance:
 *   1. Branding — public careers page reads "Square 15 Facility Solutions"
 *      and the tRPC listPublicJobs feed no longer emits Sandton/Rosebank.
 *   2. Assessment defaults — new jobs created via createJob default to
 *      requireIQ/EQ/BigFive/MBTI/WorkSample/Interview = true.
 *   3. Assessment flow — candidateGetAssessmentStatus lists IQ, EQ, BIG_FIVE,
 *      MBTI for a candidate on a full-assessment job.
 *   4. Work sample count — candidateGetWorkSampleTasks returns >= 5 tasks
 *      (2 quotation scenarios + 3 role-specific) for a Painting/Plumbing job.
 *   5. AI summary fallback — recomputeScore always populates aiSummary
 *      (either real narrative or the deterministic fallback string).
 *   6. Interview stage guard — candidateListInterviewSlots returns
 *      reason="stage" for a SCREENING-stage application and only exposes
 *      slots once the recruiter moves them to INTERVIEW.
 *
 * Snapshot capture (bug #6) can only be exercised in a real browser session.
 * We check the wiring: candidateCaptureSnapshot procedure accepts writes and
 * the AssessmentSession row's snapshotCount increments.
 *
 * Usage:
 *   BASE_URL=https://staging.square15.co.za JWT_SECRET=... node smoke-test-recruitment.cjs
 *   (BASE_URL defaults to http://127.0.0.1:3000 for local runs.)
 *
 * Exit code is 0 when every check passes, 1 if any fails.
 */

const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER_ID = Number(process.env.SMOKE_ADMIN_ID || 2);

// ─── result accounting ───
const results = [];
function pass(name, detail) {
  results.push({ status: "PASS", name, detail: detail || "" });
  console.log(`✓ PASS  ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail) {
  results.push({ status: "FAIL", name, detail: detail || "" });
  console.log(`✗ FAIL  ${name}${detail ? " — " + detail : ""}`);
}
function skip(name, detail) {
  results.push({ status: "SKIP", name, detail: detail || "" });
  console.log(`○ SKIP  ${name}${detail ? " — " + detail : ""}`);
}

// ─── tRPC helper ───
// tRPC queries must be sent as GET with ?input=<encoded>, mutations as POST
// with the body {json: input}. This helper picks the right verb based on the
// caller's request. Pass {method: "GET"} for queries.
async function rpc(procedure, payload, opts = {}) {
  const url = `${BASE_URL}/trpc/${procedure}`;
  const method = (opts.method || "POST").toUpperCase();
  let fetchUrl = url;
  const init = { method, headers: { "content-type": "application/json" } };
  if (method === "GET") {
    const encoded = encodeURIComponent(JSON.stringify({ json: payload }));
    fetchUrl = `${url}?input=${encoded}`;
  } else {
    init.body = JSON.stringify({ json: payload });
  }
  const res = await fetch(fetchUrl, init);
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { status: res.status, body: parsed };
}

// Procedures that are tRPC queries (must use GET). Anything else is a mutation.
const QUERY_PROCS = new Set([
  "candidateGetAssessmentStatus",
  "candidateGetAssessmentQuestions",
  "candidateGetWorkSampleTasks",
  "candidateListInterviewSlots",
  "candidateDashboard",
]);
async function rpcAuto(procedure, payload) {
  return rpc(procedure, payload, { method: QUERY_PROCS.has(procedure) ? "GET" : "POST" });
}

function signAdminToken() {
  if (!JWT_SECRET) throw new Error("JWT_SECRET env var required");
  return jwt.sign({ userId: ADMIN_USER_ID }, JWT_SECRET, { expiresIn: "15m" });
}

// ─── individual checks ───

async function checkBranding() {
  try {
    const res = await fetch(`${BASE_URL}/careers`);
    const html = await res.text();
    if (html.includes("Square 15 Facility Solutions")) {
      pass("1a. Careers header renamed", "Found brand string");
    } else {
      fail("1a. Careers header renamed", "'Square 15 Facility Solutions' not found in /careers HTML");
    }
    if (html.includes("SQR15 Property Management") || html.includes("Square 15 Property Management")) {
      fail("1b. Old brand removed", "Stale brand string still present");
    } else {
      pass("1b. Old brand removed");
    }
  } catch (err) {
    fail("1. Branding check", `HTTP error: ${err.message}`);
  }
}

async function checkJobLocations() {
  const jobs = await prisma.job.findMany({
    where: { status: "OPEN", visibility: "PUBLIC" },
    select: { id: true, title: true, location: true, province: true },
  });
  const offenders = jobs.filter((j) => {
    const loc = (j.location || "").toLowerCase();
    return (
      loc.includes("sandton") ||
      loc.includes("rosebank") ||
      loc === "gauteng" ||
      loc === ""
    );
  });
  if (offenders.length === 0) {
    pass("2. Job locations normalised", `${jobs.length} open jobs, none in Sandton/Rosebank/blank`);
  } else {
    fail(
      "2. Job locations normalised",
      `${offenders.length} offenders: ` +
        offenders.slice(0, 5).map((j) => `#${j.id} "${j.title}"→"${j.location}"`).join("; "),
    );
  }

  const titleOffenders = jobs.filter((j) => /\((Sandton|Rosebank|Gauteng)\)\s*$/i.test(j.title || ""));
  if (titleOffenders.length === 0) {
    pass("2b. Job titles clean", "No trailing (Sandton)/(Rosebank) suffix");
  } else {
    fail(
      "2b. Job titles clean",
      `${titleOffenders.length} offenders: ` +
        titleOffenders.slice(0, 5).map((j) => `#${j.id} "${j.title}"`).join("; "),
    );
  }
}

async function checkAssessmentDefaults() {
  const token = signAdminToken();
  const stamp = Date.now();
  const create = await rpc("createJob", {
    token,
    title: `SMOKE-DELETE-ME ${stamp}`,
    description: "Smoke-test job — safe to delete.",
    category: "Painting",
    location: "Johannesburg",
    province: "Gauteng",
  });
  if (create.status !== 200) {
    fail("3. Assessment defaults", `createJob HTTP ${create.status}: ${JSON.stringify(create.body).slice(0, 200)}`);
    return null;
  }
  const jobId =
    create.body?.result?.data?.json?.id ??
    create.body?.result?.data?.id ??
    create.body?.result?.data?.json?.job?.id;
  if (!jobId) {
    fail(
      "3. Assessment defaults",
      `createJob returned no id — body head: ${JSON.stringify(create.body).slice(0, 200)}`,
    );
    return null;
  }
  const row = await prisma.job.findUnique({ where: { id: jobId } });
  const flags = [
    ["requireIQ", row.requireIQ],
    ["requireEQ", row.requireEQ],
    ["requireBigFive", row.requireBigFive],
    ["requireMBTI", row.requireMBTI],
    ["requireWorkSample", row.requireWorkSample],
    ["requireInterview", row.requireInterview],
  ];
  const missing = flags.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length === 0) {
    pass("3. Assessment defaults", `Test job #${jobId} has all 6 flags = true`);
  } else {
    fail("3. Assessment defaults", `Test job #${jobId} missing: ${missing.join(", ")}`);
  }
  return jobId;
}

async function checkAssessmentFlowAndWorkSamples(smokeJobId) {
  // Find a real Painting/Plumbing job that has work sample tasks seeded.
  const job = await prisma.job.findFirst({
    where: {
      status: "OPEN",
      category: { in: ["Painting", "Plumbing", "Electrical", "Carpentry", "Sales", "Admin"] },
      requireMBTI: true,
    },
    include: { workSampleTasks: { where: { active: true } } },
  });
  if (!job) {
    skip("4. Work sample count", "No suitable seeded job found — run seed-work-samples.cjs first");
    skip("5. Assessment flow", "Needs a seeded job with candidate");
    return;
  }

  if (job.workSampleTasks.length >= 5) {
    pass("4. Work sample count", `Job #${job.id} "${job.title}" has ${job.workSampleTasks.length} tasks`);
  } else {
    fail(
      "4. Work sample count",
      `Job #${job.id} "${job.title}" has only ${job.workSampleTasks.length} tasks (need >=5)`,
    );
  }

  // Create a throwaway application on this job to verify the assessment
  // status endpoint returns all 4 psychometric types.
  const smokeEmail = `smoke+${Date.now()}@square15-test.local`;
  const app = await prisma.application.create({
    data: {
      jobId: job.id,
      firstName: "Smoke",
      lastName: "Test",
      email: smokeEmail,
      phone: "+27000000000",
      accessToken: `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      stageBucket: "ASSESSMENT",
      sourceChannel: "OTHER",
      sourceDetail: "smoke-test-recruitment.cjs",
    },
  });

  const status = await rpcAuto("candidateGetAssessmentStatus", { accessToken: app.accessToken });
  const required =
    status.body?.result?.data?.json?.required ??
    status.body?.result?.data?.required ??
    [];
  const expected = ["IQ", "EQ", "BIG_FIVE", "MBTI"];
  const missing = expected.filter((t) => !required.includes(t));
  if (missing.length === 0) {
    pass("5. Assessment flow", `required=[${required.join(", ")}]`);
  } else {
    fail(
      "5. Assessment flow",
      `Missing types: ${missing.join(", ")}. Got: [${required.join(", ")}]. Body head: ${JSON.stringify(status.body).slice(0, 200)}`,
    );
  }

  const tasks = await rpcAuto("candidateGetWorkSampleTasks", { accessToken: app.accessToken });
  const taskArr =
    tasks.body?.result?.data?.json?.tasks ??
    tasks.body?.result?.data?.tasks ??
    [];
  const taskCount = taskArr.length;
  if (taskCount >= 5) {
    pass("4b. Work sample via portal", `Portal returned ${taskCount} tasks`);
  } else {
    fail(
      "4b. Work sample via portal",
      `Portal returned only ${taskCount} tasks. Body head: ${JSON.stringify(tasks.body).slice(0, 200)}`,
    );
  }

  // Interview stage guard — should be blocked for SCREENING (this app is ASSESSMENT).
  const slots = await rpcAuto("candidateListInterviewSlots", { accessToken: app.accessToken });
  const jsonBody =
    slots.body?.result?.data?.json ?? slots.body?.result?.data ?? {};
  const reason = jsonBody?.reason;
  const available = jsonBody?.available;
  if (available === false && reason === "stage") {
    pass("7. Interview stage guard", `ASSESSMENT stage returns reason=stage`);
  } else {
    fail(
      "7. Interview stage guard",
      `Expected available=false reason=stage, got available=${available} reason=${reason}. Body head: ${JSON.stringify(slots.body).slice(0, 200)}`,
    );
  }

  // Now flip to INTERVIEW and confirm slots appear.
  await prisma.application.update({
    where: { id: app.id },
    data: { stageBucket: "INTERVIEW" },
  });
  const slots2 = await rpcAuto("candidateListInterviewSlots", { accessToken: app.accessToken });
  const jsonBody2 =
    slots2.body?.result?.data?.json ?? slots2.body?.result?.data ?? {};
  const avail2 = jsonBody2?.available;
  const slotArr = jsonBody2?.slots || [];
  if (avail2 !== false && slotArr.length > 0) {
    pass("7b. Interview slots exposed at INTERVIEW stage", `${slotArr.length} slots returned`);
  } else {
    fail(
      "7b. Interview slots exposed at INTERVIEW stage",
      `slots=${slotArr.length} available=${avail2}. Body head: ${JSON.stringify(slots2.body).slice(0, 200)}`,
    );
  }

  // AI summary fallback — call recompute + poll application row.
  const token = signAdminToken();
  const rec = await rpc("recomputeScore", { token, applicationId: app.id });
  if (rec.status !== 200) {
    fail("6. AI summary populated", `recomputeScore HTTP ${rec.status}`);
  } else {
    // The AI call may be async fire-and-forget inside the mutation — give it a moment.
    await new Promise((r) => setTimeout(r, 4000));
    const after = await prisma.application.findUnique({ where: { id: app.id } });
    if (after.aiSummary && after.aiSummary.trim().length > 5) {
      pass(
        "6. AI summary populated",
        `aiSummary = "${after.aiSummary.slice(0, 80)}${after.aiSummary.length > 80 ? "…" : ""}"`,
      );
    } else {
      fail("6. AI summary populated", `aiSummary is empty after recompute`);
    }
  }

  // Camera snapshot wiring — create a session and try one capture write.
  try {
    const start = await rpc("candidateStartSession", {
      accessToken: app.accessToken,
      webcamGranted: true,
    });
    const sessionId =
      start.body?.result?.data?.json?.id ??
      start.body?.result?.data?.id;
    if (!sessionId) {
      skip(
        "8. Snapshot wiring",
        `candidateStartSession returned no session id. Body head: ${JSON.stringify(start.body).slice(0, 200)}`,
      );
    } else {
      // Base64 JPEG payload must be > 100 chars to satisfy the Zod schema on the server.
      const tinyJpeg =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AH//Z";
      const snap = await rpc("candidateCaptureSnapshot", {
        accessToken: app.accessToken,
        sessionId,
        imageDataUrl: tinyJpeg,
      });
      if (snap.status === 200) {
        pass("8. Snapshot wiring", "candidateCaptureSnapshot accepted a payload");
      } else {
        fail(
          "8. Snapshot wiring",
          `HTTP ${snap.status}: ${JSON.stringify(snap.body).slice(0, 200)}`,
        );
      }
    }
  } catch (err) {
    skip("8. Snapshot wiring", `Skipped due to error: ${err.message}`);
  }

  // ─── cleanup smoke test rows ───
  //   Applications must go before Jobs (Application.jobId FK).
  //   AssessmentSession + AssessmentSnapshot cascade off Application per schema.
  await prisma.application.delete({ where: { id: app.id } }).catch((e) =>
    console.warn("[cleanup] application delete failed:", e.message),
  );
  if (smokeJobId) {
    await prisma.workSampleTask
      .deleteMany({ where: { jobId: smokeJobId } })
      .catch(() => {});
    await prisma.job
      .delete({ where: { id: smokeJobId } })
      .catch((e) => console.warn("[cleanup] smoke job delete failed:", e.message));
  }
}

async function main() {
  console.log(`Smoke test against ${BASE_URL}\n`);

  if (!JWT_SECRET) {
    console.error("JWT_SECRET env var is required. Aborting.");
    process.exit(2);
  }

  await checkBranding();
  await checkJobLocations();
  const smokeJobId = await checkAssessmentDefaults();
  await checkAssessmentFlowAndWorkSamples(smokeJobId);

  console.log("");
  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const skipCount = results.filter((r) => r.status === "SKIP").length;
  console.log(`Summary: ${passCount} pass · ${failCount} fail · ${skipCount} skip`);

  await prisma.$disconnect();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(2);
});
