// Reusable OHS AI helper. Returns AI-generated risk items and mitigations
// for an activity, plus an executive summary. Built on Vercel AI SDK + Gemini
// to match the existing codebase pattern (see suggestArtisanForJob.ts).
import { z } from "zod";
import { generateObject } from "~/server/services/ai/controlledGeneration";
import { google } from "@ai-sdk/google";

const RiskItemSchema = z.object({
  hazard: z.string().describe("The specific hazard, in plain language"),
  potentialHarm: z.string().describe("Who or what may be harmed and how"),
  inherentLikelihood: z.number().min(1).max(5).describe("Likelihood before controls (1=rare, 5=almost certain)"),
  inherentSeverity: z.number().min(1).max(5).describe("Severity before controls (1=negligible, 5=catastrophic)"),
  controls: z.string().describe("Hierarchy of control measures: elimination, substitution, engineering, administrative, PPE — concrete and actionable"),
  responsiblePerson: z.string().describe("Recommended responsible role (e.g. Site Supervisor, Artisan, Safety Officer)"),
  residualLikelihood: z.number().min(1).max(5).describe("Likelihood after controls"),
  residualSeverity: z.number().min(1).max(5).describe("Severity after controls"),
  ppeRequired: z.array(z.string()).describe("Specific PPE items required"),
  trainingRequired: z.array(z.string()).describe("Training / competencies required"),
  legalReferences: z.array(z.string()).describe("Relevant SA legal references — OHS Act 85 of 1993 sections, Construction Regs 2014, GSR, EMR, etc."),
});

export type AiRiskItem = z.infer<typeof RiskItemSchema>;

const RiskAnalysisSchema = z.object({
  summary: z.string().describe("Executive summary of the activity's safety profile in 2-4 sentences"),
  overallRisk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).describe("Overall residual risk after controls"),
  mandatoryPermits: z.array(z.string()).describe("Permits-to-work that must be in place (hot work, working at heights, confined space, electrical isolation, etc.)"),
  legalAppointments: z.array(z.string()).describe("Legally required appointments (e.g. Construction Supervisor 8(1), First Aider, Fire Equipment Inspector, Fall Protection Planner)"),
  emergencyConsiderations: z.array(z.string()).describe("Emergency / evacuation considerations specific to this activity"),
  items: z.array(RiskItemSchema).min(3).describe("Identified risk items, sorted from highest residual risk to lowest"),
});

export type AiRiskAnalysis = z.infer<typeof RiskAnalysisSchema>;

export async function analyzeActivityRisks(input: {
  activity: string;
  location?: string;
  industryContext?: string;
  knownHazards?: string[];
}): Promise<AiRiskAnalysis> {
  const model = google("gemini-3.6-flash");

  const prompt = `You are a senior Occupational Health & Safety practitioner certified under SACPCMP and registered with the South African Department of Employment and Labour. You write risk assessments that comply with the OHS Act 85 of 1993, the Construction Regulations 2014, the General Safety Regulations, the Environmental Regulations for Workplaces, the Driven Machinery Regulations and the Hazardous Chemical Substances Regulations.

Produce a thorough, site-grade Hazard Identification & Risk Assessment (HIRA) for the following activity. Identify ALL reasonably foreseeable hazards (a typical activity has 6-15 distinct hazard items). Be specific — vague items like "general site hazards" are unacceptable. Apply the hierarchy of control properly. Cite the most relevant SA legal references for each item.

Activity: ${input.activity}
${input.location ? `Location: ${input.location}` : ""}
${input.industryContext ? `Industry context: ${input.industryContext}` : "Industry context: Property maintenance / facilities management / minor construction in South Africa."}
${input.knownHazards?.length ? `Known hazards already identified by the user (expand on these and add more): ${input.knownHazards.join(", ")}` : ""}

Use a 5x5 likelihood × severity matrix (1-5 each). For each item provide BOTH inherent and residual ratings. Residual ratings must be lower than inherent unless controls cannot reduce one of the dimensions.

Return strictly the requested JSON shape.`;

  const { object } = await generateObject({
    aiFeature: "ohs.activityRisks",
    model,
    schema: RiskAnalysisSchema,
    prompt,
  });

  return object;
}

const IncidentClassificationSchema = z.object({
  classification: z.string().describe("Suggested incident type — one of: NEAR_MISS, FIRST_AID, MEDICAL_TREATMENT, LOST_TIME_INJURY, FATALITY, PROPERTY_DAMAGE, ENVIRONMENTAL, DANGEROUS_OCCURRENCE, OCCUPATIONAL_DISEASE, OTHER"),
  severity: z.string().describe("Suggested severity — one of: LOW, MEDIUM, HIGH, CRITICAL"),
  reportableToDol: z.boolean().describe("Must this be reported to the SA Department of Employment & Labour under Sec 24 of the OHS Act?"),
  rootCauseHypothesis: z.string().describe("Most likely root cause based on the description"),
  immediateActions: z.array(z.string()).describe("Recommended immediate actions to take right now"),
  correctiveActions: z.array(
    z.object({
      action: z.string().describe("Specific corrective action"),
      responsibleRole: z.string().describe("Role that should own this"),
      targetDays: z.number().describe("Recommended days until completion"),
    })
  ).describe("Recommended corrective actions"),
  learnings: z.string().describe("Key learnings to share with the team (toolbox-talk style)"),
  legalConsiderations: z.array(z.string()).describe("Legal considerations and references"),
});

export type AiIncidentInsights = z.infer<typeof IncidentClassificationSchema>;

export async function analyzeIncident(input: {
  description: string;
  location?: string;
  injuredPersonRole?: string;
  immediateActions?: string;
}): Promise<AiIncidentInsights> {
  const model = google("gemini-3.6-flash");

  const prompt = `You are a senior OHS investigator in South Africa. Analyse the following incident report and produce structured insights compliant with the OHS Act 85 of 1993 (especially Sec 24 reportability) and good investigation practice (TapRoot / 5-Why / Bowtie style).

Incident description:
${input.description}

${input.location ? `Location: ${input.location}` : ""}
${input.injuredPersonRole ? `Affected person role: ${input.injuredPersonRole}` : ""}
${input.immediateActions ? `Immediate actions already taken: ${input.immediateActions}` : ""}

Be precise about Sec 24 reportability. Default to reportable=true when in doubt for: any fatality, anyone unable to work for 14+ days, loss of consciousness due to lack of oxygen / fumes / poisoning, injury requiring removal to hospital, dangerous occurrences (collapse, fire, explosion), uncontrolled release of hazardous substances.`;

  const { object } = await generateObject({
    aiFeature: "ohs.incidentAnalysis",
    model,
    schema: IncidentClassificationSchema,
    prompt,
  });

  return object;
}

const ToolboxTalkSchema = z.object({
  title: z.string(),
  topic: z.string(),
  keyMessages: z.array(z.string()).min(3).describe("3-6 key safety messages, plain English"),
  doList: z.array(z.string()).describe("Things workers MUST do"),
  dontList: z.array(z.string()).describe("Things workers MUST NOT do"),
  ppeRequired: z.array(z.string()),
  emergencyResponse: z.string().describe("What to do if it goes wrong"),
  legalReferences: z.array(z.string()),
  fullScript: z.string().describe("A 3-5 minute presenter-friendly script in markdown the supervisor can read aloud"),
});

export type AiToolboxTalk = z.infer<typeof ToolboxTalkSchema>;

export async function generateToolboxTalk(input: {
  topic: string;
  context?: string;
}): Promise<AiToolboxTalk> {
  const model = google("gemini-3.6-flash");

  const prompt = `You are a South African OHS practitioner producing a toolbox talk. Tone: practical, plain English, suitable for reading aloud to a multilingual workforce. Length: 3-5 minutes when read aloud.

Topic: ${input.topic}
${input.context ? `Context: ${input.context}` : ""}

Cite OHS Act 85 of 1993 / Construction Regs 2014 references where relevant. Avoid jargon. End the script with a 3-question informal check.`;

  const { object } = await generateObject({
    aiFeature: "ohs.toolboxTalk",
    model,
    schema: ToolboxTalkSchema,
    prompt,
  });

  return object;
}

export function levelFromScore(likelihood: number, severity: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const score = likelihood * severity;
  if (score >= 20) return "CRITICAL";
  if (score >= 12) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

// ---------------------------------------------------------------------------
// AI-powered Site-Specific Risk Assessment (SSRA) question generator.
// Used by the artisan "Start a Job" wizard so the yes/no checklist is
// tailored to the exact job (service type + task description + address)
// rather than a generic static template. Each question carries a
// `safeAnswer`, a `criticality` and — critically — an `onUnsafe` risk-item
// payload so we can (a) BLOCK job start when an essential PPE / competency
// question is answered unsafely, and (b) auto-populate an OHS risk item
// when a WARN question is answered unsafely.
// ---------------------------------------------------------------------------

const SsraQuestionSchema = z.object({
  id: z.string().describe("Stable snake_case identifier unique within this SSRA set"),
  prompt: z.string().describe("The yes/no question presented to the artisan, in plain English"),
  category: z.enum(["PPE", "COMPETENCY", "PERMIT", "HAZARD", "CONTROL", "ENVIRONMENT"]),
  safeAnswer: z.enum(["yes", "no"]).describe("The answer the artisan must give for it to be safe to proceed"),
  criticality: z.enum(["BLOCK", "WARN"]).describe("BLOCK means work MUST NOT start until the safe answer is achieved (e.g. essential PPE, isolation permit). WARN means proceed but log a risk item."),
  rationale: z.string().describe("Short reason why this question matters for this specific job"),
  onUnsafe: RiskItemSchema.describe("The risk item to add to the SSRA if this question is answered unsafely"),
});

export type AiSsraQuestion = z.infer<typeof SsraQuestionSchema>;

const SsraQuestionSetSchema = z.object({
  jobSummary: z.string().describe("One-sentence summary of the specific job being risk-assessed"),
  overallRiskProfile: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  questions: z
    .array(SsraQuestionSchema)
    .min(5)
    .max(12)
    .describe("Job-specific yes/no safety questions. MUST include at least one BLOCK question covering essential PPE for the service type."),
});

export type AiSsraQuestionSet = z.infer<typeof SsraQuestionSetSchema>;

export async function generateSsraQuestionsForJob(input: {
  serviceType: string;
  description: string;
  location?: string;
  customerName?: string;
}): Promise<AiSsraQuestionSet> {
  const model = google("gemini-3.6-flash");

  const prompt = `You are a senior South African OHS practitioner. An artisan is about to start a specific job. Generate a Site-Specific Risk Assessment (SSRA) checklist as 5-12 yes/no questions that are PARTICULAR to this job — not generic. Questions must reference the exact service type, task and hazards a competent artisan would face on THIS job.

Rules:
1. For each question set 'safeAnswer' to the answer required for it to be safe to proceed ("yes" or "no").
2. Mark 'criticality' = "BLOCK" for essential PPE, essential permits (e.g. hot-work, LOTO isolation, confined-space entry, working-at-heights fall arrest), essential competencies (e.g. wireman's licence for electrical, gas-safe registration for gas). BLOCK questions must ALWAYS include a PPE question covering the mandatory PPE for the service type.
3. Mark 'criticality' = "WARN" for good-practice items that should be flagged but not stop work.
4. Populate 'onUnsafe' as a full HIRA risk item that would apply if the question is answered unsafely — include hazard, potentialHarm, hierarchy-of-control 'controls', inherent + residual 5x5 ratings, PPE, training and SA legal references (OHS Act 85 of 1993 / Construction Regs 2014 / GSR / EMR / HCSR etc.).
5. Give each question a stable snake_case 'id'.

Job details:
- Service type: ${input.serviceType}
- Task description: ${input.description}
${input.location ? `- Location: ${input.location}` : ""}
${input.customerName ? `- Customer: ${input.customerName}` : ""}

Return strictly the requested JSON shape.`;

  const { object } = await generateObject({
    aiFeature: "ohs.ssraQuestions",
    model,
    schema: SsraQuestionSetSchema,
    prompt,
  });

  return object;
}
