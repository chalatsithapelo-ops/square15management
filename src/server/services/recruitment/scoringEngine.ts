/**
 * AI Scoring Engine for Artisan Recruitment Pipeline.
 * 
 * Scores IQ, EQ, MBTI, Big Five results and interview responses.
 * Uses Gemini AI for interview answer evaluation and overall candidate summary.
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "~/server/db";
import {
  IQ_QUESTIONS,
  EQ_QUESTIONS,
  BIG_FIVE_QUESTIONS,
  MBTI_QUESTIONS,
  type IQQuestion,
} from "./assessmentQuestions";

const model = google("gemini-2.0-flash");

// ═══════════════════════════════════════════════════════════════════════
// IQ Scoring — percentage correct, weighted by difficulty
// ═══════════════════════════════════════════════════════════════════════

export function scoreIQ(responses: Record<number, number>): { score: number; results: Record<string, any> } {
  let totalWeight = 0;
  let earnedWeight = 0;
  const categoryScores: Record<string, { correct: number; total: number }> = {};

  for (const q of IQ_QUESTIONS) {
    const weight = q.difficulty; // 1, 2, or 3
    totalWeight += weight;

    if (!categoryScores[q.category]) categoryScores[q.category] = { correct: 0, total: 0 };
    categoryScores[q.category].total++;

    if (responses[q.id] === q.correctIndex) {
      earnedWeight += weight;
      categoryScores[q.category].correct++;
    }
  }

  const score = Math.round((earnedWeight / totalWeight) * 100);
  return {
    score,
    results: {
      rawScore: earnedWeight,
      maxScore: totalWeight,
      percentage: score,
      categoryBreakdown: categoryScores,
      classification: score >= 80 ? "Superior" : score >= 60 ? "Above Average" : score >= 40 ? "Average" : score >= 20 ? "Below Average" : "Low",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// EQ Scoring — average of option scores (1-4) → normalized to 0-100
// ═══════════════════════════════════════════════════════════════════════

export function scoreEQ(responses: Record<number, number>): { score: number; results: Record<string, any> } {
  let totalScore = 0;
  let answered = 0;
  const categoryScores: Record<string, { total: number; count: number }> = {};

  for (const q of EQ_QUESTIONS) {
    const selectedIndex = responses[q.id];
    if (selectedIndex === undefined || selectedIndex === null) continue;

    const optionScore = q.options[selectedIndex]?.score || 1;
    totalScore += optionScore;
    answered++;

    if (!categoryScores[q.category]) categoryScores[q.category] = { total: 0, count: 0 };
    categoryScores[q.category].total += optionScore;
    categoryScores[q.category].count++;
  }

  const avgScore = answered > 0 ? totalScore / answered : 0;
  const score = Math.round(((avgScore - 1) / 3) * 100); // normalize 1-4 → 0-100

  const categoryBreakdown: Record<string, number> = {};
  for (const [cat, data] of Object.entries(categoryScores)) {
    categoryBreakdown[cat] = Math.round(((data.total / data.count - 1) / 3) * 100);
  }

  return {
    score,
    results: {
      averageScore: avgScore,
      percentage: score,
      categoryBreakdown,
      classification: score >= 80 ? "Exceptional" : score >= 60 ? "Strong" : score >= 40 ? "Moderate" : score >= 20 ? "Developing" : "Low",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MBTI Scoring — tally poles per dimension → 4-letter type
// ═══════════════════════════════════════════════════════════════════════

export function scoreMBTI(responses: Record<number, "A" | "B">): { score: number; results: Record<string, any> } {
  const tallies: Record<string, number> = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };

  for (const q of MBTI_QUESTIONS) {
    const choice = responses[q.id];
    if (!choice) continue;
    const pole = choice === "A" ? q.optionA.pole : q.optionB.pole;
    tallies[pole]++;
  }

  const type = [
    tallies.E >= tallies.I ? "E" : "I",
    tallies.S >= tallies.N ? "S" : "N",
    tallies.T >= tallies.F ? "T" : "F",
    tallies.J >= tallies.P ? "J" : "P",
  ].join("");

  // Strength percentages
  const strengths = {
    EI: Math.round((tallies[type[0]] / (tallies.E + tallies.I || 1)) * 100),
    SN: Math.round((tallies[type[1]] / (tallies.S + tallies.N || 1)) * 100),
    TF: Math.round((tallies[type[2]] / (tallies.T + tallies.F || 1)) * 100),
    JP: Math.round((tallies[type[3]] / (tallies.J + tallies.P || 1)) * 100),
  };

  return {
    score: 0, // MBTI isn't scored as good/bad
    results: {
      type,
      tallies,
      dimensionStrengths: strengths,
      description: getMBTIDescription(type),
    },
  };
}

function getMBTIDescription(type: string): string {
  const descriptions: Record<string, string> = {
    ISTJ: "The Inspector — Dependable, thorough, responsible. Values tradition and procedures.",
    ISFJ: "The Protector — Supportive, reliable, patient. Dedicated to getting things right.",
    INFJ: "The Counselor — Insightful, principled, compassionate. Driven by purpose.",
    INTJ: "The Mastermind — Strategic, independent, determined. Always improving systems.",
    ISTP: "The Craftsman — Practical, observant, analytical. Excellent with tools and hands-on work.",
    ISFP: "The Composer — Gentle, sensitive, helpful. Takes pride in quality workmanship.",
    INFP: "The Healer — Idealistic, empathetic, creative. Values authenticity.",
    INTP: "The Architect — Logical, innovative, curious. Enjoys solving complex problems.",
    ESTP: "The Dynamo — Energetic, pragmatic, observant. Thrives in fast-paced environments.",
    ESFP: "The Performer — Spontaneous, energetic, friendly. Makes work fun for everyone.",
    ENFP: "The Champion — Enthusiastic, creative, sociable. Inspires others with ideas.",
    ENTP: "The Visionary — Quick-thinking, enterprising, outspoken. Always finding better ways.",
    ESTJ: "The Supervisor — Organised, logical, assertive. Natural leader who gets things done.",
    ESFJ: "The Provider — Caring, social, traditional. Values teamwork and collaboration.",
    ENFJ: "The Teacher — Charismatic, empathetic, organised. Brings out the best in others.",
    ENTJ: "The Commander — Bold, strategic, decisive. Born to lead and organise.",
  };
  return descriptions[type] || `${type} — A unique personality combination.`;
}

// ═══════════════════════════════════════════════════════════════════════
// Big Five (OCEAN) Scoring — Likert 1-5, reversed items, per-factor avg
// ═══════════════════════════════════════════════════════════════════════

export function scoreBigFive(responses: Record<number, number>): { score: number; results: Record<string, any> } {
  const factorTotals: Record<string, { sum: number; count: number }> = {
    O: { sum: 0, count: 0 }, C: { sum: 0, count: 0 }, E: { sum: 0, count: 0 },
    A: { sum: 0, count: 0 }, N: { sum: 0, count: 0 },
  };

  const factorLabels: Record<string, string> = {
    O: "Openness", C: "Conscientiousness", E: "Extraversion", A: "Agreeableness", N: "Neuroticism",
  };

  for (const q of BIG_FIVE_QUESTIONS) {
    let val = responses[q.id];
    if (val === undefined || val === null) continue;

    // Likert is 0-indexed from frontend (0=Strongly Disagree … 4=Strongly Agree) → convert to 1-5
    val = val + 1;

    // Reverse-scored items: 1↔5, 2↔4
    if (q.reversed) val = 6 - val;

    factorTotals[q.factor].sum += val;
    factorTotals[q.factor].count++;
  }

  const factorScores: Record<string, number> = {};
  const factorPercentages: Record<string, number> = {};

  for (const [f, data] of Object.entries(factorTotals)) {
    const avg = data.count > 0 ? data.sum / data.count : 3;
    factorScores[factorLabels[f]] = Math.round(avg * 10) / 10;
    factorPercentages[factorLabels[f]] = Math.round(((avg - 1) / 4) * 100);
  }

  // Composite score: weight desirable traits for artisans
  // High C (conscientiousness) and A (agreeableness) are most valued
  // Low N (neuroticism) is desirable → invert it
  const composite = Math.round(
    (factorPercentages.Conscientiousness * 0.30 +
     factorPercentages.Agreeableness * 0.25 +
     (100 - factorPercentages.Neuroticism) * 0.20 +
     factorPercentages.Openness * 0.15 +
     factorPercentages.Extraversion * 0.10)
  );

  return {
    score: composite,
    results: {
      factorScores,
      factorPercentages,
      composite,
      topTraits: Object.entries(factorPercentages)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([k]) => k),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// AI Interview Answer Scoring
// ═══════════════════════════════════════════════════════════════════════

export async function scoreInterviewAnswer(
  question: string,
  answer: string,
  dimension: string,
  trade: string
): Promise<{ score: number; analysis: string; dimensions: Record<string, number> }> {
  const { text } = await generateText({
    model,
    system: `You are an expert HR assessor for a property management company evaluating artisan candidates.
Score the candidate's answer on a 0-10 scale across these dimensions: professionalism, problem_solving, communication, reliability, integrity, trade_knowledge.
Consider that this candidate is applying as a ${trade} specialist.
Be fair but rigorous — this affects hiring decisions.

Respond ONLY with valid JSON:
{
  "score": <0-10 overall>,
  "dimensions": { "professionalism": <0-10>, "problem_solving": <0-10>, "communication": <0-10>, "reliability": <0-10>, "integrity": <0-10>, "trade_knowledge": <0-10> },
  "analysis": "<2-3 sentence assessment of the answer>"
}`,
    prompt: `Question (dimension: ${dimension}): "${question}"\n\nCandidate's Answer: "${answer}"`,
  });

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      score: Math.min(10, Math.max(0, parsed.score || 0)),
      analysis: parsed.analysis || "",
      dimensions: parsed.dimensions || {},
    };
  } catch {
    return { score: 5, analysis: "Unable to parse AI response", dimensions: {} };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Overall Candidate Scoring — combines all assessments
// ═══════════════════════════════════════════════════════════════════════

export async function computeOverallScore(applicationId: number): Promise<{
  overallScore: number;
  summary: string;
  strengths: string;
  redFlags: string;
}> {
  const app = await db.artisanApplication.findUnique({
    where: { id: applicationId },
    include: {
      assessments: true,
      interviewResponses: true,
    },
  });

  if (!app) throw new Error("Application not found");

  const scores: Record<string, number | null> = { IQ: null, EQ: null, BIG_FIVE: null, INTERVIEW: null };
  const assessmentDetails: Record<string, any> = {};

  for (const a of app.assessments) {
    if (a.score !== null) {
      scores[a.type] = a.score;
      assessmentDetails[a.type] = a.results;
    }
  }

  // Interview average
  if (app.interviewResponses.length > 0) {
    const interviewScores = app.interviewResponses.filter(r => r.aiScore !== null);
    if (interviewScores.length > 0) {
      scores.INTERVIEW = Math.round(
        (interviewScores.reduce((sum, r) => sum + (r.aiScore || 0), 0) / interviewScores.length) * 10
      );
    }
  }

  // Weighted composite: IQ 15%, EQ 25%, Big Five 25%, Interview 35%
  const weights = { IQ: 0.15, EQ: 0.25, BIG_FIVE: 0.25, INTERVIEW: 0.35 };
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (scores[key] !== null) {
      weightedSum += scores[key]! * weight;
      totalWeight += weight;
    }
  }

  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // Generate AI summary
  const mbtiAssessment = app.assessments.find(a => a.type === "MBTI");
  const mbtiType = mbtiAssessment?.results ? (mbtiAssessment.results as any).type : "Unknown";

  const { text: aiSummary } = await generateText({
    model,
    system: `You are an expert HR advisor for a property management company. Summarize this artisan candidate concisely.`,
    prompt: `Candidate: ${app.firstName} ${app.lastName}
Trade: ${app.primaryTrade} (${app.yearsExperience} years experience)
IQ Score: ${scores.IQ !== null ? scores.IQ + "/100" : "Not completed"}
EQ Score: ${scores.EQ !== null ? scores.EQ + "/100" : "Not completed"}
MBTI Type: ${mbtiType}
Big Five Composite: ${scores.BIG_FIVE !== null ? scores.BIG_FIVE + "/100" : "Not completed"}
Big Five Details: ${JSON.stringify(assessmentDetails.BIG_FIVE?.factorPercentages || {})}
Interview Score: ${scores.INTERVIEW !== null ? scores.INTERVIEW + "/100" : "Not completed"}
Overall Score: ${overallScore}/100

Provide a JSON response:
{
  "summary": "<3-4 sentence overall candidate summary>",
  "strengths": "<top 3 strengths as a comma-separated list>",
  "redFlags": "<any red flags or concerns, or 'None identified' if clean>"
}`,
  });

  let parsed = { summary: "", strengths: "", redFlags: "" };
  try {
    const cleaned = aiSummary.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      summary: `${app.firstName} ${app.lastName} scored ${overallScore}/100 overall as a ${app.primaryTrade} with ${app.yearsExperience} years of experience.`,
      strengths: "Assessment data available for manual review",
      redFlags: "Could not generate AI analysis",
    };
  }

  // Update the application
  await db.artisanApplication.update({
    where: { id: applicationId },
    data: {
      overallScore,
      aiSummary: parsed.summary,
      aiStrengths: parsed.strengths,
      aiRedFlags: parsed.redFlags,
      status: app.interviewResponses.length >= 5 ? "UNDER_REVIEW" : app.status,
    },
  });

  return { overallScore, ...parsed };
}
