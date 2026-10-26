import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { assertRecruiter } from "~/server/services/recruitment/atsHelpers";

const questionInput = z.object({
  questionText: z.string().min(3),
  questionType: z.enum(["YES_NO", "NUMBER", "SELECT"]),
  required: z.boolean().default(true),
  knockoutEnabled: z.boolean().default(true),
  expectedYesNo: z.enum(["YES", "NO"]).optional(),
  minNumber: z.number().optional(),
  maxNumber: z.number().optional(),
  acceptableOptions: z.array(z.string()).default([]),
  options: z.array(z.string()).default([]),
  displayOrder: z.number().default(0),
});

export const createScreeningQuestion = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number(), question: questionInput }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.screeningQuestion.create({
      data: { jobId: input.jobId, ...input.question },
    });
  });

export const updateScreeningQuestion = baseProcedure
  .input(z.object({ token: z.string(), id: z.number(), question: questionInput.partial() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.screeningQuestion.update({
      where: { id: input.id },
      data: input.question,
    });
  });

export const deleteScreeningQuestion = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    await db.screeningQuestion.delete({ where: { id: input.id } });
    return { success: true };
  });

export const listScreeningQuestionsForJob = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number() }))
  .query(async ({ input }) => {
    await authenticateUser(input.token);
    return db.screeningQuestion.findMany({
      where: { jobId: input.jobId },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  });

// Candidate-side (no auth) — by job slug. Do not expose knockout criteria.
export const getPublicScreeningQuestions = baseProcedure
  .input(z.object({ jobSlug: z.string() }))
  .query(async ({ input }) => {
    const job = await db.job.findFirst({
      where: { slug: input.jobSlug, status: "OPEN", visibility: "PUBLIC" },
      select: { id: true },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    const questions = await db.screeningQuestion.findMany({
      where: { jobId: job.id },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
    return questions.map((question) => ({
      id: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      required: question.required,
      options: question.options,
    }));
  });

/** Pure minimum-requirement evaluator; every configured question yields a result. */
export function evaluateScreening(
  questions: {
    id: number;
    questionType: string;
    required: boolean;
    knockoutEnabled: boolean;
    expectedYesNo: string | null;
    minNumber: number | null;
    maxNumber: number | null;
    acceptableOptions: string[];
    options?: string[];
  }[],
  answers: { questionId: number; answerText?: string | null; answerNumber?: number | null }[],
): {
  passed: boolean;
  results: { questionId: number; passed: boolean; answerText: string | null; answerNumber: number | null }[];
  failedIds: number[];
} {
  const results: { questionId: number; passed: boolean; answerText: string | null; answerNumber: number | null }[] = [];
  const failedIds: number[] = [];

  for (const question of questions) {
    const answer = answers.find((candidate) => candidate.questionId === question.id);
    const answerText = answer?.answerText ?? null;
    const answerNumber = answer?.answerNumber ?? null;
    const hasAnswer = question.questionType === "NUMBER"
      ? answerNumber !== null && Number.isFinite(answerNumber)
      : typeof answerText === "string" && answerText.trim().length > 0;
    let passed = true;

    if (question.required && !hasAnswer) {
      passed = false;
    } else if (question.knockoutEnabled && hasAnswer) {
      if (question.questionType === "YES_NO") {
        const value = (answerText ?? "").trim().toUpperCase();
        passed = ["YES", "NO"].includes(value) && (!question.expectedYesNo || value === question.expectedYesNo);
      } else if (question.questionType === "NUMBER") {
        if (answerNumber === null || !Number.isFinite(answerNumber)) {
          passed = false;
        } else {
          if (question.minNumber !== null && answerNumber < question.minNumber) passed = false;
          if (question.maxNumber !== null && answerNumber > question.maxNumber) passed = false;
        }
      } else if (question.questionType === "SELECT") {
        const allowed = question.acceptableOptions.length > 0
          ? question.acceptableOptions
          : (question.options ?? []);
        passed = allowed.length === 0 || allowed.includes(answerText ?? "");
      }
    }

    results.push({ questionId: question.id, passed, answerText, answerNumber });
    if (!passed) failedIds.push(question.id);
  }

  return { passed: failedIds.length === 0, results, failedIds };
}
