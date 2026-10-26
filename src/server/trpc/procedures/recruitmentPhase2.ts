/**
 * Phase 2 additions:
 *  - Interviewer calibration analytics.
 *  - Scorecard-stage helpers if needed later.
 */

import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import { assertRecruiter } from "~/server/services/recruitment/atsHelpers";

export const getInterviewerCalibration = baseProcedure
  .input(
    z.object({
      token: z.string(),
      fromDate: z.date().optional(),
      toDate: z.date().optional(),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);

    const where: any = {
      submittedAt: { not: null },
    };
    if (input.fromDate) where.submittedAt = { gte: input.fromDate };
    if (input.toDate)
      where.submittedAt = { ...(where.submittedAt ?? {}), lte: input.toDate };

    // Structured-interview question scores (fine-grained 1–5, weighted).
    const qScores = await db.interviewQuestionScore.findMany({
      where: input.fromDate
        ? { createdAt: { gte: input.fromDate, ...(input.toDate ? { lte: input.toDate } : {}) } }
        : input.toDate
          ? { createdAt: { lte: input.toDate } }
          : {},
      include: {
        interviewer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Scorecard-level ratings (overall out of 5).
    const scRatings = await db.scorecardSubmission.findMany({
      where,
      select: {
        interviewerId: true,
        overallRating: true,
        recommendation: true,
        submittedAt: true,
        applicationId: true,
        interviewer: { select: { firstName: true, lastName: true } },
      },
    });

    type Bucket = {
      interviewerId: number;
      name: string;
      questionScores: number[];
      scorecardRatings: number[];
      strongHires: number;
      strongNoHires: number;
      applications: Set<number>;
    };
    const bucket = new Map<number, Bucket>();
    const upsert = (
      id: number,
      name: string,
    ): Bucket => {
      const existing = bucket.get(id);
      if (existing) return existing;
      const b: Bucket = {
        interviewerId: id,
        name,
        questionScores: [],
        scorecardRatings: [],
        strongHires: 0,
        strongNoHires: 0,
        applications: new Set<number>(),
      };
      bucket.set(id, b);
      return b;
    };

    for (const q of qScores) {
      const b = upsert(
        q.interviewer.id,
        `${q.interviewer.firstName} ${q.interviewer.lastName}`,
      );
      b.questionScores.push(q.score);
      b.applications.add(q.applicationId);
    }
    for (const s of scRatings) {
      const iName = s.interviewer
        ? `${s.interviewer.firstName} ${s.interviewer.lastName}`
        : `User ${s.interviewerId}`;
      const b = upsert(s.interviewerId, iName);
      if (typeof s.overallRating === "number") b.scorecardRatings.push(s.overallRating);
      if (s.recommendation === "STRONG_HIRE") b.strongHires++;
      if (s.recommendation === "STRONG_NO_HIRE") b.strongNoHires++;
      b.applications.add(s.applicationId);
    }

    const mean = (arr: number[]) =>
      arr.length === 0 ? null : arr.reduce((s, x) => s + x, 0) / arr.length;
    const stdev = (arr: number[]) => {
      if (arr.length < 2) return null;
      const m = mean(arr) ?? 0;
      const v = arr.reduce((s, x) => s + Math.pow(x - m, 2), 0) / arr.length;
      return Math.sqrt(v);
    };

    const rows = Array.from(bucket.values()).map((b) => {
      const qMean = mean(b.questionScores);
      const qStd = stdev(b.questionScores);
      const scMean = mean(b.scorecardRatings);
      const scStd = stdev(b.scorecardRatings);
      return {
        interviewerId: b.interviewerId,
        name: b.name,
        candidatesReviewed: b.applications.size,
        questionScoresCount: b.questionScores.length,
        avgQuestionScore: qMean != null ? Math.round(qMean * 100) / 100 : null,
        stdevQuestionScore: qStd != null ? Math.round(qStd * 100) / 100 : null,
        scorecardSubmissionsCount: b.scorecardRatings.length,
        avgScorecardRating: scMean != null ? Math.round(scMean * 100) / 100 : null,
        stdevScorecardRating: scStd != null ? Math.round(scStd * 100) / 100 : null,
        strongHires: b.strongHires,
        strongNoHires: b.strongNoHires,
      };
    });
    rows.sort(
      (a, b) => b.candidatesReviewed - a.candidatesReviewed,
    );

    // Team benchmarks — for outlier flagging.
    const teamAvgQuestion =
      rows.length > 0
        ? Math.round(
            (rows
              .filter((r) => r.avgQuestionScore != null)
              .reduce((s, r) => s + (r.avgQuestionScore ?? 0), 0) /
              Math.max(1, rows.filter((r) => r.avgQuestionScore != null).length)) *
              100,
          ) / 100
        : null;
    const teamAvgScorecard =
      rows.length > 0
        ? Math.round(
            (rows
              .filter((r) => r.avgScorecardRating != null)
              .reduce((s, r) => s + (r.avgScorecardRating ?? 0), 0) /
              Math.max(1, rows.filter((r) => r.avgScorecardRating != null).length)) *
              100,
          ) / 100
        : null;

    return {
      rows: rows.map((r) => ({
        ...r,
        outlierQuestion:
          teamAvgQuestion != null &&
          r.avgQuestionScore != null &&
          Math.abs(r.avgQuestionScore - teamAvgQuestion) > 0.8,
        outlierScorecard:
          teamAvgScorecard != null &&
          r.avgScorecardRating != null &&
          Math.abs(r.avgScorecardRating - teamAvgScorecard) > 0.8,
      })),
      teamAvgQuestion,
      teamAvgScorecard,
    };
  });
