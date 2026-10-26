/**
 * Inbound WhatsApp classifier + career-domain handler.
 *
 * Routing rules:
 *   1. If the sender's phone matches an existing `Application.phone`,
 *      route to the CAREER handler (candidate).
 *   2. Otherwise, route to the MAINTENANCE handler (customer / lead / unknown).
 *   3. All inbound messages are logged to `ApplicationMessage` (INBOUND) when
 *      a candidate match is found; otherwise to a WhatsAppInboundLog fallback
 *      so nothing is dropped from the audit trail.
 *
 * Every reply is sent freeform (allowed because the customer just messaged
 * us, opening a 24-hour service window).
 */
import { db } from "~/server/db";
import { sendWhatsAppFreeform } from "./sender";

export interface InboundMessage {
  from: string; // e.g. "27782123456"
  waMessageId: string;
  timestamp: number;
  text: string;
  type: string; // "text" | "button" | "interactive" | ...
}

// Normalise SA phone numbers so the DB lookup matches applications
// stored with a leading "0" as well as ones stored with country code "27".
function normaliseSaPhones(raw: string): string[] {
  const only = raw.replace(/[^0-9]/g, "");
  const options = new Set<string>();
  options.add(only);
  if (only.startsWith("27") && only.length >= 11) {
    options.add("0" + only.slice(2)); // 27782123456 → 0782123456
    options.add(only.slice(2)); // → 782123456
  } else if (only.startsWith("0") && only.length >= 10) {
    options.add("27" + only.slice(1));
    options.add(only.slice(1));
  }
  return Array.from(options);
}

export async function classifyInbound(m: InboundMessage): Promise<{
  domain: "CAREER" | "MAINTENANCE";
  applicationId?: number;
  candidateFirstName?: string;
}> {
  const options = normaliseSaPhones(m.from);
  // Sticky: whichever application (by phone) most recently interacted with us.
  const app = await db.application.findFirst({
    where: { phone: { in: options } },
    orderBy: { createdAt: "desc" },
    select: { id: true, firstName: true },
  });
  if (app) {
    return { domain: "CAREER", applicationId: app.id, candidateFirstName: app.firstName ?? undefined };
  }
  return { domain: "MAINTENANCE" };
}

// Log every inbound message so recruiters see the full conversation timeline.
export async function logInboundToApplication(applicationId: number, m: InboundMessage): Promise<void> {
  try {
    await db.applicationMessage.create({
      data: {
        applicationId,
        channel: "WHATSAPP",
        direction: "INBOUND",
        subject: "Candidate WhatsApp reply",
        body: m.text.slice(0, 4000),
        templateKey: "CANDIDATE_WA_INBOUND",
        deliveredAt: new Date(m.timestamp * 1000),
        provider: "WHATSAPP",
        providerMessageId: m.waMessageId,
      },
    });
  } catch (err) {
    console.warn("[wa-inbound] Failed to log inbound to app", applicationId, err);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CAREER handler — answers common candidate questions using DB + Gemini.
// ═══════════════════════════════════════════════════════════════════════

const CAREER_INTENTS = {
  STATUS: /(status|update|hear back|how far|progress|any news|feedback)/i,
  JOBS: /(vacan|open (role|position|job)|available (role|job|position)|hiring|careers?)/i,
  PORTAL: /(portal|link|resend|lost|can't (find|open))/i,
  TIMELINE: /(when|how long|timeline|expect|days|weeks)/i,
  WITHDRAW: /(withdraw|cancel|no longer interested)/i,
  GREETING: /^(hi|hello|hey|hola|molo|sawubona|howzit|good (morning|afternoon|day))/i,
};

async function answerCareer(
  applicationId: number,
  candidateFirstName: string | undefined,
  text: string,
): Promise<string> {
  const first = candidateFirstName ?? "there";
  const origin = (process.env.BASE_URL || "").replace(/\/+$/, "");

  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      job: { select: { id: true, title: true, slaResponseDays: true, status: true } },
      stageHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      messages: {
        where: { direction: "OUTBOUND", channel: "EMAIL" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { subject: true, templateKey: true, createdAt: true },
      },
    },
  });

  // 1) Simple keyword-first replies for the most common candidate questions.
  if (CAREER_INTENTS.STATUS.test(text) || CAREER_INTENTS.TIMELINE.test(text)) {
    const stage = String(app?.stageBucket ?? "APPLIED").replace(/_/g, " ").toLowerCase();
    const enteredAt = app?.stageEnteredAt ?? app?.createdAt;
    const daysSince = enteredAt
      ? Math.max(0, Math.floor((Date.now() - new Date(enteredAt).getTime()) / (24 * 3600 * 1000)))
      : null;
    const sla = app?.job?.slaResponseDays ?? 5;
    const portal = app?.accessToken ? `${origin}/candidate/${app.accessToken}` : "";
    return [
      `Hi ${first}, thanks for checking in. Your application for ${app?.job?.title ?? "the role"} is currently at the *${stage}* stage${daysSince != null ? ` (${daysSince} day${daysSince === 1 ? "" : "s"} in this stage)` : ""}.`,
      `Our typical response time is ${sla} working days at each stage.`,
      portal ? `Full details on your portal: ${portal}` : "",
    ].filter(Boolean).join(" ");
  }

  if (CAREER_INTENTS.JOBS.test(text)) {
    const openJobs = await db.job.findMany({
      where: { status: "OPEN", visibility: "PUBLIC" },
      select: { id: true, title: true, location: true, slug: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (openJobs.length === 0) {
      return `Hi ${first}, we don't have any public roles open right now — but check ${origin}/careers regularly, we post new ones every few weeks.`;
    }
    const list = openJobs
      .map((j) => `• ${j.title}${j.location ? ` (${j.location})` : ""} — ${origin}/careers/${j.slug}`)
      .join("\n");
    return `Hi ${first}, current open roles at Square 15:\n${list}\n\nFull list: ${origin}/careers`;
  }

  if (CAREER_INTENTS.PORTAL.test(text)) {
    const portal = app?.accessToken ? `${origin}/candidate/${app.accessToken}` : "";
    return portal
      ? `Hi ${first}, here is your candidate portal link: ${portal}`
      : `Hi ${first}, request a new link here: ${origin}/careers/find-my-application`;
  }

  if (CAREER_INTENTS.WITHDRAW.test(text)) {
    return `Hi ${first}, we're sorry to see you go. To confirm withdrawal, please open your portal and click "Withdraw my application": ${origin}/candidate/${app?.accessToken ?? ""}. If we can help you reconsider, just reply here.`;
  }

  if (CAREER_INTENTS.GREETING.test(text.trim()) && text.trim().length < 30) {
    return `Hi ${first}! I can help with:\n• "How far is my application?"\n• "What jobs are available?"\n• "Send me my portal link"\n\nJust reply with one of those.`;
  }

  // 2) Fall back to Gemini with concrete context so the reply is specific
  //    to this candidate rather than a generic AI answer.
  try {
    const { generateText } = await import("~/server/services/ai/controlledGeneration");
    const { google } = await import("@ai-sdk/google");
    const context = {
      candidateFirstName: first,
      jobTitle: app?.job?.title ?? "unknown",
      currentStage: app?.stageBucket,
      stageEnteredAt: (app?.stageEnteredAt ?? app?.createdAt)?.toISOString(),
      slaResponseDays: app?.job?.slaResponseDays ?? 5,
      recentOutboundEmails: app?.messages.map((m) => ({ subject: m.subject, at: m.createdAt })),
      portalUrl: app?.accessToken ? `${origin}/candidate/${app.accessToken}` : null,
    };
    const prompt = `You are a friendly WhatsApp assistant for Square 15 Facility Solutions Recruitment.
The candidate just messaged: "${text}"

Their live application status (do not invent facts, only use what's here):
${JSON.stringify(context, null, 2)}

Reply in ≤ 60 words, warm and specific. Never promise timelines beyond the SLA above. If unsure, say the recruitment team will follow up on email. Do not include markdown. Do not repeat the candidate's message. Do not add greetings if they already greeted you.`;
    const r = await generateText({
      aiFeature: "whatsapp.reply",
      model: google("gemini-flash-latest"),
      prompt,
      maxTokens: 500,
    });
    const clean = (r.text ?? "").trim();
    if (clean) return clean;
  } catch (err) {
    console.warn("[wa-inbound] Gemini answer failed:", err);
  }

  return `Hi ${first}, thanks for your message. Our recruitment team will follow up shortly. In the meantime you can reply with:\n• "status" to check where you are\n• "jobs" to see open roles\n• "link" for your portal link`;
}

// ═══════════════════════════════════════════════════════════════════════
// MAINTENANCE handler — safe hand-off for now.
// TODO: wire into Maintenance App booking / quote look-up once decided.
// ═══════════════════════════════════════════════════════════════════════

async function answerMaintenance(text: string): Promise<string> {
  return [
    "Hi, thanks for reaching Square 15 Facility Solutions.",
    "A member of our maintenance team will respond to your query shortly.",
    "For an urgent booking, please call 078 380 0308.",
    "",
    "(You may also visit https://square15management.co.za for job status.)",
  ].join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// Public entrypoint — called by the webhook handler for each message.
// ═══════════════════════════════════════════════════════════════════════

export async function handleInboundMessage(m: InboundMessage): Promise<{ replied: boolean; domain: string; reply?: string; error?: string }> {
  if (!m.text || m.type !== "text") {
    return { replied: false, domain: "SKIPPED", error: `unsupported type ${m.type}` };
  }
  const cls = await classifyInbound(m);

  // Non-career messages are handled by the legacy Maintenance App bot on
  // Render. Our webhook has already forwarded the raw Meta payload to it,
  // so we deliberately go silent here to avoid two bots replying to the
  // same customer. If the maintenance bot is ever decommissioned, remove
  // this guard and re-enable answerMaintenance() below.
  if (cls.domain !== "CAREER" || !cls.applicationId) {
    return { replied: false, domain: cls.domain, reply: undefined };
  }

  await logInboundToApplication(cls.applicationId, m);
  const reply = await answerCareer(cls.applicationId, cls.candidateFirstName, m.text);
  const r = await sendWhatsAppFreeform(m.from, reply);
  return { replied: r.ok, domain: cls.domain, reply, error: r.error };
}
