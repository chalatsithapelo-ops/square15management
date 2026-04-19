/**
 * Assessment question banks for artisan recruitment pipeline.
 * 
 * IQ — Pattern recognition, numerical & spatial reasoning (20 questions)
 * EQ — Emotional intelligence scenarios (20 questions)
 * MBTI — 4-dimension preference pairs (20 questions)
 * Big Five OCEAN — 5-factor personality (25 questions)
 */

// ═══════════════════════════════════════════════════════════════════════
// IQ TEST — Logical / Numerical / Spatial reasoning
// ═══════════════════════════════════════════════════════════════════════

export interface IQQuestion {
  id: number;
  category: "pattern" | "numerical" | "spatial" | "verbal";
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: 1 | 2 | 3; // easy, medium, hard
}

export const IQ_QUESTIONS: IQQuestion[] = [
  // Pattern Recognition
  { id: 1, category: "pattern", difficulty: 1, question: "What comes next in the sequence: 2, 4, 8, 16, ?", options: ["20", "24", "32", "36"], correctIndex: 2 },
  { id: 2, category: "pattern", difficulty: 1, question: "Complete the pattern: A, C, E, G, ?", options: ["H", "I", "J", "K"], correctIndex: 1 },
  { id: 3, category: "pattern", difficulty: 2, question: "What comes next: 1, 1, 2, 3, 5, 8, ?", options: ["10", "11", "13", "15"], correctIndex: 2 },
  { id: 4, category: "pattern", difficulty: 2, question: "Complete: 3, 6, 11, 18, 27, ?", options: ["36", "38", "40", "35"], correctIndex: 1 },
  { id: 5, category: "pattern", difficulty: 3, question: "What comes next: 2, 6, 12, 20, 30, ?", options: ["40", "42", "44", "38"], correctIndex: 1 },

  // Numerical Reasoning
  { id: 6, category: "numerical", difficulty: 1, question: "A job requires 12 tiles per row and 8 rows. How many tiles are needed?", options: ["86", "96", "106", "92"], correctIndex: 1 },
  { id: 7, category: "numerical", difficulty: 1, question: "If paint costs R85 per litre and you need 6 litres, what's the total?", options: ["R490", "R500", "R510", "R520"], correctIndex: 2 },
  { id: 8, category: "numerical", difficulty: 2, question: "A pipe leaks 250ml per hour. How many litres are lost in 3 days?", options: ["15L", "16L", "18L", "20L"], correctIndex: 2 },
  { id: 9, category: "numerical", difficulty: 2, question: "If 3 workers finish a job in 4 days, how many days for 6 workers (same pace)?", options: ["1", "2", "3", "8"], correctIndex: 1 },
  { id: 10, category: "numerical", difficulty: 3, question: "A room is 5m x 4m x 3m high. Excluding a 2m x 1m door and a 1.5m x 1.2m window, what wall area needs painting?", options: ["48.2m²", "50.2m²", "52.2m²", "54.2m²"], correctIndex: 1 },

  // Spatial Reasoning
  { id: 11, category: "spatial", difficulty: 1, question: "If you fold a square piece of paper in half diagonally, what shape do you get?", options: ["Rectangle", "Triangle", "Pentagon", "Trapezoid"], correctIndex: 1 },
  { id: 12, category: "spatial", difficulty: 1, question: "How many faces does a cube have?", options: ["4", "6", "8", "12"], correctIndex: 1 },
  { id: 13, category: "spatial", difficulty: 2, question: "A pipe runs north for 3m, turns east for 4m. What is the straight-line distance from start to end?", options: ["5m", "6m", "7m", "8m"], correctIndex: 0 },
  { id: 14, category: "spatial", difficulty: 2, question: "If you rotate the letter 'N' 90° clockwise, what letter does it most resemble?", options: ["Z", "U", "M", "W"], correctIndex: 0 },
  { id: 15, category: "spatial", difficulty: 3, question: "A tank is a cylinder with radius 1m and height 2m. Approximately what volume of water does it hold?", options: ["3.14m³", "6.28m³", "12.56m³", "2.0m³"], correctIndex: 1 },

  // Verbal Reasoning
  { id: 16, category: "verbal", difficulty: 1, question: "'Waterproof' is to 'water' as 'fireproof' is to:", options: ["Heat", "Fire", "Smoke", "Flame"], correctIndex: 1 },
  { id: 17, category: "verbal", difficulty: 1, question: "Which word does NOT belong? Hammer, Screwdriver, Pliers, Paintbrush", options: ["Hammer", "Screwdriver", "Pliers", "Paintbrush"], correctIndex: 3 },
  { id: 18, category: "verbal", difficulty: 2, question: "Foundation is to building as roots are to:", options: ["Soil", "Water", "Tree", "Leaves"], correctIndex: 2 },
  { id: 19, category: "verbal", difficulty: 2, question: "If all plumbers are tradespeople, and some tradespeople are electricians, which MUST be true?", options: ["All plumbers are electricians", "Some electricians are plumbers", "All tradespeople are plumbers", "None of the above must be true"], correctIndex: 3 },
  { id: 20, category: "verbal", difficulty: 3, question: "A specification states: 'All wiring must be copper or aluminium, except in wet areas where only copper is permitted.' In a bathroom, which is acceptable?", options: ["Aluminium only", "Copper only", "Either copper or aluminium", "Neither"], correctIndex: 1 },
];

// ═══════════════════════════════════════════════════════════════════════
// EQ TEST — Emotional Intelligence Assessment
// ═══════════════════════════════════════════════════════════════════════

export interface EQQuestion {
  id: number;
  category: "self_awareness" | "self_management" | "social_awareness" | "relationship_management";
  scenario: string;
  options: { text: string; score: number }[]; // score 1-4 (4 = highest EQ)
}

export const EQ_QUESTIONS: EQQuestion[] = [
  // Self-Awareness
  { id: 1, category: "self_awareness", scenario: "You make a mistake on a plumbing installation that costs extra materials. How do you react?",
    options: [
      { text: "Blame the unclear instructions and move on", score: 1 },
      { text: "Feel frustrated but hide it from everyone", score: 2 },
      { text: "Acknowledge the mistake to your supervisor and fix it", score: 4 },
      { text: "Quietly fix it and hope nobody notices", score: 3 },
    ]},
  { id: 2, category: "self_awareness", scenario: "A colleague tells you your work pace is slower than others. You feel:",
    options: [
      { text: "Angry — they have no right to judge me", score: 1 },
      { text: "Hurt but I reflect on whether there's truth in it", score: 4 },
      { text: "Indifferent — I don't care what they think", score: 2 },
      { text: "Defensive — I explain why I'm thorough not slow", score: 3 },
    ]},
  { id: 3, category: "self_awareness", scenario: "You're asked to do a task you've never done before. What's your first thought?",
    options: [
      { text: "I'll say I know how and figure it out as I go", score: 2 },
      { text: "I'll be honest that it's new to me and ask for guidance", score: 4 },
      { text: "I'll refuse — it's not in my job description", score: 1 },
      { text: "I'll watch a YouTube video during lunch and try it", score: 3 },
    ]},
  { id: 4, category: "self_awareness", scenario: "After a long day of physical work, you feel exhausted and irritable. You:",
    options: [
      { text: "Snap at the next person who talks to me", score: 1 },
      { text: "Recognise I'm tired and take a moment before responding to anyone", score: 4 },
      { text: "Push through and pretend everything is fine", score: 2 },
      { text: "Complain loudly to colleagues about the workload", score: 1 },
    ]},
  { id: 5, category: "self_awareness", scenario: "You receive a performance review that's mostly positive but highlights one weakness. You focus on:",
    options: [
      { text: "The weakness — it ruins the whole review for me", score: 2 },
      { text: "The positives — I ignore the negative part", score: 2 },
      { text: "Both — I appreciate the praise and plan to work on the weakness", score: 4 },
      { text: "Nothing — reviews are meaningless to me", score: 1 },
    ]},

  // Self-Management
  { id: 6, category: "self_management", scenario: "You're running late for a job because of traffic. The client is waiting. You:",
    options: [
      { text: "Rush and drive dangerously to get there faster", score: 1 },
      { text: "Call ahead, apologise, give an honest ETA", score: 4 },
      { text: "Arrive late and make up an excuse", score: 2 },
      { text: "Don't call — they'll see me when I get there", score: 1 },
    ]},
  { id: 7, category: "self_management", scenario: "You disagree with your foreman's approach to a repair. You:",
    options: [
      { text: "Do it his way but complain to other workers", score: 2 },
      { text: "Quietly share your concern in private and explain your reasoning", score: 4 },
      { text: "Refuse to do it his way — you know better", score: 1 },
      { text: "Do it his way without question — he's the boss", score: 3 },
    ]},
  { id: 8, category: "self_management", scenario: "A tool you were using breaks mid-job. You:",
    options: [
      { text: "Throw it down in frustration and curse", score: 1 },
      { text: "Take a breath, report it, and find an alternative", score: 4 },
      { text: "Use it broken and hope for the best", score: 1 },
      { text: "Stop working and wait for someone to bring a new one", score: 2 },
    ]},
  { id: 9, category: "self_management", scenario: "You have 3 urgent tasks due today. You:",
    options: [
      { text: "Do whichever is easiest first to feel productive", score: 2 },
      { text: "Prioritise by importance and deadline, communicate any conflicts", score: 4 },
      { text: "Panic and do a poor job on all three", score: 1 },
      { text: "Pick one and ignore the other two", score: 1 },
    ]},
  { id: 10, category: "self_management", scenario: "You're offered cash by a tenant to skip an item on the inspection checklist. You:",
    options: [
      { text: "Take it — nobody will know", score: 1 },
      { text: "Decline firmly but politely and complete the full inspection", score: 4 },
      { text: "Decline but feel tempted and rush through it", score: 3 },
      { text: "Report the tenant immediately to management", score: 3 },
    ]},

  // Social Awareness
  { id: 11, category: "social_awareness", scenario: "A new team member seems quiet and isolated on their first day. You:",
    options: [
      { text: "Leave them alone — they'll figure it out", score: 1 },
      { text: "Introduce yourself and show them around during break", score: 4 },
      { text: "Wait for them to come to you if they need help", score: 2 },
      { text: "Tell them the unwritten rules to 'survive' here", score: 3 },
    ]},
  { id: 12, category: "social_awareness", scenario: "You notice a colleague has been unusually quiet and making mistakes all week. You:",
    options: [
      { text: "Report their poor performance to the manager", score: 1 },
      { text: "Ask them privately if everything is okay", score: 4 },
      { text: "Ignore it — it's none of your business", score: 2 },
      { text: "Joke about their mistakes to lighten the mood", score: 1 },
    ]},
  { id: 13, category: "social_awareness", scenario: "A client is visibly upset about how long a repair is taking. You:",
    options: [
      { text: "Tell them repairs take time and they need to be patient", score: 2 },
      { text: "Acknowledge their frustration, explain the process and timeline clearly", score: 4 },
      { text: "Avoid them and let management handle it", score: 1 },
      { text: "Work faster even if it compromises quality", score: 1 },
    ]},
  { id: 14, category: "social_awareness", scenario: "During a team meeting, two colleagues start arguing. You:",
    options: [
      { text: "Pick a side and join in", score: 1 },
      { text: "Stay quiet and look at your phone", score: 2 },
      { text: "Calmly suggest focusing on the issue rather than blaming each other", score: 4 },
      { text: "Walk out — meetings are a waste of time anyway", score: 1 },
    ]},
  { id: 15, category: "social_awareness", scenario: "You're working in a tenant's home and they're clearly anxious about the disruption. You:",
    options: [
      { text: "Ignore their anxiety and focus on your work", score: 1 },
      { text: "Reassure them by explaining each step and keeping the area tidy", score: 4 },
      { text: "Tell them to go to another room so you can concentrate", score: 2 },
      { text: "Work as fast as possible to get it over with", score: 2 },
    ]},

  // Relationship Management
  { id: 16, category: "relationship_management", scenario: "A subcontractor delivers poor quality work that affects your section. You:",
    options: [
      { text: "Fix it yourself and say nothing", score: 2 },
      { text: "Discuss the issue constructively with them and agree on a fix", score: 4 },
      { text: "Complain about them to management", score: 2 },
      { text: "Refuse to work until they redo it", score: 1 },
    ]},
  { id: 17, category: "relationship_management", scenario: "Your foreman asks you to train a new worker. You:",
    options: [
      { text: "Show them once quickly and expect them to remember", score: 2 },
      { text: "Patiently demonstrate, explain why, and check their understanding", score: 4 },
      { text: "Tell them to watch YouTube tutorials", score: 1 },
      { text: "Complain that training isn't your job", score: 1 },
    ]},
  { id: 18, category: "relationship_management", scenario: "A colleague takes credit for work you did. You:",
    options: [
      { text: "Confront them angrily in front of everyone", score: 1 },
      { text: "Speak to them privately about giving proper credit", score: 4 },
      { text: "Say nothing but hold a grudge", score: 2 },
      { text: "Start taking credit for their work in return", score: 1 },
    ]},
  { id: 19, category: "relationship_management", scenario: "A property manager is difficult to work with and changes requirements often. You:",
    options: [
      { text: "Refuse to work with them again", score: 1 },
      { text: "Adapt patiently, document changes, and confirm everything in writing", score: 4 },
      { text: "Do whatever they say even if it's wrong, to avoid conflict", score: 2 },
      { text: "Complain to other workers about them", score: 1 },
    ]},
  { id: 20, category: "relationship_management", scenario: "You and a team member have very different working styles. You:",
    options: [
      { text: "Insist they do things your way", score: 1 },
      { text: "Find common ground — agree what matters is the quality of the result", score: 4 },
      { text: "Ask to be paired with someone else", score: 2 },
      { text: "Work separately without communicating", score: 1 },
    ]},
];

// ═══════════════════════════════════════════════════════════════════════
// MBTI — Myers-Briggs Type Indicator (4 dimensions, 20 questions)
// ═══════════════════════════════════════════════════════════════════════

export interface MBTIQuestion {
  id: number;
  dimension: "EI" | "SN" | "TF" | "JP"; // Extraversion/Introversion, Sensing/iNtuition, Thinking/Feeling, Judging/Perceiving
  question: string;
  optionA: { text: string; pole: "E" | "S" | "T" | "J" };
  optionB: { text: string; pole: "I" | "N" | "F" | "P" };
}

export const MBTI_QUESTIONS: MBTIQuestion[] = [
  // E vs I (5 questions)
  { id: 1, dimension: "EI", question: "When working on a building site, you prefer to:",
    optionA: { text: "Work with the team, talking and coordinating throughout the day", pole: "E" },
    optionB: { text: "Focus on your own section quietly and catch up with people during breaks", pole: "I" } },
  { id: 2, dimension: "EI", question: "After a long week of work, you recharge by:",
    optionA: { text: "Going out with friends or family", pole: "E" },
    optionB: { text: "Spending time alone or with one close person", pole: "I" } },
  { id: 3, dimension: "EI", question: "When solving a problem on site, you tend to:",
    optionA: { text: "Think out loud and discuss it with whoever is nearby", pole: "E" },
    optionB: { text: "Think it through internally before sharing your solution", pole: "I" } },
  { id: 4, dimension: "EI", question: "In meetings or toolbox talks, you usually:",
    optionA: { text: "Contribute ideas and speak early", pole: "E" },
    optionB: { text: "Listen carefully and speak only when you have something important to add", pole: "I" } },
  { id: 5, dimension: "EI", question: "You feel most energised when:",
    optionA: { text: "Working with a busy team on a large project", pole: "E" },
    optionB: { text: "Completing a complex task independently", pole: "I" } },

  // S vs N (5 questions)
  { id: 6, dimension: "SN", question: "When reading a work order, you focus on:",
    optionA: { text: "The specific details — measurements, materials, brand names", pole: "S" },
    optionB: { text: "The big picture — what the client actually wants to achieve", pole: "N" } },
  { id: 7, dimension: "SN", question: "When approaching a repair, you prefer to:",
    optionA: { text: "Follow the standard procedure that has worked before", pole: "S" },
    optionB: { text: "Look for a better or more creative way to do it", pole: "N" } },
  { id: 8, dimension: "SN", question: "You trust more:",
    optionA: { text: "What you can see, measure, and touch", pole: "S" },
    optionB: { text: "Your gut feeling and past experience patterns", pole: "N" } },
  { id: 9, dimension: "SN", question: "When explaining a problem to a client, you tend to:",
    optionA: { text: "Show them the specific issue and what needs fixing", pole: "S" },
    optionB: { text: "Explain the underlying cause and long-term implications", pole: "N" } },
  { id: 10, dimension: "SN", question: "You are better at:",
    optionA: { text: "Working with what's in front of you right now", pole: "S" },
    optionB: { text: "Planning ahead and anticipating future problems", pole: "N" } },

  // T vs F (5 questions)
  { id: 11, dimension: "TF", question: "When choosing between two materials, you prioritise:",
    optionA: { text: "Cost-effectiveness and technical performance", pole: "T" },
    optionB: { text: "What the client will feel most comfortable with", pole: "F" } },
  { id: 12, dimension: "TF", question: "When giving feedback to a junior worker, you:",
    optionA: { text: "Focus on what they did wrong and how to fix it", pole: "T" },
    optionB: { text: "Start with what they did well, then gently suggest improvements", pole: "F" } },
  { id: 13, dimension: "TF", question: "In a dispute about how to do a job, you value:",
    optionA: { text: "The most logical and efficient approach", pole: "T" },
    optionB: { text: "Keeping team harmony even if it means compromising", pole: "F" } },
  { id: 14, dimension: "TF", question: "When a client complains about something that isn't your fault, you:",
    optionA: { text: "Explain the facts clearly and show it's not your responsibility", pole: "T" },
    optionB: { text: "Empathise with their frustration and help find a solution regardless", pole: "F" } },
  { id: 15, dimension: "TF", question: "Decisions should be based primarily on:",
    optionA: { text: "Objective analysis and data", pole: "T" },
    optionB: { text: "How the outcome affects the people involved", pole: "F" } },

  // J vs P (5 questions)
  { id: 16, dimension: "JP", question: "For a multi-day project, you prefer to:",
    optionA: { text: "Plan each day's tasks in advance and stick to the schedule", pole: "J" },
    optionB: { text: "Start working and adjust the plan as things unfold", pole: "P" } },
  { id: 17, dimension: "JP", question: "Your toolbox/workspace is usually:",
    optionA: { text: "Organised — everything has a place", pole: "J" },
    optionB: { text: "A bit messy but I know where everything is", pole: "P" } },
  { id: 18, dimension: "JP", question: "When a deadline changes and work gets rescheduled, you feel:",
    optionA: { text: "Frustrated — I had a plan", pole: "J" },
    optionB: { text: "Fine — I adapt easily to change", pole: "P" } },
  { id: 19, dimension: "JP", question: "You prefer work environments that are:",
    optionA: { text: "Structured with clear procedures and expectations", pole: "J" },
    optionB: { text: "Flexible where you can figure things out as you go", pole: "P" } },
  { id: 20, dimension: "JP", question: "When buying materials for a job, you:",
    optionA: { text: "Make a detailed list and buy exactly what's needed", pole: "J" },
    optionB: { text: "Buy roughly what you think you need and get more if required", pole: "P" } },
];

// ═══════════════════════════════════════════════════════════════════════
// BIG FIVE (OCEAN) — 5 factors, 25 questions (5 per factor)
// ═══════════════════════════════════════════════════════════════════════

export interface BigFiveQuestion {
  id: number;
  factor: "O" | "C" | "E" | "A" | "N"; // Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
  statement: string;
  reversed: boolean; // if true, scoring is inverted (1=5, 2=4, etc.)
}

export const BIG_FIVE_QUESTIONS: BigFiveQuestion[] = [
  // Openness to Experience
  { id: 1, factor: "O", reversed: false, statement: "I enjoy learning new techniques and methods for my trade" },
  { id: 2, factor: "O", reversed: false, statement: "I am curious about how different building systems work" },
  { id: 3, factor: "O", reversed: true, statement: "I prefer doing things the way I've always done them" },
  { id: 4, factor: "O", reversed: false, statement: "I enjoy finding creative solutions to unusual problems on site" },
  { id: 5, factor: "O", reversed: true, statement: "I feel uncomfortable when asked to try a new approach" },

  // Conscientiousness
  { id: 6, factor: "C", reversed: false, statement: "I always complete my work to a high standard, even when nobody is watching" },
  { id: 7, factor: "C", reversed: false, statement: "I keep my tools and work area clean and organised" },
  { id: 8, factor: "C", reversed: true, statement: "I sometimes leave small tasks unfinished when I'm tired" },
  { id: 9, factor: "C", reversed: false, statement: "I arrive on time and am ready to start work at the scheduled hour" },
  { id: 10, factor: "C", reversed: false, statement: "I follow safety procedures even when they slow me down" },

  // Extraversion
  { id: 11, factor: "E", reversed: false, statement: "I find it easy to talk to clients and explain my work" },
  { id: 12, factor: "E", reversed: false, statement: "I enjoy being part of a team on a large project" },
  { id: 13, factor: "E", reversed: true, statement: "I prefer working alone rather than with others" },
  { id: 14, factor: "E", reversed: false, statement: "I am usually the one to start a conversation on site" },
  { id: 15, factor: "E", reversed: true, statement: "Large group settings drain my energy" },

  // Agreeableness
  { id: 16, factor: "A", reversed: false, statement: "I go out of my way to help colleagues who are struggling" },
  { id: 17, factor: "A", reversed: false, statement: "I try to see things from other people's point of view" },
  { id: 18, factor: "A", reversed: true, statement: "If someone disrespects me, I make sure they know about it" },
  { id: 19, factor: "A", reversed: false, statement: "I believe in treating everyone fairly, regardless of their position" },
  { id: 20, factor: "A", reversed: true, statement: "I find it hard to trust people I don't know well" },

  // Neuroticism (higher score = more emotionally reactive)
  { id: 21, factor: "N", reversed: false, statement: "I often worry about things going wrong at work" },
  { id: 22, factor: "N", reversed: false, statement: "I get stressed easily when under pressure" },
  { id: 23, factor: "N", reversed: true, statement: "I stay calm even when deadlines are tight and work is intense" },
  { id: 24, factor: "N", reversed: false, statement: "I sometimes lose my temper when things don't go as planned" },
  { id: 25, factor: "N", reversed: true, statement: "I recover quickly from setbacks and don't dwell on mistakes" },
];

// Likert scale labels for Big Five
export const BIG_FIVE_SCALE = [
  "Strongly Disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly Agree",
];

// ═══════════════════════════════════════════════════════════════════════
// AI INTERVIEW — Behavioural questions (generated per-trade by AI)
// ═══════════════════════════════════════════════════════════════════════

export const INTERVIEW_QUESTIONS_TEMPLATE = [
  {
    dimension: "professionalism",
    question: "A client complains about work you know was done correctly. How do you handle the situation?",
  },
  {
    dimension: "problem_solving",
    question: "You arrive at a job site and discover the scope of work is much bigger than what was quoted. What steps do you take?",
  },
  {
    dimension: "reliability",
    question: "Tell me about a time you had to work under pressure to meet a tight deadline. What did you do and what was the result?",
  },
  {
    dimension: "teamwork",
    question: "Describe a situation where you had a disagreement with a colleague on how to do a job. How did you resolve it?",
  },
  {
    dimension: "integrity",
    question: "You notice a safety issue that would be expensive to fix and nobody else has spotted it. What do you do?",
  },
];
