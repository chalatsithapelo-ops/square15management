/**
 * Situational Judgement Test (SJT) question bank — modern, validated-style
 * replacement for MBTI in the composite score. Scenario-based items with
 * recommended-best and recommended-worst options.
 */

export type SJTQuestion = {
  id: number;
  scenario: string;
  options: string[];
  bestIndex: number;   // 2 points
  worstIndex: number;  // -1 points
  competency: string;
};

export const SJT_QUESTIONS: SJTQuestion[] = [
  {
    id: 1,
    scenario:
      "A client is upset because the wrong part was installed. They threaten to leave a bad review. You:",
    options: [
      "Apologize sincerely, explain the fix plan with a time, and follow through.",
      "Defend the original work and explain why the part is acceptable.",
      "Offer a discount without acknowledging the error.",
      "Escalate directly to your manager without speaking to the client.",
    ],
    bestIndex: 0,
    worstIndex: 1,
    competency: "customer_service",
  },
  {
    id: 2,
    scenario:
      "Halfway through a job you realize you need a specialty tool you do not have on site. You:",
    options: [
      "Stop, inform the client, source the tool, and give a revised ETA.",
      "Improvise with an inadequate tool to finish quickly.",
      "Leave site silently and return another day.",
      "Ask a colleague to come finish for you without telling the client.",
    ],
    bestIndex: 0,
    worstIndex: 1,
    competency: "problem_solving",
  },
  {
    id: 3,
    scenario: "A teammate is cutting safety corners on site. You:",
    options: [
      "Speak to them directly and, if unresolved, report to the supervisor.",
      "Ignore it if the work is finishing on time.",
      "Copy their shortcut to stay competitive.",
      "Record it and share the video in a group chat for laughs.",
    ],
    bestIndex: 0,
    worstIndex: 3,
    competency: "integrity",
  },
  {
    id: 4,
    scenario:
      "You receive two job assignments at the same time from two different managers. You:",
    options: [
      "Inform both, agree a priority, and confirm timelines in writing.",
      "Pick the one you prefer and start with it.",
      "Do both in parallel and do each half-well.",
      "Wait for them to sort it out themselves.",
    ],
    bestIndex: 0,
    worstIndex: 2,
    competency: "professionalism",
  },
  {
    id: 5,
    scenario:
      "A customer asks you to do cash-in-hand work on the side during company time. You:",
    options: [
      "Politely decline and explain this is against company policy.",
      "Accept and ask them to keep it quiet.",
      "Negotiate a price for after hours only if written off-book.",
      "Report them to the police.",
    ],
    bestIndex: 0,
    worstIndex: 1,
    competency: "integrity",
  },
  {
    id: 6,
    scenario: "You finish a job early. You:",
    options: [
      "Check the work thoroughly, clean the site, and report completion.",
      "Pack up and leave immediately.",
      "Ask the client for additional unscheduled work for extra cash.",
      "Stay parked outside until the scheduled end time.",
    ],
    bestIndex: 0,
    worstIndex: 2,
    competency: "professionalism",
  },
  {
    id: 7,
    scenario:
      "You damage a client's wall while fitting a new unit. You:",
    options: [
      "Stop, inform the client honestly, photograph it, and offer to repair.",
      "Cover it with the unit and hope it is not noticed.",
      "Blame the original wall condition.",
      "Repair it quickly yourself with the wrong materials to save time.",
    ],
    bestIndex: 0,
    worstIndex: 1,
    competency: "integrity",
  },
  {
    id: 8,
    scenario:
      "A new apprentice asks you a question you know the answer to while you are busy. You:",
    options: [
      "Give a quick answer and set a time to explain fully later.",
      "Ignore them until they figure it out.",
      "Tell them to stop bothering you.",
      "Answer incorrectly because you are rushed.",
    ],
    bestIndex: 0,
    worstIndex: 3,
    competency: "teamwork",
  },
  {
    id: 9,
    scenario:
      "You arrive and the client is not home. They said they would be. You:",
    options: [
      "Call and text the client, then wait a reasonable time while informing dispatch.",
      "Leave immediately and mark the job as abandoned.",
      "Force entry if the back door is open.",
      "Wait all day without telling anyone.",
    ],
    bestIndex: 0,
    worstIndex: 2,
    competency: "professionalism",
  },
  {
    id: 10,
    scenario:
      "You notice a serious electrical fault unrelated to your scope of work. You:",
    options: [
      "Inform the client clearly, document it, and recommend a qualified electrician.",
      "Fix it quickly yourself to impress the client.",
      "Say nothing because it is not your job.",
      "Tell them it is fine when it is not.",
    ],
    bestIndex: 0,
    worstIndex: 3,
    competency: "trade_knowledge",
  },
];

export function scoreSJT(responses: Record<number, number>): {
  score: number;
  results: Record<string, unknown>;
} {
  let earned = 0;
  let max = 0;
  const byCompetency: Record<string, { earned: number; max: number }> = {};
  for (const q of SJT_QUESTIONS) {
    const chosen = responses[q.id];
    const stat = byCompetency[q.competency] ?? { earned: 0, max: 0 };
    stat.max += 2;
    max += 2;
    if (chosen === q.bestIndex) {
      earned += 2;
      stat.earned += 2;
    } else if (chosen === q.worstIndex) {
      earned += -1;
      stat.earned += -1;
    }
    byCompetency[q.competency] = stat;
  }
  const normalized = Math.max(0, Math.round((earned / max) * 100));
  return {
    score: normalized,
    results: {
      rawEarned: earned,
      rawMax: max,
      percentage: normalized,
      classification:
        normalized >= 80
          ? "Excellent judgment"
          : normalized >= 60
          ? "Good judgment"
          : normalized >= 40
          ? "Developing judgment"
          : "Needs development",
      byCompetency: Object.fromEntries(
        Object.entries(byCompetency).map(([k, v]) => [
          k,
          { score: Math.max(0, Math.round((v.earned / v.max) * 100)) },
        ]),
      ),
    },
  };
}
