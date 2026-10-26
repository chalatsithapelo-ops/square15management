// PR-3 — Site-Specific Risk Assessment (SSRA) templates per service type.
// Used by the artisan "Start a Job" wizard. Each template is a small quiz
// (3-6 questions). Each "Yes" answer produces an OhsRiskItem row.

export type SsraQuestion = {
  id: string;                // stable key
  prompt: string;
  /** If user answers "yes", these risk items are added. */
  onYes: {
    hazard: string;
    potentialHarm: string;
    inherentLikelihood: number; // 1-5
    inherentSeverity: number;   // 1-5
    controls: string;
    residualLikelihood: number;
    residualSeverity: number;
    ppeRequired: string[];
    trainingRequired?: string[];
  }[];
};

export type SsraTemplate = {
  serviceType: string;
  title: string;
  questions: SsraQuestion[];
};

const PLUMBING: SsraTemplate = {
  serviceType: "PLUMBING",
  title: "Plumbing SSRA",
  questions: [
    {
      id: "wet-near-electrical",
      prompt: "Will you be working with water near electrical equipment, outlets or DBs?",
      onYes: [{
        hazard: "Water contact with live electrical equipment",
        potentialHarm: "Electrocution or short-circuit fire",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Isolate circuit at DB before work; lockout & sign; verify dead with tester; cover open outlets",
        residualLikelihood: 1, residualSeverity: 5,
        ppeRequired: ["Insulated gloves", "Safety glasses", "Rubber-soled boots"],
        trainingRequired: ["Electrical safety awareness"],
      }],
    },
    {
      id: "confined-space",
      prompt: "Will you work in a confined space (sump, manhole, ceiling void)?",
      onYes: [{
        hazard: "Confined space entry — atmosphere & egress",
        potentialHarm: "Asphyxiation, entrapment, heat stroke",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Issue confined-space permit; gas-test before entry; standby attendant; communication line; rescue plan",
        residualLikelihood: 1, residualSeverity: 4,
        ppeRequired: ["Harness", "4-gas monitor", "Hard hat", "Communication radio"],
        trainingRequired: ["Confined space entry"],
      }],
    },
    {
      id: "heights-2m",
      prompt: "Will you work at heights greater than 2m (ceiling, roof, ladder)?",
      onYes: [{
        hazard: "Falls from height",
        potentialHarm: "Serious injury or death",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Use rated ladder/scaffold; tie off above anchor point if >2m; spotter on ladder; non-slip footwear",
        residualLikelihood: 1, residualSeverity: 4,
        ppeRequired: ["Full body harness", "Lanyard", "Hard hat"],
        trainingRequired: ["Work at heights"],
      }],
    },
    {
      id: "hot-work",
      prompt: "Will you use a blowtorch, soldering iron or grinder?",
      onYes: [{
        hazard: "Hot work — fire & burns",
        potentialHarm: "Burns, fire ignition of nearby material",
        inherentLikelihood: 2, inherentSeverity: 4,
        controls: "Hot-work permit; remove combustibles 5m radius; fire extinguisher within reach; fire watch 30 min after",
        residualLikelihood: 1, residualSeverity: 3,
        ppeRequired: ["Welding gloves", "Apron", "Safety glasses", "Long sleeves"],
      }],
    },
    {
      id: "sewerage",
      prompt: "Will you work with raw sewage or blocked drains?",
      onYes: [{
        hazard: "Biological exposure — sewage",
        potentialHarm: "Hepatitis, gastrointestinal infection, skin disease",
        inherentLikelihood: 4, inherentSeverity: 4,
        controls: "Wash hands & exposed skin immediately; no eating/smoking on site; cover open wounds",
        residualLikelihood: 1, residualSeverity: 3,
        ppeRequired: ["Nitrile gloves", "Face shield", "Coveralls", "Gum boots"],
      }],
    },
  ],
};

const ELECTRICAL: SsraTemplate = {
  serviceType: "ELECTRICAL",
  title: "Electrical SSRA",
  questions: [
    {
      id: "live-circuit",
      prompt: "Will any part of the work be done on a LIVE circuit (no isolation possible)?",
      onYes: [{
        hazard: "Live electrical work",
        potentialHarm: "Electrocution, arc flash, fatal burn",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Only competent persons; live-line tools; insulated mat; second person present; voltage-rated PPE",
        residualLikelihood: 1, residualSeverity: 5,
        ppeRequired: ["Arc-flash suit", "Class 0 gloves", "Face shield", "Insulated boots"],
        trainingRequired: ["Licensed electrician", "Live work authorisation"],
      }],
    },
    {
      id: "high-voltage",
      prompt: "Will you work with voltages above 230V (3-phase 400V or higher)?",
      onYes: [{
        hazard: "High-voltage exposure",
        potentialHarm: "Severe electrocution, arc burn",
        inherentLikelihood: 2, inherentSeverity: 5,
        controls: "Lockout/Tagout at main DB; verify zero voltage with category III multimeter; ground points",
        residualLikelihood: 1, residualSeverity: 4,
        ppeRequired: ["HV gloves", "Arc-rated balaclava", "Insulated tools"],
        trainingRequired: ["HV switching"],
      }],
    },
    {
      id: "alone",
      prompt: "Will you be working alone on this electrical job?",
      onYes: [{
        hazard: "Lone worker on electrical task",
        potentialHarm: "Delay in emergency response if incapacitated",
        inherentLikelihood: 3, inherentSeverity: 4,
        controls: "Hourly check-in with dispatcher; share live location; emergency contact on speed-dial",
        residualLikelihood: 1, residualSeverity: 3,
        ppeRequired: ["Mobile phone with charged battery"],
      }],
    },
    {
      id: "heights-electrical",
      prompt: "Will you work at heights >2m (roof, ladder, overhead lines)?",
      onYes: [{
        hazard: "Falls from height during electrical work",
        potentialHarm: "Serious injury or death + electrical shock",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Tie off above anchor; non-conductive ladder; isolate nearby lines",
        residualLikelihood: 1, residualSeverity: 4,
        ppeRequired: ["Full body harness", "Lanyard", "Hard hat", "Insulated gloves"],
        trainingRequired: ["Work at heights"],
      }],
    },
  ],
};

const HVAC: SsraTemplate = {
  serviceType: "HVAC",
  title: "HVAC SSRA",
  questions: [
    {
      id: "refrigerant",
      prompt: "Will you handle refrigerant gases (R410A, R22, R32, R134a)?",
      onYes: [{
        hazard: "Refrigerant exposure",
        potentialHarm: "Asphyxiation in confined space, cold burns, environmental release",
        inherentLikelihood: 3, inherentSeverity: 4,
        controls: "Ventilation; recovery machine, no venting; valid SAQCC Gas card",
        residualLikelihood: 1, residualSeverity: 3,
        ppeRequired: ["Insulated gloves", "Safety glasses"],
        trainingRequired: ["SAQCC Gas registration"],
      }],
    },
    {
      id: "roof-work",
      prompt: "Will you work on a roof or above 2m height?",
      onYes: [{
        hazard: "Falls from height",
        potentialHarm: "Serious injury or death",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Tie off above anchor; non-fragile roof check; edge protection",
        residualLikelihood: 1, residualSeverity: 4,
        ppeRequired: ["Full body harness", "Lanyard"],
        trainingRequired: ["Work at heights"],
      }],
    },
    {
      id: "live-electrical",
      prompt: "Will you work on live electrical components of the HVAC unit?",
      onYes: [{
        hazard: "Live electrical exposure",
        potentialHarm: "Electrocution",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Isolate DB; lockout/tag; verify dead",
        residualLikelihood: 1, residualSeverity: 5,
        ppeRequired: ["Insulated gloves", "Safety glasses"],
      }],
    },
  ],
};

const GENERAL: SsraTemplate = {
  serviceType: "GENERAL",
  title: "General Maintenance SSRA",
  questions: [
    {
      id: "public-present",
      prompt: "Will the public, tenants or other contractors be in the work area?",
      onYes: [{
        hazard: "Third-party persons in work area",
        potentialHarm: "Slips, trips, falling tools/materials, dust",
        inherentLikelihood: 4, inherentSeverity: 3,
        controls: "Barricade work zone; signage; warn occupants in advance; tidy as you go",
        residualLikelihood: 2, residualSeverity: 2,
        ppeRequired: ["High-visibility vest"],
      }],
    },
    {
      id: "heights-general",
      prompt: "Will you work above 2m height (ladder, scaffold, roof)?",
      onYes: [{
        hazard: "Falls from height",
        potentialHarm: "Serious injury or death",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Rated ladder; spotter; harness if >3m",
        residualLikelihood: 1, residualSeverity: 4,
        ppeRequired: ["Full body harness", "Lanyard", "Hard hat"],
        trainingRequired: ["Work at heights"],
      }],
    },
    {
      id: "hot-work-general",
      prompt: "Will you use any hot tools (grinder, welder, blowtorch)?",
      onYes: [{
        hazard: "Hot work — fire risk",
        potentialHarm: "Burns, fire ignition",
        inherentLikelihood: 2, inherentSeverity: 4,
        controls: "Remove combustibles 5m radius; extinguisher present; fire watch 30 min after",
        residualLikelihood: 1, residualSeverity: 3,
        ppeRequired: ["Welding gloves", "Face shield"],
      }],
    },
    {
      id: "ppe-available",
      prompt: "Do you have ALL required PPE on you right now?",
      onYes: [], // "yes" is the safe answer
    },
    {
      id: "chemicals",
      prompt: "Will you use chemicals, solvents or strong cleaners?",
      onYes: [{
        hazard: "Chemical exposure",
        potentialHarm: "Skin irritation, fumes inhalation, eye injury",
        inherentLikelihood: 3, inherentSeverity: 3,
        controls: "Read SDS; ventilate area; do not mix chemicals",
        residualLikelihood: 1, residualSeverity: 2,
        ppeRequired: ["Chemical gloves", "Safety glasses", "Respirator if fumes"],
      }],
    },
  ],
};

const PAINTING: SsraTemplate = {
  serviceType: "PAINTING",
  title: "Painting SSRA",
  questions: [
    {
      id: "scaffold",
      prompt: "Will you work on a scaffold, ladder or above 2m?",
      onYes: [{
        hazard: "Falls from height while painting",
        potentialHarm: "Serious injury or death",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Rated scaffold/ladder; spotter; tie-off if >3m",
        residualLikelihood: 1, residualSeverity: 4,
        ppeRequired: ["Harness", "Lanyard", "Hard hat"],
        trainingRequired: ["Work at heights"],
      }],
    },
    {
      id: "solvent-paint",
      prompt: "Are you using solvent-based paint or industrial coatings?",
      onYes: [{
        hazard: "Solvent fumes",
        potentialHarm: "Headache, dizziness, respiratory irritation",
        inherentLikelihood: 4, inherentSeverity: 3,
        controls: "Ventilation; respirator with organic vapor cartridge; no smoking",
        residualLikelihood: 1, residualSeverity: 2,
        ppeRequired: ["A2 organic vapor respirator", "Chemical gloves", "Safety glasses"],
      }],
    },
    {
      id: "lead-asbestos",
      prompt: "Could the surface contain LEAD-based paint or asbestos (pre-1995 building)?",
      onYes: [{
        hazard: "Lead/Asbestos exposure",
        potentialHarm: "Long-term lung disease, neurological damage",
        inherentLikelihood: 2, inherentSeverity: 5,
        controls: "STOP. Test material first; do not sand/scrape; engage specialist removal contractor",
        residualLikelihood: 1, residualSeverity: 4,
        ppeRequired: ["P3 respirator", "Disposable coveralls", "Gloves"],
        trainingRequired: ["Hazardous material handling"],
      }],
    },
  ],
};

const CARPENTRY: SsraTemplate = {
  serviceType: "CARPENTRY",
  title: "Carpentry SSRA",
  questions: [
    {
      id: "power-tools",
      prompt: "Will you use power tools (circular saw, drill, planer)?",
      onYes: [{
        hazard: "Power tool injuries",
        potentialHarm: "Lacerations, eye injury, hearing damage",
        inherentLikelihood: 4, inherentSeverity: 3,
        controls: "Inspect tool before use; correct guards in place; never bypass safety switches",
        residualLikelihood: 2, residualSeverity: 2,
        ppeRequired: ["Cut-resistant gloves", "Safety glasses", "Ear protection"],
      }],
    },
    {
      id: "lifting",
      prompt: "Will you lift items over 25 kg alone?",
      onYes: [{
        hazard: "Manual handling injury",
        potentialHarm: "Back/musculoskeletal injury",
        inherentLikelihood: 4, inherentSeverity: 3,
        controls: "Use mechanical aid or 2-person lift; correct lifting posture",
        residualLikelihood: 2, residualSeverity: 2,
        ppeRequired: ["Steel toe boots", "Back support belt"],
      }],
    },
    {
      id: "heights-carpentry",
      prompt: "Will you work above 2m height?",
      onYes: [{
        hazard: "Falls from height",
        potentialHarm: "Serious injury",
        inherentLikelihood: 3, inherentSeverity: 5,
        controls: "Rated ladder or scaffold; harness if >3m",
        residualLikelihood: 1, residualSeverity: 4,
        ppeRequired: ["Harness", "Hard hat"],
        trainingRequired: ["Work at heights"],
      }],
    },
  ],
};

const OTHER: SsraTemplate = {
  ...GENERAL,
  serviceType: "OTHER",
  title: "Other/Custom Work SSRA",
};

const ALL_TEMPLATES: SsraTemplate[] = [PLUMBING, ELECTRICAL, HVAC, GENERAL, PAINTING, CARPENTRY, OTHER];

/** Returns the SSRA template best matching the service type, falling back to GENERAL. */
export function getSsraTemplate(serviceType: string): SsraTemplate {
  const needle = serviceType.toUpperCase();
  return ALL_TEMPLATES.find((t) => needle.includes(t.serviceType)) ?? GENERAL;
}

export function listSsraServiceTypes(): string[] {
  return ALL_TEMPLATES.map((t) => t.serviceType);
}
