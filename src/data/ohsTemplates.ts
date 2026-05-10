/**
 * OHS Document Template Library
 *
 * South African Occupational Health & Safety compliance templates aligned with:
 *  - OHS Act 85 of 1993 and General Administrative Regulations
 *  - Construction Regulations, 2014 (GN R.84 GG 37305)
 *  - General Safety Regulations
 *  - Environmental Regulations for Workplaces
 *  - Driven Machinery Regulations
 *  - Hazardous Chemical Substances Regulations
 *  - General Machinery Regulations
 *  - Electrical Installation Regulations 2009
 *  - SANS 10142, SANS 10400, SANS 10085 (scaffolding), SANS 10400-T (fire)
 *
 * Each template is a structured markdown document with substitutable
 * placeholders (e.g. {{COMPANY_NAME}}). The end user fills placeholders
 * once and can then freely edit any section to make it site/client specific.
 *
 * Content format (rendered by buildOhsDocumentPdf):
 *  - Lines starting with "# "  → H1 heading
 *  - Lines starting with "## " → H2 section heading
 *  - Lines starting with "### "→ H3 subsection heading
 *  - Lines starting with "- "  → bulleted list item
 *  - Lines starting with "[ ]" → checklist item (unchecked box in PDF)
 *  - Lines starting with "[x]" → checklist item (ticked box in PDF)
 *  - Blank lines              → paragraph break
 *  - Anything else            → paragraph text (wraps)
 */

export type OhsTemplateType =
  | "POLICY"
  | "PROCEDURE"
  | "SAFE_WORK_METHOD"
  | "EMERGENCY_PLAN"
  | "CHECKLIST"
  | "LEGAL_APPOINTMENT"
  | "TRAINING_MATERIAL";

export interface OhsTemplate {
  id: string;
  type: OhsTemplateType;
  category: string;
  title: string;
  description: string;
  legalBasis: string[];
  placeholders: string[]; // e.g. ["{{COMPANY_NAME}}", "{{SITE_NAME}}"]
  requiresAck: boolean;
  content: string;
}

// Standard placeholders available in every template
export const STANDARD_PLACEHOLDERS = [
  "{{COMPANY_NAME}}",
  "{{COMPANY_REG_NO}}",
  "{{COMPANY_ADDRESS}}",
  "{{CLIENT_NAME}}",
  "{{SITE_NAME}}",
  "{{SITE_ADDRESS}}",
  "{{PROJECT_NAME}}",
  "{{CEO_NAME}}",
  "{{CEO_TITLE}}",
  "{{SAFETY_OFFICER_NAME}}",
  "{{SAFETY_OFFICER_CONTACT}}",
  "{{FIRST_AIDER_NAME}}",
  "{{FIRE_MARSHAL_NAME}}",
  "{{EFFECTIVE_DATE}}",
  "{{REVIEW_DATE}}",
  "{{EMERGENCY_NUMBER}}",
] as const;

const HEADER_BLOCK = `# {{TITLE}}

## Document Control
- **Company:** {{COMPANY_NAME}} (Reg: {{COMPANY_REG_NO}})
- **Site / Project:** {{SITE_NAME}} — {{PROJECT_NAME}}
- **Client:** {{CLIENT_NAME}}
- **Effective date:** {{EFFECTIVE_DATE}}
- **Next review:** {{REVIEW_DATE}}
- **Compiled by:** {{SAFETY_OFFICER_NAME}}
- **Approved by:** {{CEO_NAME}}, {{CEO_TITLE}}

`;

// ============================================================================
// POLICIES
// ============================================================================
const POLICIES: OhsTemplate[] = [
  {
    id: "pol-ohs-master",
    type: "POLICY",
    category: "Master Policy",
    title: "Occupational Health & Safety Policy",
    description: "Top-level OHS commitment signed by the CEO. Required under Section 7 of the OHS Act.",
    legalBasis: ["OHS Act 85 of 1993, Section 7", "Construction Regulations 2014, Reg 5(1)(a)"],
    placeholders: ["{{COMPANY_NAME}}", "{{CEO_NAME}}", "{{CEO_TITLE}}", "{{EFFECTIVE_DATE}}", "{{REVIEW_DATE}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Occupational Health & Safety Policy") + `## 1. Policy Statement

{{COMPANY_NAME}} is committed to providing and maintaining a safe and healthy working environment for all employees, contractors, visitors and members of the public who may be affected by our undertaking. We regard the management of health and safety as an integral part of our business and equal in priority to production, quality and cost.

## 2. Scope

This policy applies to all employees, sub-contractors, suppliers, visitors and any other person on premises or sites under the control of {{COMPANY_NAME}}.

## 3. Objectives

- Comply with the Occupational Health and Safety Act 85 of 1993 and all applicable regulations.
- Eliminate or minimise risks to health and safety through hazard identification and risk assessment.
- Provide and maintain a working environment that is safe and without risk to health.
- Provide such information, instruction, training and supervision as is necessary to ensure the health and safety of employees.
- Continually improve our OHS management system.

## 4. Responsibilities

### 4.1 Chief Executive Officer / Managing Director (16(1))
The CEO accepts ultimate responsibility for the safety of {{COMPANY_NAME}} and has appointed competent persons in writing under Section 16(2) to assist in discharging these duties.

### 4.2 Section 16(2) Appointee
- Implement and maintain this policy across all sites and operations.
- Ensure resources are available for health and safety.
- Report to the CEO on OHS performance quarterly.

### 4.3 Site / Project Managers
- Ensure all work is planned and executed safely.
- Hold daily safety briefings (toolbox talks).
- Investigate incidents and implement corrective actions.

### 4.4 Employees (Section 14)
- Take reasonable care for own health and safety and that of others.
- Co-operate with the employer in fulfilling its duties.
- Use PPE provided and report unsafe conditions.
- Stop work and report any imminent danger.

## 5. Right to Refuse Unsafe Work

Every employee has the right to refuse to carry out work that they reasonably believe poses a serious or imminent danger to their health or safety, without fear of victimisation. Concerns must be raised with the supervisor or the appointed Safety Officer immediately.

## 6. Consultation

{{COMPANY_NAME}} consults with employees on OHS matters through:
- The Health & Safety Committee (where 20+ employees on site, per Section 19).
- Trained Health & Safety Representatives elected per Section 17.
- Toolbox talks and team meetings.

## 7. Review

This policy is reviewed at least annually or whenever there is a significant change in operations, legislation or following a serious incident.

## 8. Approval

Signed for and on behalf of {{COMPANY_NAME}}:

_______________________________
{{CEO_NAME}}
{{CEO_TITLE}}
Date: {{EFFECTIVE_DATE}}
`,
  },
  {
    id: "pol-ppe",
    type: "POLICY",
    category: "PPE",
    title: "Personal Protective Equipment (PPE) Policy",
    description: "PPE provision, use and replacement policy.",
    legalBasis: ["OHS Act Section 8(1)", "General Safety Regulations Reg 2", "Construction Regulations Reg 5(1)(j)"],
    placeholders: ["{{COMPANY_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Personal Protective Equipment (PPE) Policy") + `## 1. Purpose

To ensure that suitable PPE is provided, used, maintained and replaced as a last line of defence after engineering and administrative controls.

## 2. Hierarchy of Control

PPE is the last layer of protection. Before issuing PPE, {{COMPANY_NAME}} will attempt to:
- Eliminate the hazard.
- Substitute with a less hazardous alternative.
- Apply engineering controls (guards, ventilation).
- Apply administrative controls (procedures, rotation).
- Issue appropriate PPE.

## 3. Mandatory Site PPE

The following PPE is mandatory on every site at all times:
- Hard hat (SANS 1397) — replaced every 3 years or on impact.
- Safety boots with steel toe and midsole (SANS 20345 S3).
- High-visibility vest (Class 2 minimum, SANS 1387).

## 4. Task-Specific PPE

Issued based on risk assessment:
- **Working at heights (>2m):** Full body harness with double lanyard and shock absorber (SANS 50361), inspected before each use.
- **Electrical work:** Insulated gloves rated to circuit voltage, arc-rated clothing, dielectric boots.
- **Welding / hot work:** Welding helmet (shade per process), leather apron, fire-resistant gloves and sleeves, respirator if galvanised material.
- **Chemicals:** Splash goggles, chemical-resistant gloves matched to substance per MSDS, apron or coverall.
- **Dust / silica / spray:** P2 / P3 respirator with fit-test; powered air respirator for prolonged exposure.
- **Noise (>85 dB):** Hearing protection (ear plugs SNR ≥25 dB or muffs).
- **Grinding / cutting:** Face shield over safety glasses, leather gloves, hearing protection.

## 5. Issue & Record Keeping

- All PPE is issued free of charge.
- Every issue is recorded on the PPE Issue Register including item, size, date and worker signature (legal record under Section 8).
- Workers are responsible for daily inspection and proper care.
- Damaged or worn PPE is replaced immediately on request.

## 6. Refusal to Wear PPE

Wearing required PPE is a condition of work. Refusal is a disciplinary offence and the worker may be removed from the workplace until they comply.

## 7. Responsibility

{{SAFETY_OFFICER_NAME}} is responsible for maintaining PPE stock, the issue register and audits.
`,
  },
  {
    id: "pol-alcohol-drugs",
    type: "POLICY",
    category: "Conduct",
    title: "Alcohol & Drug Policy",
    description: "Zero-tolerance policy for substance abuse on site.",
    legalBasis: ["General Safety Regulations Reg 2A"],
    placeholders: ["{{COMPANY_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Alcohol & Drug Policy") + `## 1. Statement

In accordance with General Safety Regulation 2A, {{COMPANY_NAME}} prohibits any person who is or appears to be under the influence of intoxicating liquor or drugs from entering or remaining on premises or sites under its control.

## 2. Application

This policy applies to all employees, sub-contractors, visitors and delivery personnel.

## 3. Prohibited

- Reporting for duty under the influence of alcohol or any drug having a narcotic or intoxicating effect.
- Possessing or consuming alcohol on site.
- Possessing, using or trafficking illegal substances.
- Misusing prescription medication that may affect work ability without disclosing it.

## 4. Prescription Medication

Employees taking prescription medication that may impair judgement, reaction time or balance must inform their supervisor before commencing work.

## 5. Testing

{{COMPANY_NAME}} reserves the right to conduct random and for-cause breathalyser and substance testing. Refusal to submit to a test is treated the same as a positive result.

## 6. Consequences

A positive test, refusal, or visible impairment results in:
- Immediate removal from the workplace.
- Disciplinary action up to and including dismissal.
- Reporting to the relevant authority where required.

## 7. Support

Employees who voluntarily seek help for substance dependence before a violation occurs may access the Employee Assistance Programme without disciplinary consequence.
`,
  },
  {
    id: "pol-smoking",
    type: "POLICY",
    category: "Conduct",
    title: "Smoking & Vaping Policy",
    description: "Designated smoking areas and tobacco-free workplace controls.",
    legalBasis: ["Tobacco Products Control Act 83 of 1993", "Environmental Regulations for Workplaces"],
    placeholders: ["{{COMPANY_NAME}}", "{{SITE_NAME}}"],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Smoking & Vaping Policy") + `## 1. Purpose

To protect employees and visitors from second-hand smoke and to prevent fire hazards.

## 2. Smoke-Free Zones

Smoking and vaping are strictly prohibited:
- Inside any building, vehicle, container or covered area.
- Within 5 metres of any entrance, window or air-intake.
- In any area where flammable materials are stored or handled.
- On scaffolding, in excavations or in confined spaces.
- Within 10 metres of fuel storage, paint, solvents or gas cylinders.

## 3. Designated Smoking Areas

Smoking is permitted only in clearly marked designated areas with sand bins. {{SITE_NAME}} smoking areas are identified on the site layout plan.

## 4. Disposal

All cigarette butts must be fully extinguished and disposed of in dedicated sand bins. Throwing butts on the ground is a disciplinary offence and a fire risk.

## 5. Enforcement

Violations are treated as disciplinary offences. Repeat violations may result in suspension or dismissal.
`,
  },
  {
    id: "pol-stop-work",
    type: "POLICY",
    category: "Authority",
    title: "Stop Work Authority Policy",
    description: "Every worker's right and duty to stop unsafe work.",
    legalBasis: ["OHS Act Section 14", "Construction Regulations Reg 8(5)"],
    placeholders: ["{{COMPANY_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Stop Work Authority Policy") + `## 1. Principle

Every employee, sub-contractor and visitor at {{COMPANY_NAME}} has the unconditional right and the duty to stop any work activity they reasonably believe poses imminent serious harm to people, property or the environment.

## 2. When to Use Stop Work Authority

Stop work immediately if you observe:
- Unsafe acts that could cause injury.
- Unsafe conditions (collapsing structures, exposed energy, fire, fumes).
- A breach of a critical safety rule (no harness at height, no lockout, no permit for hot work or confined space).
- Inadequate training or PPE for the task.
- A "near miss" event that could repeat with worse consequences.

## 3. Procedure

1. Calmly call "STOP WORK" and ensure everyone in the area hears you.
2. Move everyone to a safe location.
3. Inform the supervisor immediately.
4. Document the reason on a Stop Work Card or incident form.
5. Do not resume work until the supervisor, in consultation with the Safety Officer if needed, has confirmed the hazard is controlled.

## 4. No Reprisal

{{COMPANY_NAME}} prohibits any retaliation, victimisation, intimidation or penalty against any person who exercises Stop Work Authority in good faith, even if it later proves unnecessary. Any such retaliation is a serious disciplinary offence.

## 5. Recognition

Workers who exercise Stop Work Authority in good faith are formally recognised. This is a desired behaviour, not a complaint.
`,
  },
  {
    id: "pol-driving",
    type: "POLICY",
    category: "Transport",
    title: "Driving & Vehicle Safety Policy",
    description: "Safe driving, vehicle inspection and licence requirements.",
    legalBasis: ["National Road Traffic Act 93 of 1996", "Driven Machinery Regulations"],
    placeholders: ["{{COMPANY_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Driving & Vehicle Safety Policy") + `## 1. Purpose

To ensure the safety of all employees and the public during operation of company and personal vehicles on company business.

## 2. Driver Requirements

- Valid South African driver's licence appropriate to the vehicle class.
- Professional Driving Permit (PrDP) where required (goods vehicles >3 500 kg, passenger vehicles, dangerous goods).
- Annual eye test for drivers of heavy vehicles.
- Drivers' licences inspected and photocopies kept on file.

## 3. Pre-Use Vehicle Inspection

Drivers must complete the Vehicle Pre-Use Checklist before each shift: tyres, lights, indicators, brakes, fluid levels, mirrors, seatbelts, fire extinguisher, first aid kit, reflective triangles.

## 4. Behaviour

- Wear seatbelts at all times.
- No use of cellphones (handheld or hands-free) while driving.
- No driving under the influence of alcohol, drugs or fatigue-inducing medication.
- Comply with all speed limits and road traffic legislation.

## 5. Fatigue

Drivers must not exceed continuous driving for more than 4 hours without a 30-minute break. Trip planning must allow for adequate rest.

## 6. Incident Reporting

All vehicle incidents, however minor, must be reported within 24 hours.
`,
  },
  {
    id: "pol-heights",
    type: "POLICY",
    category: "High Risk",
    title: "Working at Heights Policy",
    description: "Controls for any work performed where a fall of >2m is possible.",
    legalBasis: ["Construction Regulations 2014, Reg 10", "SANS 50361"],
    placeholders: ["{{COMPANY_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Working at Heights Policy") + `## 1. Definition

"Working at heights" means any work performed where a person could fall a distance of 2 metres or more, or where a fall of any height could cause injury (e.g. into machinery, water, traffic).

## 2. Hierarchy of Fall Protection

In order of preference:
1. **Eliminate** — design work to be done at ground level.
2. **Passive** — guard rails (top rail 1m–1.1m, mid-rail, toe-board), covered openings.
3. **Travel restraint** — harness and lanyard set short to prevent reaching the edge.
4. **Fall arrest** — full body harness, double lanyard with shock absorber, certified anchor (rated ≥12 kN), rescue plan.

## 3. Mandatory Requirements

- Fall Protection Plan compiled and signed by a competent person before work starts.
- Annual medical fitness certificate for workers (Construction Regs Reg 10(1)(c)).
- Annual height-work training certificate.
- Pre-use harness inspection (logged on the Harness Inspection Register).
- Rescue plan and rescue equipment on site whenever harnesses are used.
- No working at heights in adverse weather (wind >32 km/h, storms, ice).

## 4. Prohibited

- Lone working at heights.
- Use of damaged, modified or out-of-date equipment.
- Anchoring to inadequate points (gutters, light fittings, unsecured scaffolding).
- Climbing on ladders to do anything other than access/egress for work above 6m.

## 5. Permit System

A Working at Heights Permit is required for all work above 6 metres, on roofs, or near unprotected edges. {{SAFETY_OFFICER_NAME}} or delegate issues permits after inspecting the work area.
`,
  },
  {
    id: "pol-hot-work",
    type: "POLICY",
    category: "High Risk",
    title: "Hot Work Policy",
    description: "Welding, cutting, grinding and any work producing sparks or open flame.",
    legalBasis: ["General Safety Regulations Reg 9", "SANS 10238"],
    placeholders: ["{{COMPANY_NAME}}", "{{FIRE_MARSHAL_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Hot Work Policy") + `## 1. Definition

"Hot work" means welding, cutting, brazing, soldering, grinding, the use of disc cutters, or any other operation that produces an open flame, heat or sparks.

## 2. Permit Required

A Hot Work Permit must be issued by {{FIRE_MARSHAL_NAME}} or a competent appointee before any hot work commences. The permit is valid only for one shift and one specific location.

## 3. Pre-Work Checks

- Combustible materials within 11 metres removed or protected with fire blankets.
- Floor openings, drains and wall openings covered.
- A trained fire watcher with a serviced fire extinguisher (DCP or CO2 minimum 9 kg) present throughout and for at least 30 minutes after work stops.
- Atmosphere tested for flammable gas if any risk of vapour.

## 4. Equipment

- Gas cylinders secured upright, with flashback arrestors on both sides.
- All hoses inspected for damage.
- Welding screens to protect adjacent workers from arc flash.
- Local exhaust ventilation where galvanised, painted or coated materials are cut.

## 5. PPE

Welder's helmet (correct shade), leather gloves, leather apron, long sleeves, safety boots, respirator if fumes.

## 6. Prohibited

- Hot work without a permit.
- Hot work in confined spaces without a separate confined space permit.
- Hot work on closed containers that have held flammables until thoroughly cleaned and gas-tested.
`,
  },
  {
    id: "pol-covid",
    type: "POLICY",
    category: "Health",
    title: "Communicable Disease & Hygiene Policy",
    description: "Workplace hygiene, illness reporting and outbreak response.",
    legalBasis: ["Hazardous Biological Agents Regulations", "OHS Act Section 8"],
    placeholders: ["{{COMPANY_NAME}}"],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Communicable Disease & Hygiene Policy") + `## 1. Purpose

To protect employees, contractors and visitors from communicable diseases and maintain a hygienic workplace.

## 2. Daily Practices

- Employees feeling ill must stay home and notify their supervisor.
- Hand washing facilities provided with soap and disposable towels.
- Hand sanitiser at site entrances, ablutions and welfare areas.
- Tools and shared equipment cleaned at shift change.

## 3. Outbreak Response

In the event of a notifiable disease outbreak {{COMPANY_NAME}} will:
- Notify the Department of Health where required.
- Trace and isolate exposed workers.
- Suspend high-risk operations and reassess.
- Comply with directions of the Chief Public Health Officer.

## 4. Vaccinations

Vaccinations recommended by the Department of Health for site work (tetanus, hepatitis A/B where applicable) are made available at company cost.
`,
  },
];

// ============================================================================
// PROCEDURES
// ============================================================================
const PROCEDURES: OhsTemplate[] = [
  {
    id: "proc-incident-reporting",
    type: "PROCEDURE",
    category: "Incident",
    title: "Incident & Injury Reporting Procedure",
    description: "How and when to report incidents under Section 24 of the OHS Act.",
    legalBasis: ["OHS Act Section 24", "General Administrative Regulation 8"],
    placeholders: ["{{COMPANY_NAME}}", "{{SAFETY_OFFICER_NAME}}", "{{SAFETY_OFFICER_CONTACT}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Incident & Injury Reporting Procedure") + `## 1. Purpose

To ensure every incident, injury, occupational disease and near-miss is reported, investigated and that corrective actions are implemented to prevent recurrence.

## 2. Definitions

- **Incident** — any unplanned event resulting in or having the potential to result in injury, ill-health, damage or other loss.
- **Near-miss** — incident without injury or damage, but with the potential for either.
- **Section 24 incident** — fatality, permanent disablement, lost time injury exceeding 14 days, dangerous occurrence or unconsciousness from substance exposure.

## 3. Immediate Actions

When an incident occurs:
1. Make the area safe — do not move injured persons unless they are in further danger.
2. Render first aid; call EMS (10177 / 112) if injuries are serious.
3. Notify the supervisor and {{SAFETY_OFFICER_NAME}} ({{SAFETY_OFFICER_CONTACT}}) immediately.
4. Preserve the scene — do not disturb equipment or evidence until released by the Safety Officer or DoEL inspector.
5. Identify witnesses.

## 4. Reporting Timeline

- **All incidents:** Report verbally to supervisor within 1 hour.
- **All incidents:** Written report (Incident Report Form) within 24 hours.
- **Section 24 incidents:** {{COMPANY_NAME}} notifies the Provincial Director of the Department of Employment & Labour by the quickest means and submits the WCL.2 / Annexure 1 form within 7 days.
- **Occupational injuries (COIDA):** Employer's Report of Accident (W.Cl.2) submitted within 7 days.
- **Occupational disease:** First Medical Report (W.Cl.22) within 14 days.

## 5. Investigation

All incidents are investigated. Investigation depth scales with severity:
- Near-miss / minor first aid: line supervisor investigates.
- Lost time injury: {{SAFETY_OFFICER_NAME}} leads investigation with line supervisor.
- Major / Section 24: investigation team appointed in writing; DoEL inspector co-operated with fully.

Root cause analysis uses the 5-Why or Bowtie method. Corrective actions are SMART and tracked to completion.

## 6. Recording

The OHS Incident Register is updated for every incident. Original records are retained for at least 4 years (COIDA) or 40 years for occupational disease.

## 7. No-Blame Principle

Workers reporting incidents and near-misses in good faith will not be victimised. Honest reporting is essential to prevent serious accidents.
`,
  },
  {
    id: "proc-emergency-evac",
    type: "PROCEDURE",
    category: "Emergency",
    title: "Emergency Evacuation Procedure",
    description: "Action plan for fire, gas, structural or other emergencies requiring evacuation.",
    legalBasis: ["Environmental Regulations for Workplaces Reg 9", "SANS 10400-T", "National Building Regulations"],
    placeholders: ["{{COMPANY_NAME}}", "{{SITE_NAME}}", "{{FIRE_MARSHAL_NAME}}", "{{EMERGENCY_NUMBER}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Emergency Evacuation Procedure") + `## 1. Purpose

To safely evacuate all persons from {{SITE_NAME}} in the event of fire, explosion, gas release, bomb threat, structural collapse or other emergency.

## 2. Activation

Any person discovering an emergency must:
1. Raise the alarm — break the nearest manual call point or sound the air-horn / siren.
2. Call the Fire Marshal {{FIRE_MARSHAL_NAME}} or dial {{EMERGENCY_NUMBER}}.
3. Only attempt to fight a fire if trained, the fire is small (waste-bin size) and safe egress is behind you.

## 3. On Hearing the Alarm

- STOP work immediately. Make machinery safe (de-energise where practicable).
- LEAVE personal belongings; take only your phone and keys.
- WALK to the nearest emergency exit. Do not run, do not push.
- DO NOT use lifts.
- ASSIST visitors and persons with mobility limitations.
- CLOSE doors behind you to slow fire spread.

## 4. Assembly Point

The primary assembly point for {{SITE_NAME}} is marked on the site plan. Move clear of vehicle routes and the building.

## 5. Roll Call

The Fire Marshal performs a roll call against the site sign-in register. Any missing persons are reported to the emergency services — workers do not re-enter the building.

## 6. All-Clear

Only the Fire Marshal or attending emergency services may issue the all-clear to re-enter the building.

## 7. Drills

Evacuation drills are conducted at least every 6 months. Performance is reviewed and improvements implemented.

## 8. Equipment Inspection

- Manual call points & sirens: monthly.
- Smoke detectors: 6-monthly.
- Fire extinguishers: monthly visual, annual service tag.
- Emergency lighting: monthly battery test.
- Hose reels: 6-monthly.
- Sprinklers (if fitted): annual contractor inspection.
`,
  },
  {
    id: "proc-lockout-tagout",
    type: "PROCEDURE",
    category: "Energy",
    title: "Lockout / Tagout (Isolation of Energy) Procedure",
    description: "Isolation of electrical, mechanical, hydraulic, pneumatic, thermal and chemical energy before maintenance.",
    legalBasis: ["General Machinery Regulations Reg 3", "Electrical Installation Regulations"],
    placeholders: ["{{COMPANY_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Lockout / Tagout (Isolation of Energy) Procedure") + `## 1. Purpose

To prevent injury from the unexpected start-up or release of stored energy during maintenance, cleaning, adjustment or repair.

## 2. When LOTO Is Required

LOTO is mandatory whenever a worker could be exposed to a hazardous energy source. This includes maintenance, lubrication, clearing blockages, and repair.

## 3. Procedure (Six Steps)

1. **Prepare** — identify all energy sources (electrical, mechanical, hydraulic, pneumatic, thermal, chemical, gravity, stored).
2. **Notify** — inform all affected workers.
3. **Shut down** — switch off equipment using normal stop controls.
4. **Isolate** — disconnect the energy source at the isolator. For multiple sources isolate all.
5. **Lock and Tag** — each affected worker applies their own padlock and tag to the isolator. The tag identifies the worker, date and reason.
6. **Verify zero energy** — attempt to start the equipment with the normal start button. Test for residual energy with the appropriate meter. Bleed residual hydraulic, pneumatic or stored gravitational energy.

## 4. Multiple Workers

When multiple workers are involved each applies their personal lock. A group lockout box or multi-lock hasp is used. The equipment cannot be re-energised until every worker has removed their lock.

## 5. Restoring Energy

1. Tools and parts removed from machine.
2. Guards refitted.
3. All workers clear of danger zone.
4. Each worker removes their own lock and tag — no one else may remove a worker's lock except after written authorisation by the responsible manager and only after confirming the worker is safe.
5. Notify affected workers.
6. Operate equipment cautiously and verify safe operation.

## 6. Records

Every LOTO event is logged in the LOTO register including equipment, date, time, energy sources isolated, workers and verification.
`,
  },
  {
    id: "proc-first-aid",
    type: "PROCEDURE",
    category: "Emergency",
    title: "First Aid Procedure",
    description: "First aid arrangements, kit contents and treatment record keeping.",
    legalBasis: ["General Safety Regulations Reg 3"],
    placeholders: ["{{COMPANY_NAME}}", "{{FIRST_AIDER_NAME}}", "{{EMERGENCY_NUMBER}}"],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "First Aid Procedure") + `## 1. Appointed First Aiders

{{FIRST_AIDER_NAME}} is the appointed First Aider under General Safety Regulation 3 (one per 50 employees, plus 1 per shift). A current certificate from an accredited provider (Department of Labour-approved, minimum Level 1) is maintained.

## 2. First Aid Box

Located at clearly marked stations. Contents per General Safety Regulations Annexure including:
- Wound cleaner / antiseptic
- Cotton wool, gauze pads, bandages (assorted)
- Triangular bandages
- Adhesive plasters (assorted)
- Surgical tape
- Sterile gloves (disposable)
- Scissors and tweezers
- Resuscitation device (mouthpiece)
- Sterile saline
- Pain killers — NOT to be in the kit; only administered if the worker self-administers their own.

## 3. On Discovering an Injured Person

1. DRSABCD: Danger / Response / Send for help / Airway / Breathing / CPR / Defibrillator.
2. Call {{FIRST_AIDER_NAME}}. For serious injury also call EMS on {{EMERGENCY_NUMBER}} or 10177.
3. Do not move the casualty unless in further danger.
4. Stop bleeding with direct pressure.
5. Treat for shock — keep warm.
6. Reassure and stay with the casualty until help arrives.

## 4. Treatment Records

Every treatment, however minor, is recorded in the First Aid Register (legal requirement). The record includes date, time, name of casualty, nature of injury, treatment given and First Aider's signature.

## 5. Stock Control

The First Aid Box is checked monthly. Used items are replaced immediately. Expired items are removed and replaced.
`,
  },
  {
    id: "proc-confined-space",
    type: "PROCEDURE",
    category: "High Risk",
    title: "Confined Space Entry Procedure",
    description: "Permit-controlled entry into tanks, manholes, pits, ducts and other confined spaces.",
    legalBasis: ["General Safety Regulations Reg 5"],
    placeholders: ["{{COMPANY_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Confined Space Entry Procedure") + `## 1. Definition

A confined space is any space substantially enclosed, with limited means of access or egress, in which dangerous concentrations of gas, vapour or dust may accumulate, or oxygen may be depleted, or there is a risk of engulfment.

Examples: tanks, sewers, manholes, ducts, pits, silos, ship holds, large pipework.

## 2. Permit Required

No person may enter a confined space without a valid Confined Space Entry Permit issued by {{SAFETY_OFFICER_NAME}}. The permit is valid only for one shift.

## 3. Pre-Entry Requirements

- Risk assessment specific to the space and task.
- Atmospheric testing in this order: oxygen (19.5%–23%), flammables (<10% LEL), toxics (CO, H2S, others as relevant).
- Continuous monitoring with personal gas detectors during entry.
- Isolation of inflows (lockout valves, blank flanges, electrical isolation).
- Ventilation (mechanical) where atmosphere is not naturally safe.
- Two-way communication established and tested.
- Rescue plan and rescue equipment (tripod, winch, harness, SCBA if needed) at the entry point.
- Standby person ("hole watch") stationed at the entry, with no other duties, who never enters the space.

## 4. Entry & Work

- Entrant wears full body harness with retrieval line.
- Each entrant signs in/out on the entry log.
- Atmosphere monitored continuously; immediate evacuation if any alarm.
- Tools and lighting suitable for the atmosphere (intrinsically safe if flammables present).

## 5. Emergency

- On any gas alarm, communications failure, casualty or unplanned event — evacuate immediately.
- Standby person calls for emergency rescue; rescue is performed using the retrieval system from outside the space wherever possible.
- Entry-rescue by other workers without breathing apparatus is strictly prohibited.

## 6. Close Out

After completion:
- All workers and equipment accounted for.
- Space closed and signage updated.
- Permit signed off and filed.
`,
  },
  {
    id: "proc-electrical-safety",
    type: "PROCEDURE",
    category: "Energy",
    title: "Electrical Safety Procedure",
    description: "Safe work on or near electrical installations.",
    legalBasis: ["Electrical Installation Regulations 2009", "Electrical Machinery Regulations", "SANS 10142"],
    placeholders: ["{{COMPANY_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Electrical Safety Procedure") + `## 1. Authorised Persons

Only persons appointed in writing as "competent" under the Electrical Machinery Regulations may perform work on electrical installations. Registered Electrical Contractors (with DoEL registration) sign off Certificates of Compliance.

## 2. General Rules

- Treat every conductor as live until proven dead.
- Lock out and tag out before work.
- Test before touch — use a known-good voltage tester before and after testing the circuit.
- Apply earth bonds where required (HV).
- Maintain safe approach distances (per SANS 10142).

## 3. Portable Electrical Equipment

- All portable equipment inspected before each use.
- Earth leakage protection (30 mA RCD) on all socket outlets feeding portable equipment on site.
- Cables routed off the ground or protected from damage.
- Damaged plugs, sockets or cables removed from service immediately ("Out of Service" tag).
- Quarterly insulation resistance and earth continuity test logged on Portable Appliance Register.

## 4. Working Near Overhead Lines

- Identify all overhead lines before mobilising plant.
- Maintain minimum approach distances (low voltage 3m; up to 33 kV 4m; up to 132 kV 5m; up to 275 kV 6m; up to 400 kV 7m).
- Use a flagman / spotter where mobile plant operates near lines.
- Permit to work from the line owner if work within zone is unavoidable.

## 5. Excavation Near Buried Cables

- Obtain cable plans from the utility.
- Cable Avoidance Tool (CAT) scan before excavation.
- Hand-dig within 1 metre of any indicated cable.
- Treat all unidentified cables as live.
`,
  },
];

// ============================================================================
// CHECKLISTS
// ============================================================================
const CHECKLISTS: OhsTemplate[] = [
  {
    id: "chk-daily-site",
    type: "CHECKLIST",
    category: "Inspection",
    title: "Daily Site Safety Inspection Checklist",
    description: "Walk-through inspection at the start of each shift.",
    legalBasis: ["Construction Regulations Reg 8(1)", "Construction Regulations Reg 9"],
    placeholders: ["{{SITE_NAME}}"],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Daily Site Safety Inspection Checklist") + `Inspector name: _______________________  Date: _______________________  Time: _______________________
Site: {{SITE_NAME}}

## Access & Egress
[ ] Site entrance gate intact, signage in place
[ ] Pedestrian routes segregated from vehicles
[ ] Walkways clear of obstructions, trip hazards removed
[ ] Site is fenced / hoarded to keep public out
[ ] Emergency assembly point clearly marked

## Housekeeping
[ ] No stockpiles within 1m of edges or excavations
[ ] Waste skips not overflowing, lids closed
[ ] Cables routed off walkways
[ ] Wet areas signposted, leaks repaired
[ ] Adequate lighting in all work areas

## Welfare
[ ] Drinking water available
[ ] Toilets clean and adequately stocked
[ ] Hand washing facilities operational
[ ] Eating / rest area clean and separate from work areas

## Fire & Emergency
[ ] Fire extinguishers present, sealed, in date
[ ] Emergency exits unobstructed
[ ] Fire assembly signage visible
[ ] First aid box stocked, First Aider on site

## PPE
[ ] All workers wearing hard hats, safety boots, hi-vis
[ ] Task-specific PPE used (harness, eye/face, hearing, respiratory)
[ ] PPE in good condition

## Plant & Equipment
[ ] Plant checked and logged in pre-use book
[ ] Operators competent and authorised in writing
[ ] Tools inspected, damaged tools removed
[ ] Earth leakage protection in place for portable electrical

## Working at Heights
[ ] Edge protection / guard rails fitted
[ ] Scaffolding tagged green and current
[ ] Ladders SANS-compliant, footed and secured
[ ] Harnesses inspected before use, rescue plan in place

## Excavations
[ ] Daily inspection by competent person done
[ ] Sides supported or battered correctly
[ ] Spoil ≥1m from edge
[ ] Access ladders provided
[ ] Barriers around all excavation edges

## Hot Work / Permits
[ ] Permits valid for the day
[ ] Fire watch present and equipped
[ ] Combustibles cleared from work zone

## Environmental
[ ] Spill kits stocked and located near hazards
[ ] Dust suppression in operation if needed
[ ] Noise within limits / hearing protection enforced

## Sign-off

Findings / actions required (use back if needed):

_______________________________________________________________________

_______________________________________________________________________

Signature: ____________________   Print name: ____________________
`,
  },
  {
    id: "chk-ppe-inspect",
    type: "CHECKLIST",
    category: "PPE",
    title: "PPE Inspection Checklist",
    description: "Monthly PPE condition inspection.",
    legalBasis: ["OHS Act Section 8", "Construction Regulations Reg 5(1)(j)"],
    placeholders: [],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "PPE Inspection Checklist") + `Inspector: _______________________  Date: _______________________

## Hard Hats
[ ] No cracks, dents or UV degradation
[ ] Suspension intact and adjustable
[ ] Manufacture date within 3 years
[ ] Chin strap functional

## Safety Boots
[ ] Steel toe intact (no exposed toe-cap)
[ ] Sole tread depth ≥3mm, no separation
[ ] Upper not cut or perished
[ ] Laces / fasteners in good order

## Hi-Vis Garments
[ ] Reflective tape intact and clean
[ ] Fabric not faded below visibility threshold
[ ] No tears compromising area

## Eye Protection
[ ] Lenses not scratched / pitted impairing vision
[ ] Frames not cracked
[ ] Side shields fitted where required
[ ] Goggle straps elastic and functional

## Hearing Protection
[ ] Ear muffs cushions intact, no hardening
[ ] Headband tension adequate
[ ] Disposable plugs available in stock

## Respirators
[ ] Filters in date
[ ] Face seal not perished
[ ] Exhalation valve functional
[ ] User fit-test record current

## Gloves
[ ] No holes or chemical degradation
[ ] Correct type for task (cut / chemical / electrical)
[ ] Electrical gloves within annual test date

## Fall Arrest Equipment
[ ] Harness webbing free from cuts, burns, fraying
[ ] D-rings not deformed, stitching intact
[ ] Lanyard / shock absorber not deployed
[ ] Snap hooks operate correctly
[ ] Manufacture date within 5 years
[ ] Annual inspection tag current

## Action

Items removed from service:
_______________________________________________________________________

Items reissued / replaced:
_______________________________________________________________________

Signed: ____________________
`,
  },
  {
    id: "chk-scaffold",
    type: "CHECKLIST",
    category: "Heights",
    title: "Scaffolding Inspection Checklist",
    description: "Pre-use and weekly scaffold inspection (competent person).",
    legalBasis: ["Construction Regulations Reg 16", "SANS 10085"],
    placeholders: [],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Scaffolding Inspection Checklist") + `Scaffold reference: _______________________  Location: _______________________
Inspector (competent): _______________________  Date / time: _______________________

## Foundations
[ ] Base plates and sole boards on firm, level ground
[ ] No settlement or undermining
[ ] Adjustable jacks not overextended (<300 mm)

## Structure
[ ] Standards vertical and adequately founded
[ ] Ledgers and transoms correctly spaced
[ ] All couplers (right-angle / swivel / putlog) tight
[ ] Bracing complete (longitudinal and transverse)
[ ] Ties to building at correct intervals (vertical & horizontal)
[ ] No missing or damaged components

## Working Platform
[ ] Decked out fully, no gaps >25 mm
[ ] Boards SANS-compliant, no splits or knots
[ ] Boards adequately supported (not over-reach)
[ ] Toe boards 150 mm minimum
[ ] Mid-rail and top rail (1m–1.1m) fitted

## Access
[ ] Internal ladder access tied at top
[ ] Ladder extends 1m above platform
[ ] Trap-door hatches functional

## Loading
[ ] Loading not exceeding rated duty (light/medium/heavy)
[ ] Materials evenly distributed
[ ] No stacked materials above mid-rail height

## Tagging
[ ] Green tag — safe for use
[ ] Yellow tag — restricted use, conditions stated
[ ] Red tag — incomplete, no access
[ ] Tag updated with inspector name and date

## Mobile Scaffolds (extra)
[ ] Wheels locked when in use
[ ] No riders during movement
[ ] Height-to-base ratio safe (3:1 outdoors, 4:1 indoors)
[ ] Outriggers deployed if required

## Result

[ ] PASS — green tag fitted
[ ] PASS WITH REMEDY — actions listed below
[ ] FAIL — red tag fitted, no access

Required actions:
_______________________________________________________________________

Inspector signature: ____________________  Next inspection due: ____________________
`,
  },
  {
    id: "chk-extinguisher",
    type: "CHECKLIST",
    category: "Fire",
    title: "Fire Extinguisher Monthly Inspection",
    description: "Monthly visual inspection (in addition to annual service).",
    legalBasis: ["SANS 1475", "SANS 10400-T"],
    placeholders: [],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Fire Extinguisher Monthly Inspection") + `Inspector: _______________________  Date: _______________________

For each extinguisher record location, type and tick the items below:

| # | Location | Type | Capacity | Pressure | Seal | Hose | Body | Service Tag | Pass/Fail |
|---|----------|------|----------|----------|------|------|------|-------------|-----------|
| 1 |          |      |          |          |      |      |      |             |           |
| 2 |          |      |          |          |      |      |      |             |           |
| 3 |          |      |          |          |      |      |      |             |           |
| 4 |          |      |          |          |      |      |      |             |           |
| 5 |          |      |          |          |      |      |      |             |           |

## Inspection criteria — each extinguisher

[ ] Mounted on bracket / in cabinet, not blocked
[ ] Signage above extinguisher clearly visible
[ ] Pressure gauge in green zone
[ ] Tamper seal intact
[ ] Pin in place
[ ] Hose / nozzle free from cracks, blockages
[ ] Body free of corrosion / dents / damage
[ ] Annual service tag current (not older than 12 months)
[ ] Instructions legible

Actions taken:
_______________________________________________________________________

Signed: ____________________
`,
  },
  {
    id: "chk-first-aid-box",
    type: "CHECKLIST",
    category: "Welfare",
    title: "First Aid Box Stock Checklist",
    description: "Monthly check of first aid box contents against the GSR Annexure.",
    legalBasis: ["General Safety Regulations Reg 3 Annexure"],
    placeholders: [],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "First Aid Box Stock Checklist") + `First Aid Box location: _______________________
Checked by: _______________________  Date: _______________________

| Item | Required min | On hand | OK |
|------|-------------:|--------:|----|
| Wound cleaner / antiseptic (100 ml) | 1 | | [ ] |
| Swabs for cleaning wounds | 100 | | [ ] |
| Cotton wool (100 g) | 1 | | [ ] |
| Sterile gauze (100 x 100 mm) | 10 | | [ ] |
| Triangular bandages | 4 | | [ ] |
| Roller bandage (75 mm) | 4 | | [ ] |
| Roller bandage (100 mm) | 4 | | [ ] |
| Adhesive plasters (assorted) | 12 | | [ ] |
| Surgical tape (25 mm) | 1 | | [ ] |
| Disposable resuscitation mouthpiece | 1 | | [ ] |
| Surgical scissors | 1 | | [ ] |
| Tweezers | 1 | | [ ] |
| Sterile disposable gloves (pairs) | 4 | | [ ] |
| Eye wash / saline solution | 1 | | [ ] |
| Safety pins | 12 | | [ ] |
| First Aid notes / instructions | 1 | | [ ] |
| First Aid Register and pen | 1 | | [ ] |

Items expiring within 3 months:
_______________________________________________________________________

Items replaced:
_______________________________________________________________________

Signature: ____________________
`,
  },
  {
    id: "chk-vehicle",
    type: "CHECKLIST",
    category: "Transport",
    title: "Vehicle Pre-Use Inspection Checklist",
    description: "Daily pre-trip vehicle inspection (LDV / truck / plant).",
    legalBasis: ["National Road Traffic Act", "Driven Machinery Regulations"],
    placeholders: [],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Vehicle Pre-Use Inspection Checklist") + `Driver: _______________________  Vehicle reg: _______________________  Date: _______________________
Odometer: _______________________  Time of inspection: _______________________

## Exterior
[ ] Tyres — tread depth, pressure, no cuts/bulges
[ ] Wheel nuts tight
[ ] Body — no damage affecting safety
[ ] Lights — head, tail, indicators, hazards, brake, reverse, fog
[ ] Windows / mirrors clean and intact
[ ] Number plates clean and legible
[ ] No fluid leaks under vehicle

## Engine Compartment (cold check)
[ ] Engine oil at correct level
[ ] Coolant at correct level
[ ] Brake fluid at correct level
[ ] Power steering fluid at correct level
[ ] Battery secure, terminals clean
[ ] Belts and hoses intact

## Interior
[ ] Seatbelts functional
[ ] Hooter / horn working
[ ] Wipers and washer operational
[ ] Dashboard warning lights clear once running
[ ] Brakes — pedal firm, parking brake holds
[ ] Steering — no excessive play

## Mandatory Equipment
[ ] Warning triangle / reflective triangles (2)
[ ] Fire extinguisher (where required)
[ ] First aid kit
[ ] Spare wheel inflated, jack and wheel-spanner
[ ] Reflective tape / chevrons (heavy vehicles)
[ ] Permits, licence disc, registration documents

## Driver Fitness
[ ] Driver licence valid for vehicle class
[ ] Driver well rested, not under influence
[ ] PrDP in date (if required)

## Defects

Defects found:
_______________________________________________________________________

Action: [ ] Repaired before use   [ ] Vehicle taken out of service   [ ] Acceptable to use with caution

Driver signature: ____________________
`,
  },
  {
    id: "chk-toolbox",
    type: "CHECKLIST",
    category: "Talk",
    title: "Toolbox Talk Attendance Register",
    description: "Attendance and acknowledgement sheet for safety briefings.",
    legalBasis: ["OHS Act Section 13", "Construction Regulations Reg 7(c)"],
    placeholders: ["{{SITE_NAME}}"],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Toolbox Talk Attendance Register") + `Site: {{SITE_NAME}}    Date: _______________________  Time: _______________________
Topic: _______________________________________________________________________
Presenter: _______________________  Duration (min): _______________________

## Key Messages Discussed

1. _________________________________________________________________________
2. _________________________________________________________________________
3. _________________________________________________________________________
4. _________________________________________________________________________
5. _________________________________________________________________________

## Hazards Covered

_________________________________________________________________________
_________________________________________________________________________

## Attendance — I confirm I attended and understood the content

| # | Name | Company | ID No | Signature |
|---|------|---------|-------|-----------|
| 1 |      |         |       |           |
| 2 |      |         |       |           |
| 3 |      |         |       |           |
| 4 |      |         |       |           |
| 5 |      |         |       |           |
| 6 |      |         |       |           |
| 7 |      |         |       |           |
| 8 |      |         |       |           |
| 9 |      |         |       |           |
| 10|      |         |       |           |
| 11|      |         |       |           |
| 12|      |         |       |           |
| 13|      |         |       |           |
| 14|      |         |       |           |
| 15|      |         |       |           |

Questions / concerns raised:
_______________________________________________________________________

Presenter signature: ____________________
`,
  },
  {
    id: "chk-heights",
    type: "CHECKLIST",
    category: "Heights",
    title: "Working at Heights Pre-Work Checklist",
    description: "Verification of fall protection before height work commences.",
    legalBasis: ["Construction Regulations Reg 10"],
    placeholders: ["{{SAFETY_OFFICER_NAME}}"],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Working at Heights Pre-Work Checklist") + `Date: _______________________  Time: _______________________
Workers names: _______________________________________________________________________
Task: _______________________________________________________________________
Height of work: _______________________  Duration: _______________________

## Documentation
[ ] Fall Protection Plan signed by competent person
[ ] Permit issued (work above 6m / roof / unprotected edge)
[ ] Risk assessment communicated to workers

## Worker Fitness & Training
[ ] All workers have valid annual medical certificate
[ ] All workers have current height-work training
[ ] No worker working alone

## Equipment Inspection
[ ] Harnesses inspected, log signed
[ ] Lanyards inspected, no deployment indicator activated
[ ] Connectors / snap-hooks functional
[ ] Equipment within manufacture / re-cert date

## Work Environment
[ ] Weather acceptable (wind <32 km/h, no storms)
[ ] Surface stable
[ ] Anchor points identified (rated ≥12 kN) and verified
[ ] Drop zone below cordoned off

## Fall Protection in Place
[ ] Guard rails (top, mid, toe) — preferred
[ ] Travel restraint set up — second preference
[ ] Fall arrest configured (harness, lanyard, anchor) — last resort

## Rescue
[ ] Rescue plan documented
[ ] Rescue equipment on site
[ ] Rescue team identified and briefed
[ ] Communications (radio / phone) tested

## Sign-Off

Permit issuer ({{SAFETY_OFFICER_NAME}}): ____________________   Time: ____________

Workers signature confirming understanding:
1. _________________________
2. _________________________
3. _________________________
4. _________________________

End of work confirmation (all clear, equipment retrieved): ____________________
`,
  },
  {
    id: "chk-electrical-tool",
    type: "CHECKLIST",
    category: "Tools",
    title: "Electrical Hand Tool Inspection",
    description: "Quarterly inspection of portable electrical tools.",
    legalBasis: ["Electrical Machinery Regulations Reg 9"],
    placeholders: [],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Electrical Hand Tool Inspection") + `Inspector: _______________________  Date: _______________________

| Tool # | Description | Serial / asset | Plug | Cable | Body | Switch | Guard | IR test (MΩ) | Earth (Ω) | Pass / Fail |
|--------|-------------|----------------|------|-------|------|--------|-------|--------------|-----------|-------------|
|        |             |                |      |       |      |        |       |              |           |             |
|        |             |                |      |       |      |        |       |              |           |             |
|        |             |                |      |       |      |        |       |              |           |             |
|        |             |                |      |       |      |        |       |              |           |             |
|        |             |                |      |       |      |        |       |              |           |             |

## Criteria each tool

[ ] Plug intact, no cracks, correct rating
[ ] Cable not damaged, sheath intact, no joins
[ ] Cable grip / strain relief secure at both ends
[ ] Body of tool not cracked, mountings tight
[ ] On/off switch functional, returns to off when released (trigger)
[ ] All guards in place and functional
[ ] Class II (double insulated) symbol present, or earth continuity OK (<1Ω)
[ ] Insulation resistance >1 MΩ at 500 V
[ ] No signs of overheating, no burnt smell
[ ] Identification / asset number visible

Failed tools removed from service: _______________________

Inspector signature: ____________________
`,
  },
];

// ============================================================================
// EMERGENCY PLANS
// ============================================================================
const EMERGENCY_PLANS: OhsTemplate[] = [
  {
    id: "emerg-master",
    type: "EMERGENCY_PLAN",
    category: "Master Plan",
    title: "Site Emergency Response Plan",
    description: "Master plan covering fire, medical, structural and environmental emergencies.",
    legalBasis: ["Environmental Regulations for Workplaces Reg 9"],
    placeholders: ["{{COMPANY_NAME}}", "{{SITE_NAME}}", "{{SITE_ADDRESS}}", "{{FIRE_MARSHAL_NAME}}", "{{FIRST_AIDER_NAME}}", "{{EMERGENCY_NUMBER}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Site Emergency Response Plan") + `## 1. Site Details

- **Site:** {{SITE_NAME}}
- **Address:** {{SITE_ADDRESS}}
- **Company:** {{COMPANY_NAME}}

## 2. Key Contacts

| Role | Name | Contact |
|------|------|---------|
| Fire Marshal | {{FIRE_MARSHAL_NAME}} |  |
| First Aider | {{FIRST_AIDER_NAME}} |  |
| Site emergency line | — | {{EMERGENCY_NUMBER}} |
| Fire / EMS national | — | 10177 |
| Police | — | 10111 |
| Mobile networks emergency | — | 112 |

## 3. Emergency Types Covered

- Fire / explosion
- Medical emergency (injury / sudden illness)
- Structural collapse / trench cave-in
- Hazardous material spill / gas release
- Severe weather (lightning, flooding, high wind)
- Bomb threat / armed intrusion
- Drowning / water rescue (where applicable)

## 4. General Response Sequence

1. **Recognise** — confirm the emergency.
2. **Raise alarm** — sound siren / call Fire Marshal / dial {{EMERGENCY_NUMBER}}.
3. **Protect** — only protect persons if safe; never enter danger zone unprotected.
4. **Evacuate** — follow Emergency Evacuation Procedure.
5. **Account** — roll call at assembly point.
6. **Inform** — Site Manager and EMS.
7. **Stand down** — only on instruction of Fire Marshal or EMS.

## 5. Fire / Explosion

- Activate fire alarm.
- Only attempt to fight fire if (a) trained, (b) fire is small, (c) safe egress is behind, (d) correct extinguisher available.
- Evacuate to assembly point if any doubt.
- Isolate utilities (gas, electricity) if safe to do so.

## 6. Medical Emergency

- Call {{FIRST_AIDER_NAME}}.
- Apply DRSABCD.
- Call EMS for serious injuries.
- Do not move casualty unless in further danger.
- Preserve scene for investigation.

## 7. Spill / Gas Release

- Evacuate all unprotected persons upwind.
- Isolate area, prevent ignition sources.
- Use spill kit only if trained and PPE adequate.
- Notify {{FIRE_MARSHAL_NAME}} and emergency services if uncontrolled.

## 8. Severe Weather

- Lightning: stop all outdoor work, evacuate scaffolds and roofs, take shelter in vehicles or buildings.
- High wind: stop crane and height operations >32 km/h.
- Flooding: evacuate low-lying areas, de-energise electrical equipment.

## 9. Drills & Training

- Full evacuation drill every 6 months.
- All workers inducted in this plan as part of site induction.
- Plan reviewed annually or after every actual emergency.
`,
  },
];

// ============================================================================
// LEGAL APPOINTMENT LETTERS
// ============================================================================
const LEGAL_APPOINTMENTS: OhsTemplate[] = [
  {
    id: "leg-16-2",
    type: "LEGAL_APPOINTMENT",
    category: "Section 16",
    title: "Section 16(2) Appointment — OHS Act",
    description: "CEO's written assignment of duties under Section 16(2) of the OHS Act.",
    legalBasis: ["OHS Act Section 16(2)"],
    placeholders: ["{{COMPANY_NAME}}", "{{CEO_NAME}}", "{{CEO_TITLE}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Section 16(2) Appointment") + `## Letter of Appointment in terms of Section 16(2) of the Occupational Health & Safety Act 85 of 1993

To: __________________________________ (Appointee full name)
ID No: __________________________________
Position: __________________________________

I, {{CEO_NAME}}, in my capacity as {{CEO_TITLE}} and Chief Executive Officer of {{COMPANY_NAME}}, in terms of Section 16(2) of the Occupational Health and Safety Act, 85 of 1993, hereby assign to you the duties imposed on me by Section 16(1) of the Act in respect of the following undertaking / portion of the undertaking:

_______________________________________________________________________

These duties include, but are not limited to:

- Ensuring that the requirements of the OHS Act and Regulations are complied with.
- Ensuring that competent persons are appointed where required by the Regulations.
- Ensuring that adequate financial provision is made for OHS matters.
- Ensuring that hazard identification and risk assessments are conducted and acted upon.
- Reporting incidents to the Department of Employment & Labour as required by Section 24.
- Convening and chairing the Health & Safety Committee.
- Ensuring that all employees are trained and informed of hazards.

You will report to me on a monthly basis or sooner should circumstances warrant. This appointment is effective from {{EFFECTIVE_DATE}} and remains in force until withdrawn in writing.

## Acceptance

I, the undersigned, accept the appointment and acknowledge the responsibilities placed on me. I confirm I am competent to undertake these duties.

Appointee signature: ____________________   Date: ____________________

## Appointed by

{{CEO_NAME}}
{{CEO_TITLE}}
{{COMPANY_NAME}}

Signature: ____________________   Date: ____________________
`,
  },
  {
    id: "leg-construction-supervisor",
    type: "LEGAL_APPOINTMENT",
    category: "Construction Reg 8(1)",
    title: "Construction Supervisor Appointment — Reg 8(1)",
    description: "Written appointment of a competent construction supervisor on every site.",
    legalBasis: ["Construction Regulations 2014, Reg 8(1)"],
    placeholders: ["{{COMPANY_NAME}}", "{{SITE_NAME}}", "{{CEO_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Construction Supervisor Appointment — Reg 8(1)") + `## Letter of Appointment in terms of Regulation 8(1) of the Construction Regulations, 2014

To: __________________________________ (Appointee full name)
ID No: __________________________________
Qualifications: __________________________________
Experience: __________________________________

In terms of Regulation 8(1) of the Construction Regulations, 2014 promulgated under the OHS Act, you are hereby appointed as the Construction Supervisor for the following construction work / site:

Site: {{SITE_NAME}}
Project: _______________________________________________________________________

Your duties include:

- Supervising the construction work at all times and ensuring it is carried out in compliance with the Act and Regulations.
- Implementing the health and safety plan agreed with the client.
- Performing daily site inspections (Reg 9) and recording findings.
- Identifying hazards and risks and ensuring controls are in place.
- Ensuring competent subordinate supervisors are appointed (Reg 8(7)) for sections of the work.
- Ensuring all workers are inducted and trained.
- Investigating incidents and implementing corrective actions.
- Stopping any work that poses immediate risk.

This appointment is effective {{EFFECTIVE_DATE}} for the duration of the works unless withdrawn in writing.

## Acceptance

Appointee signature: ____________________   Date: ____________________

## Appointed by

{{CEO_NAME}}
For and on behalf of {{COMPANY_NAME}}

Signature: ____________________   Date: ____________________
`,
  },
  {
    id: "leg-first-aider",
    type: "LEGAL_APPOINTMENT",
    category: "GSR 3",
    title: "First Aider Appointment — GSR 3",
    description: "Appointment of the qualified First Aider.",
    legalBasis: ["General Safety Regulations Reg 3"],
    placeholders: ["{{COMPANY_NAME}}", "{{CEO_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "First Aider Appointment — GSR 3") + `## Letter of Appointment as First Aider

To: __________________________________ (Appointee full name)
ID No: __________________________________
First Aid Certificate: __________________________________ (Provider, Level, Expiry)

In terms of Regulation 3 of the General Safety Regulations promulgated under the Occupational Health and Safety Act, 85 of 1993, you are hereby appointed as a First Aider at:

Site / Department: _______________________________________________________________________

Your duties include:

- Rendering first aid treatment to injured or ill persons at the workplace.
- Maintaining the First Aid Box stock and condition.
- Maintaining the First Aid Treatment Register.
- Notifying the Safety Officer of all treatments and arranging follow-up care where required.
- Keeping your First Aid qualification current.

This appointment is effective {{EFFECTIVE_DATE}} and remains valid for as long as your First Aid certificate is current.

## Acceptance

Appointee signature: ____________________   Date: ____________________

## Appointed by

{{CEO_NAME}}
For and on behalf of {{COMPANY_NAME}}

Signature: ____________________   Date: ____________________
`,
  },
  {
    id: "leg-fire-marshal",
    type: "LEGAL_APPOINTMENT",
    category: "Emergency",
    title: "Fire Marshal / Emergency Coordinator Appointment",
    description: "Written appointment of the site Fire Marshal.",
    legalBasis: ["Environmental Regulations for Workplaces Reg 9"],
    placeholders: ["{{COMPANY_NAME}}", "{{SITE_NAME}}", "{{CEO_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Fire Marshal / Emergency Coordinator Appointment") + `## Letter of Appointment as Fire Marshal & Emergency Coordinator

To: __________________________________ (Appointee full name)
ID No: __________________________________
Training: __________________________________

In terms of Regulation 9 of the Environmental Regulations for Workplaces and the Site Emergency Response Plan of {{COMPANY_NAME}}, you are hereby appointed as the Fire Marshal and Emergency Coordinator at:

Site: {{SITE_NAME}}

Your duties include:

- Coordinating evacuations in the event of any emergency.
- Issuing Hot Work Permits.
- Ensuring all fire fighting equipment is inspected monthly.
- Conducting evacuation drills at least every 6 months.
- Performing roll calls at the assembly point.
- Liaising with emergency services.

This appointment is effective {{EFFECTIVE_DATE}}.

## Acceptance

Appointee signature: ____________________   Date: ____________________

## Appointed by

{{CEO_NAME}}
For and on behalf of {{COMPANY_NAME}}

Signature: ____________________   Date: ____________________
`,
  },
];

// ============================================================================
// EXPORT
// ============================================================================
export const OHS_TEMPLATES: OhsTemplate[] = [
  ...POLICIES,
  ...PROCEDURES,
  ...CHECKLISTS,
  ...EMERGENCY_PLANS,
  ...LEGAL_APPOINTMENTS,
];

export const OHS_TEMPLATE_CATEGORIES = [
  { type: "POLICY", label: "Policies", count: POLICIES.length },
  { type: "PROCEDURE", label: "Procedures", count: PROCEDURES.length },
  { type: "CHECKLIST", label: "Checklists", count: CHECKLISTS.length },
  { type: "EMERGENCY_PLAN", label: "Emergency Plans", count: EMERGENCY_PLANS.length },
  { type: "LEGAL_APPOINTMENT", label: "Legal Appointments", count: LEGAL_APPOINTMENTS.length },
];

/**
 * Substitute placeholders in content with provided values.
 * Placeholders not in values map are left as-is so the user can spot them.
 */
export function substitutePlaceholders(content: string, values: Record<string, string>): string {
  let out = content;
  for (const [k, v] of Object.entries(values)) {
    if (v) {
      const pattern = new RegExp(k.replace(/[{}]/g, "\\$&"), "g");
      out = out.replace(pattern, v);
    }
  }
  return out;
}

/**
 * Extract all {{PLACEHOLDER}} tokens from content.
 */
export function extractPlaceholders(content: string): string[] {
  const matches = content.match(/\{\{[A-Z_]+\}\}/g) || [];
  return Array.from(new Set(matches));
}
