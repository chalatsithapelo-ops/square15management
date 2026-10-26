import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { IQ_QUESTIONS, EQ_QUESTIONS, MBTI_QUESTIONS, BIG_FIVE_QUESTIONS, INTERVIEW_QUESTIONS_TEMPLATE } from "./assessmentQuestions";

export function assertOpenCandidate(app: { deletedAt: Date | null; accessTokenExpiresAt: Date | null; stageBucket: string } | null) {
  if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
  if (app.accessTokenExpiresAt && app.accessTokenExpiresAt <= new Date()) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired" });
  if (["WITHDRAWN", "REJECTED", "HIRED"].includes(app.stageBucket)) throw new TRPCError({ code: "BAD_REQUEST", message: "Application is closed" });
}

export async function openCandidate(accessToken: string) {
  const app = await db.application.findUnique({ where: { accessToken } });
  assertOpenCandidate(app);
  return app!;
}

export async function requireAssessmentCamera(applicationId: number) {
  const session = await db.assessmentSession.findFirst({
    where: { applicationId, finishedAt: null, pausedAt: null, webcamGranted: true },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  const snapshot = session && await db.assessmentSnapshot.findFirst({
    where: { sessionId: session.id, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
    select: { id: true },
  });
  if (!snapshot) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Camera verification is required. Enable your camera and wait for a successful capture before continuing." });
}

export function shuffle<T>(items: readonly T[], key: string): T[] {
  const result = [...items];
  let seed = 0;
  for (const char of key) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((seed / 0x100000000) * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export type PortalQuestion = { id: string; text: string; options?: { id: number | string; text: string }[] };
export function publicQuestions(type: string, token: string, legacy: boolean): PortalQuestion[] {
  let questions: PortalQuestion[];
  switch (type) {
    case "IQ": questions = IQ_QUESTIONS.map(q => ({ id: String(q.id), text: q.question, options: q.options.map((text, id) => ({ id, text })) })); break;
    case "EQ": questions = EQ_QUESTIONS.map(q => ({ id: String(q.id), text: q.scenario, options: shuffle(q.options.map((o, id) => ({ id, text: o.text })), `${token}:${q.id}:eq`) })); break;
    case "MBTI": questions = MBTI_QUESTIONS.map(q => ({ id: String(q.id), text: q.question, options: [{ id: "A", text: q.optionA.text }, { id: "B", text: q.optionB.text }] })); break;
    case "BIG_FIVE": questions = BIG_FIVE_QUESTIONS.map(q => ({ id: String(q.id), text: q.statement, options: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"].map((text, id) => ({ id, text })) })); break;
    case "BEHAVIOUR": questions = INTERVIEW_QUESTIONS_TEMPLATE.map((q, id) => ({ id: String(id), text: q.question })); break;
    default: return [];
  }
  if (legacy) return questions;
  return shuffle(questions, `${token}:${type}:questions:v1`).map(q => ({ ...q, options: q.options && type !== "BIG_FIVE" ? shuffle(q.options, `${token}:${type}:${q.id}:options:v1`) : q.options }));
}

export function validateResponses(questions: PortalQuestion[], responses: Record<string, unknown>, complete = false) {
  if (complete && questions.some(q => responses[q.id] === undefined)) throw new TRPCError({ code: "BAD_REQUEST", message: "Please answer every question" });
  for (const [id, answer] of Object.entries(responses)) {
    const question = questions.find(q => q.id === id);
    if (!question || (question.options ? !question.options.some(o => o.id === answer) : typeof answer !== "string" || answer.length > 20000)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid question or answer" });
  }
}

export function candidateWorkSampleInstructions(
  accessToken: string,
  task: { id: number; title: string; instructions: string },
): string {
  if (!/\bquotation\b/i.test(task.title)) return task.instructions;
  let seed = 0;
  for (const char of `${accessToken}:${task.id}:quote-variant-v1`) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const pick = (values: readonly number[]) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return values[Math.floor((seed / 0x100000000) * values.length)]!;
  };
  const hourlyRate = pick([320, 350, 380, 410, 440, 470, 500, 530, 560, 590, 620, 650, 680, 710, 740]);
  const overhead = pick([8, 10, 12, 14, 16, 18, 20]);
  const materialAdjustment = pick([-8, -4, 0, 3, 6, 9, 12]);
  const deposit = pick([20, 25, 30, 35, 40, 45, 50]);
  const validity = pick([14, 21, 30]);
  return `${task.instructions}\n\nCANDIDATE-SPECIFIC QUOTATION INPUTS (use these exact assumptions; they vary by candidate):\n- Labour rate: R${hourlyRate} per person-hour.\n- Overhead/markup: ${overhead}% of direct materials and labour.\n- Material supplier adjustment: ${materialAdjustment >= 0 ? "+" : ""}${materialAdjustment}% against your stated material prices.\n- Deposit requested: ${deposit}% of the total including VAT.\n- Quotation validity: ${validity} calendar days.\nShow these inputs and use them consistently in the calculations.`;
}