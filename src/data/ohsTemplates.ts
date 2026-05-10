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
 *  - Lines starting with "# "  â†’ H1 heading
 *  - Lines starting with "## " â†’ H2 section heading
 *  - Lines starting with "### "â†’ H3 subsection heading
 *  - Lines starting with "- "  â†’ bulleted list item
 *  - Lines starting with "[ ]" â†’ checklist item (unchecked box in PDF)
 *  - Lines starting with "[x]" â†’ checklist item (ticked box in PDF)
 *  - Blank lines              â†’ paragraph break
 *  - Anything else            â†’ paragraph text (wraps)
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

| Field | Detail |
|-------|--------|
| Document title | {{TITLE}} |
| Document number | OHS / {{COMPANY_REG_NO}} / [auto] |
| Version | 1.0 |
| Status | Approved & Issued |
| Classification | Internal â€” Controlled Document |
| Issued by | {{COMPANY_NAME}} (Reg: {{COMPANY_REG_NO}}) |
| Site / project | {{SITE_NAME}} â€” {{PROJECT_NAME}} |
| Client | {{CLIENT_NAME}} |
| Compiled by | {{SAFETY_OFFICER_NAME}} (SACPCMP / Registered SHE Practitioner) |
| Reviewed by | Health & Safety Committee |
| Approved by | {{CEO_NAME}}, {{CEO_TITLE}} (16(1) Accountable Officer) |
| Effective date | {{EFFECTIVE_DATE}} |
| Next review date | {{REVIEW_DATE}} (annual, or sooner if legislation, scope or risk profile changes) |

### Revision History

| Rev | Date | Author | Description of change | Approved |
|-----|------|--------|-----------------------|----------|
| 1.0 | {{EFFECTIVE_DATE}} | {{SAFETY_OFFICER_NAME}} | Initial issue | {{CEO_NAME}} |
|     |      |        |                       |          |
|     |      |        |                       |          |

### Distribution List (Controlled Copies)

- Section 16(1) Accountable Officer ({{CEO_NAME}})
- Section 16(2) Appointee
- Safety, Health & Environment Manager / SHE File master copy
- Site Manager / Construction Supervisor (Reg 8(1))
- Health & Safety Committee Chair (Section 19)
- Trained Health & Safety Representatives (Section 17)
- Site notice boards (extracted abstract)
- Department of Employment & Labour Inspector (on request)
- Client representative / Principal Contractor

Uncontrolled copies (e.g. print-outs, intranet downloads) are valid only on the day of printing.

### Related Documents

- OHS Policy (pol-ohs-master)
- Baseline Hazard Identification & Risk Assessment (HIRA)
- Construction Health & Safety Plan (Reg 7 / Reg 5(1)(b))
- Site Health & Safety File (Reg 7(1)(b))
- All applicable Safe Work Procedures (SWPs) and Method Statements
- Permit-to-Work register
- Incident, Injury, Near-Miss & Occupational Disease Register
- COIDA W.Cl.2, W.Cl.6A, W.Cl.22 forms

### Legislative Framework (non-exhaustive)

This document is issued in compliance with:

- Occupational Health and Safety Act, 85 of 1993 (the "Act")
- Construction Regulations, 2014 (GN R.84 in GG 37305 of 7 Feb 2014)
- General Administrative Regulations, 2003
- General Safety Regulations, 1986
- General Machinery Regulations, 1988
- Driven Machinery Regulations, 2015
- Electrical Installation Regulations, 2009 and Electrical Machinery Regulations, 2011
- Environmental Regulations for Workplaces, 1987
- Hazardous Chemical Substances Regulations, 1995 (amended)
- Hazardous Biological Agents Regulations, 2022
- Noise-Induced Hearing Loss Regulations, 2003
- Lead Regulations / Asbestos Abatement Regulations, 2020
- Facilities Regulations, 2004
- Ergonomics Regulations, 2019
- Major Hazard Installation Regulations, 2001
- Compensation for Occupational Injuries and Diseases Act, 130 of 1993 (COIDA)
- National Environmental Management Act, 107 of 1998 (NEMA)
- National Building Regulations & Building Standards Act, 103 of 1977
- SANS 1200 series (construction), SANS 10142 (electrical), SANS 10400 (building), SANS 10085 (scaffolding), SANS 1475 (extinguishers), SANS 50361 (harnesses), SANS 10238 (welding), SANS 10231 (transport of dangerous goods), SANS 31000 (risk management), ISO 45001:2018.

### Definitions

Unless inconsistent with the context, words and expressions used in this document bear the meanings assigned to them in Section 1 of the Occupational Health and Safety Act, 85 of 1993, and:

- **"Competent person"** â€” a person who has the knowledge, training, experience and qualifications specific to the work being performed (Construction Regulations, 2014, Reg 1).
- **"Hazard"** â€” a source of or exposure to danger.
- **"Risk"** â€” the probability that injury, harm or loss will occur.
- **"Reasonably practicable"** â€” having regard to (a) severity & scope of hazard, (b) state of knowledge of the hazard & means of controlling it, (c) availability and suitability of means to remove or control it, (d) the cost of removing or controlling it relative to the benefit (Section 1).
- **"Section 24 Incident"** â€” an incident in which any person dies, becomes unconscious, suffers loss of limb or part of a limb, or is otherwise injured or becomes ill to such a degree that he/she is likely either to die or suffer a permanent physical defect or be unable to work for 14 days or longer; or where any major incident occurred; or where the health or safety of any person was endangered.

`;

const STANDARD_FOOTER = `
## Training & Competence

All persons performing duties under this document must be:

- Inducted and briefed on its content (record on Site Induction Register, retained 3 years).
- Trained to the relevant competency standard by an accredited provider (Department of Employment & Labour-approved or QCTO/SETA-accredited):
  - General OHS Induction â€” minimum NQF Level 2 equivalent.
  - First Aid Level 1, 2 or 3 (DoEL-approved provider).
  - Fire Fighting â€” Basic / Intermediate (SAQA Unit Std 252250 or equiv).
  - Working at Heights â€” Basic User / Inspector / Rescuer (SAQA Unit Std 229998).
  - Risk Assessment â€” Construction Reg 9 (SAQA Unit Std 244287).
  - Construction Supervisor â€” minimum NQF Level 5 (SAMTRAC or equivalent).
  - SHE Practitioner â€” SACPCMP-registered (CHSO, CHSM, CHSA categories).
- Re-assessed annually for high-risk work (heights, confined spaces, hazardous chemicals, electrical, hoists, cranes, scaffolding).
- Recorded on the Training & Competence Matrix retained for the lifetime of employment + 5 years.

## Performance Monitoring & KPIs

Implementation of this document is measured by:

- Lost-Time Injury Frequency Rate (LTIFR) per 200 000 hours worked.
- Total Recordable Injury Frequency Rate (TRIFR).
- Number of Section 24 reportable incidents (target: zero).
- Internal SHE audits (monthly site, quarterly system) â€” minimum 90% compliance.
- External / client audits â€” pass at first review.
- Training compliance % (target â‰¥98%).
- Near-miss reports per 100 workers per month (target â‰¥5 â€” indicates a healthy reporting culture).
- Corrective-action close-out rate within agreed timelines (target â‰¥95%).

## Records & Retention

| Record | Minimum retention | Authority |
|--------|------------------|-----------|
| Risk assessments | 3 years (life of project if longer) | Construction Reg 9 |
| Incident register & investigation reports | 4 years (40 years for occupational disease) | GAR 8 / COIDA |
| Training records | Lifetime of employment + 5 years | OHS Act Sec 8 |
| Medical surveillance records | 40 years | HCS Regs / Noise Regs |
| Inspection registers (plant, scaffold, electrical, lifting) | 3 years | Construction Regs |
| Permits to work | 3 years | Internal best practice |
| Section 16(2), 17, 19 appointments | Duration of appointment + 5 years | OHS Act |

## Non-Compliance & Penalties

Failure to comply with this document may result in:

- **Internal:** Disciplinary action up to and including dismissal in line with the Company Disciplinary Code and Section 14 of the Act.
- **Statutory:** Prohibition or contravention notices issued by a DoEL inspector under Sections 29 / 30; criminal prosecution under Section 38 carrying fines of up to R100 000 and/or imprisonment of up to two years for first-time offenders, and up to R200 000 and/or four years for repeat offences (or higher under the Construction Regulations).
- **Civil:** Personal liability under Section 37 (vicarious liability) of the Act and common-law delictual claims by injured parties.
- **COIDA:** Increased assessment rates and recovery of compensation paid where the employer was negligent (Section 56).

## Review & Continuous Improvement

This document shall be reviewed:

- At least annually from the effective date.
- After any Section 24 incident or significant near-miss.
- When legislation, SANS standards, technology, scope of work or organisational structure changes.
- When internal or external audits identify gaps.

## Approval & Sign-Off

**Compiled and recommended by:**

Name: {{SAFETY_OFFICER_NAME}}
Designation: Safety, Health & Environmental Practitioner (SACPCMP / Reg. SHE Practitioner)
Signature: _______________________________   Date: _______________________

**Reviewed by Health & Safety Committee (Section 19):**

Chairperson: _______________________________   Signature: _______________________   Date: _______________________

**Approved and issued by Accountable Officer (Section 16(1) of the OHS Act 85 of 1993):**

Name: {{CEO_NAME}}
Designation: {{CEO_TITLE}}
For and on behalf of {{COMPANY_NAME}} (Reg: {{COMPANY_REG_NO}})
Signature: _______________________________   Date: _______________________

â€” End of controlled document â€”
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
` + STANDARD_FOOTER,
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
- Hard hat (SANS 1397) â€” replaced every 3 years or on impact.
- Safety boots with steel toe and midsole (SANS 20345 S3).
- High-visibility vest (Class 2 minimum, SANS 1387).

## 4. Task-Specific PPE

Issued based on risk assessment:
- **Working at heights (>2m):** Full body harness with double lanyard and shock absorber (SANS 50361), inspected before each use.
- **Electrical work:** Insulated gloves rated to circuit voltage, arc-rated clothing, dielectric boots.
- **Welding / hot work:** Welding helmet (shade per process), leather apron, fire-resistant gloves and sleeves, respirator if galvanised material.
- **Chemicals:** Splash goggles, chemical-resistant gloves matched to substance per MSDS, apron or coverall.
- **Dust / silica / spray:** P2 / P3 respirator with fit-test; powered air respirator for prolonged exposure.
- **Noise (>85 dB):** Hearing protection (ear plugs SNR â‰¥25 dB or muffs).
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
` + STANDARD_FOOTER,
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
` + STANDARD_FOOTER,
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
` + STANDARD_FOOTER,
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
` + STANDARD_FOOTER,
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
` + STANDARD_FOOTER,
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
1. **Eliminate** â€” design work to be done at ground level.
2. **Passive** â€” guard rails (top rail 1mâ€“1.1m, mid-rail, toe-board), covered openings.
3. **Travel restraint** â€” harness and lanyard set short to prevent reaching the edge.
4. **Fall arrest** â€” full body harness, double lanyard with shock absorber, certified anchor (rated â‰¥12 kN), rescue plan.

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
` + STANDARD_FOOTER,
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
` + STANDARD_FOOTER,
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
` + STANDARD_FOOTER,
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

- **Incident** â€” any unplanned event resulting in or having the potential to result in injury, ill-health, damage or other loss.
- **Near-miss** â€” incident without injury or damage, but with the potential for either.
- **Section 24 incident** â€” fatality, permanent disablement, lost time injury exceeding 14 days, dangerous occurrence or unconsciousness from substance exposure.

## 3. Immediate Actions

When an incident occurs:
1. Make the area safe â€” do not move injured persons unless they are in further danger.
2. Render first aid; call EMS (10177 / 112) if injuries are serious.
3. Notify the supervisor and {{SAFETY_OFFICER_NAME}} ({{SAFETY_OFFICER_CONTACT}}) immediately.
4. Preserve the scene â€” do not disturb equipment or evidence until released by the Safety Officer or DoEL inspector.
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
` + STANDARD_FOOTER,
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
1. Raise the alarm â€” break the nearest manual call point or sound the air-horn / siren.
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

The Fire Marshal performs a roll call against the site sign-in register. Any missing persons are reported to the emergency services â€” workers do not re-enter the building.

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
` + STANDARD_FOOTER,
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

1. **Prepare** â€” identify all energy sources (electrical, mechanical, hydraulic, pneumatic, thermal, chemical, gravity, stored).
2. **Notify** â€” inform all affected workers.
3. **Shut down** â€” switch off equipment using normal stop controls.
4. **Isolate** â€” disconnect the energy source at the isolator. For multiple sources isolate all.
5. **Lock and Tag** â€” each affected worker applies their own padlock and tag to the isolator. The tag identifies the worker, date and reason.
6. **Verify zero energy** â€” attempt to start the equipment with the normal start button. Test for residual energy with the appropriate meter. Bleed residual hydraulic, pneumatic or stored gravitational energy.

## 4. Multiple Workers

When multiple workers are involved each applies their personal lock. A group lockout box or multi-lock hasp is used. The equipment cannot be re-energised until every worker has removed their lock.

## 5. Restoring Energy

1. Tools and parts removed from machine.
2. Guards refitted.
3. All workers clear of danger zone.
4. Each worker removes their own lock and tag â€” no one else may remove a worker's lock except after written authorisation by the responsible manager and only after confirming the worker is safe.
5. Notify affected workers.
6. Operate equipment cautiously and verify safe operation.

## 6. Records

Every LOTO event is logged in the LOTO register including equipment, date, time, energy sources isolated, workers and verification.
` + STANDARD_FOOTER,
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
- Pain killers â€” NOT to be in the kit; only administered if the worker self-administers their own.

## 3. On Discovering an Injured Person

1. DRSABCD: Danger / Response / Send for help / Airway / Breathing / CPR / Defibrillator.
2. Call {{FIRST_AIDER_NAME}}. For serious injury also call EMS on {{EMERGENCY_NUMBER}} or 10177.
3. Do not move the casualty unless in further danger.
4. Stop bleeding with direct pressure.
5. Treat for shock â€” keep warm.
6. Reassure and stay with the casualty until help arrives.

## 4. Treatment Records

Every treatment, however minor, is recorded in the First Aid Register (legal requirement). The record includes date, time, name of casualty, nature of injury, treatment given and First Aider's signature.

## 5. Stock Control

The First Aid Box is checked monthly. Used items are replaced immediately. Expired items are removed and replaced.
` + STANDARD_FOOTER,
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
- Atmospheric testing in this order: oxygen (19.5%â€“23%), flammables (<10% LEL), toxics (CO, H2S, others as relevant).
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

- On any gas alarm, communications failure, casualty or unplanned event â€” evacuate immediately.
- Standby person calls for emergency rescue; rescue is performed using the retrieval system from outside the space wherever possible.
- Entry-rescue by other workers without breathing apparatus is strictly prohibited.

## 6. Close Out

After completion:
- All workers and equipment accounted for.
- Space closed and signage updated.
- Permit signed off and filed.
` + STANDARD_FOOTER,
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
- Test before touch â€” use a known-good voltage tester before and after testing the circuit.
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
` + STANDARD_FOOTER,
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
[ ] Spoil â‰¥1m from edge
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
` + STANDARD_FOOTER,
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
[ ] Sole tread depth â‰¥3mm, no separation
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
` + STANDARD_FOOTER,
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
[ ] Mid-rail and top rail (1mâ€“1.1m) fitted

## Access
[ ] Internal ladder access tied at top
[ ] Ladder extends 1m above platform
[ ] Trap-door hatches functional

## Loading
[ ] Loading not exceeding rated duty (light/medium/heavy)
[ ] Materials evenly distributed
[ ] No stacked materials above mid-rail height

## Tagging
[ ] Green tag â€” safe for use
[ ] Yellow tag â€” restricted use, conditions stated
[ ] Red tag â€” incomplete, no access
[ ] Tag updated with inspector name and date

## Mobile Scaffolds (extra)
[ ] Wheels locked when in use
[ ] No riders during movement
[ ] Height-to-base ratio safe (3:1 outdoors, 4:1 indoors)
[ ] Outriggers deployed if required

## Result

[ ] PASS â€” green tag fitted
[ ] PASS WITH REMEDY â€” actions listed below
[ ] FAIL â€” red tag fitted, no access

Required actions:
_______________________________________________________________________

Inspector signature: ____________________  Next inspection due: ____________________
` + STANDARD_FOOTER,
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

## Inspection criteria â€” each extinguisher

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
` + STANDARD_FOOTER,
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
` + STANDARD_FOOTER,
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
[ ] Tyres â€” tread depth, pressure, no cuts/bulges
[ ] Wheel nuts tight
[ ] Body â€” no damage affecting safety
[ ] Lights â€” head, tail, indicators, hazards, brake, reverse, fog
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
[ ] Brakes â€” pedal firm, parking brake holds
[ ] Steering â€” no excessive play

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
` + STANDARD_FOOTER,
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

## Attendance â€” I confirm I attended and understood the content

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
` + STANDARD_FOOTER,
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
[ ] Anchor points identified (rated â‰¥12 kN) and verified
[ ] Drop zone below cordoned off

## Fall Protection in Place
[ ] Guard rails (top, mid, toe) â€” preferred
[ ] Travel restraint set up â€” second preference
[ ] Fall arrest configured (harness, lanyard, anchor) â€” last resort

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
` + STANDARD_FOOTER,
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

| Tool # | Description | Serial / asset | Plug | Cable | Body | Switch | Guard | IR test (MÎ©) | Earth (Î©) | Pass / Fail |
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
[ ] Class II (double insulated) symbol present, or earth continuity OK (<1Î©)
[ ] Insulation resistance >1 MÎ© at 500 V
[ ] No signs of overheating, no burnt smell
[ ] Identification / asset number visible

Failed tools removed from service: _______________________

Inspector signature: ____________________
` + STANDARD_FOOTER,
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
| Site emergency line | â€” | {{EMERGENCY_NUMBER}} |
| Fire / EMS national | â€” | 10177 |
| Police | â€” | 10111 |
| Mobile networks emergency | â€” | 112 |

## 3. Emergency Types Covered

- Fire / explosion
- Medical emergency (injury / sudden illness)
- Structural collapse / trench cave-in
- Hazardous material spill / gas release
- Severe weather (lightning, flooding, high wind)
- Bomb threat / armed intrusion
- Drowning / water rescue (where applicable)

## 4. General Response Sequence

1. **Recognise** â€” confirm the emergency.
2. **Raise alarm** â€” sound siren / call Fire Marshal / dial {{EMERGENCY_NUMBER}}.
3. **Protect** â€” only protect persons if safe; never enter danger zone unprotected.
4. **Evacuate** â€” follow Emergency Evacuation Procedure.
5. **Account** â€” roll call at assembly point.
6. **Inform** â€” Site Manager and EMS.
7. **Stand down** â€” only on instruction of Fire Marshal or EMS.

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
` + STANDARD_FOOTER,
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
    title: "Section 16(2) Appointment â€” OHS Act",
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
` + STANDARD_FOOTER,
  },
  {
    id: "leg-construction-supervisor",
    type: "LEGAL_APPOINTMENT",
    category: "Construction Reg 8(1)",
    title: "Construction Supervisor Appointment â€” Reg 8(1)",
    description: "Written appointment of a competent construction supervisor on every site.",
    legalBasis: ["Construction Regulations 2014, Reg 8(1)"],
    placeholders: ["{{COMPANY_NAME}}", "{{SITE_NAME}}", "{{CEO_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Construction Supervisor Appointment â€” Reg 8(1)") + `## Letter of Appointment in terms of Regulation 8(1) of the Construction Regulations, 2014

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
` + STANDARD_FOOTER,
  },
  {
    id: "leg-first-aider",
    type: "LEGAL_APPOINTMENT",
    category: "GSR 3",
    title: "First Aider Appointment â€” GSR 3",
    description: "Appointment of the qualified First Aider.",
    legalBasis: ["General Safety Regulations Reg 3"],
    placeholders: ["{{COMPANY_NAME}}", "{{CEO_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "First Aider Appointment â€” GSR 3") + `## Letter of Appointment as First Aider

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
` + STANDARD_FOOTER,
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
` + STANDARD_FOOTER,
  },
];

// ============================================================================
// ADVANCED SPECIALIST TEMPLATES
// ============================================================================
const ADVANCED: OhsTemplate[] = [
  {
    id: "ra-baseline-hira",
    type: "PROCEDURE",
    category: "Risk Assessment",
    title: "Baseline Hazard Identification & Risk Assessment (HIRA)",
    description: "Site-wide baseline HIRA aligned with Construction Reg 9 and SANS 31000.",
    legalBasis: [
      "Construction Regulations 2014, Reg 9",
      "OHS Act Section 8(2)(d)",
      "SANS 31000:2018",
      "ISO 45001:2018 Clause 6.1.2",
    ],
    placeholders: ["{{COMPANY_NAME}}", "{{SITE_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Baseline Hazard Identification & Risk Assessment (HIRA)") + `## 1. Purpose & Scope

This baseline HIRA establishes the hazards, risks and controls applicable to the construction activities, persons, plant, materials and environment at {{SITE_NAME}}. It is the parent document from which all task-specific Job Safety Analyses (JSAs), Safe Work Procedures (SWPs) and Method Statements derive their controls.

It is conducted by a competent person ({{SAFETY_OFFICER_NAME}}, SACPCMP-registered) in consultation with the Health & Safety Committee, the design team, sub-contractors and elected H&S Representatives in accordance with Construction Regulation 9 read with Section 8(2)(d) of the OHS Act.

## 2. Methodology

The methodology follows SANS 31000:2018 / ISO 45001:2018 and consists of:

1. **Establish context** — scope, stakeholders, legal & other requirements.
2. **Hazard identification** — site walk-down, design review, historical incident data, OEM manuals, MSDSs, public consultation.
3. **Risk analysis** — likelihood × consequence (see matrix § 4).
4. **Risk evaluation** — compare to risk acceptance criteria.
5. **Risk treatment** — apply the Hierarchy of Control (§ 5).
6. **Monitor & review** — quarterly and after any change, incident or near-miss.
7. **Communicate & consult** — record on Risk Register; brief workers via toolbox talks.

## 3. Risk Acceptance Criteria

| Residual Risk | Action |
|---------------|--------|
| Low (1–4) | Acceptable. Manage by routine procedure. |
| Medium (5–9) | Tolerable only with documented controls, supervisor sign-off and monitoring. |
| High (10–15) | Not tolerable. Additional controls mandatory before work proceeds. Senior Manager sign-off. |
| Very High / Critical (16–25) | Work prohibited until risk reduced to High or lower. Stop-work authority enforced. |

## 4. Risk Matrix (Likelihood × Consequence)

**Likelihood (L)** — 1 Rare · 2 Unlikely · 3 Possible · 4 Likely · 5 Almost certain
**Consequence (C)** — 1 Negligible · 2 Minor first aid · 3 LTI / medical case · 4 Major / permanent disability · 5 Fatality / multiple fatalities / catastrophic

Risk Rating = L × C

|       | C1 | C2 | C3 | C4 | C5 |
|-------|----|----|----|----|----|
| **L5**| 5  | 10 | 15 | 20 | 25 |
| **L4**| 4  | 8  | 12 | 16 | 20 |
| **L3**| 3  | 6  | 9  | 12 | 15 |
| **L2**| 2  | 4  | 6  | 8  | 10 |
| **L1**| 1  | 2  | 3  | 4  | 5  |

## 5. Hierarchy of Control (mandatory order)

1. **Eliminate** the hazard at source (re-design).
2. **Substitute** with a less hazardous material / process.
3. **Engineering controls** (guards, ventilation, isolation, edge protection).
4. **Administrative controls** (procedures, permits, training, rotation, signage).
5. **Personal Protective Equipment** — last line of defence only.

PPE alone is not an acceptable primary control where a higher-order control is reasonably practicable.

## 6. Site Hazard Register (extract — to be fully populated per site)

| Activity / Area | Hazard | Affected persons | Inherent Risk (L×C) | Controls (Hierarchy) | Residual Risk | Owner | Verification |
|-----------------|--------|------------------|---------------------|----------------------|---------------|-------|--------------|
| Excavation > 1.5 m | Cave-in, engulfment, services strike | Excavator team, public | 5×5 = 25 | Shoring / battering, daily inspection (Reg 13), CAT scan, permit, barriers | 3 | Construction Supervisor | Daily Reg 13 inspection log |
| Working at heights > 2 m | Fall, dropped object | Roofers, scaffolders, public below | 4×5 = 20 | Edge protection, harness + lanyard, FPP, anchor ≥12 kN, exclusion zone | 4 | Heights Supervisor | Reg 10 register |
| Hot work (welding/cutting) | Fire, burns, fume inhalation | Welder, neighbouring workers | 4×4 = 16 | Permit, fire watch, screens, LEV, FR PPE | 4 | Fire Marshal | Hot Work Permit |
| Electrical work | Shock, arc-flash, electrocution | Electricians, others | 3×5 = 15 | LOTO, test-before-touch, insulated tools, RCD, competent person | 3 | Competent Person | LOTO register |
| Confined space entry | Asphyxiation, toxic exposure, engulfment | Entrants, attendant | 4×5 = 20 | Permit, atmospheric testing, ventilation, harness + tripod, standby | 4 | Safety Officer | CSE Permit |
| Crane / lifting operations | Load drop, overturning | Riggers, slingers, banksmen | 3×5 = 15 | Lift plan, competent operator, daily inspection, tag-line, exclusion | 3 | Lifting Supervisor | Lifting register |
| Plant movement (excavator, TLB, dumper) | Person struck | All site personnel | 4×4 = 16 | Segregation, banksman, reversing alarms, exclusion zones, PPE hi-vis | 4 | Plant Supervisor | Plant log |
| Manual handling | MSD, back injury | Labourers | 4×3 = 12 | Mechanical aids, team lift, training, weight limits, rotation | 4 | Supervisor | Ergo assessments |
| Noise > 85 dB(A) TWA | NIHL | Operators near plant | 4×3 = 12 | Eng. controls, hearing protection, audiometry, exposure zones | 4 | Occ. Hygienist | Noise survey |
| Silica / dust | Silicosis, lung disease | Cutters, demolishers | 3×4 = 12 | Wet cutting, LEV, P3 respirator with fit-test, med surveillance | 4 | Occ. Hygienist | Dust survey |
| Hazardous chemicals (paints, solvents, fuel) | Fire, toxic exposure, env. damage | Painters, fuel handlers | 3×4 = 12 | MSDS, ventilation, PPE, bunding, spill kit, segregation | 4 | Safety Officer | HCS register |
| Public interface | Person struck, falling object | Public | 3×5 = 15 | Hoarding, signage, traffic management, fan / catch platform | 3 | Site Manager | Daily inspection |
| Severe weather (lightning, wind, heat) | Multiple | All | 3×4 = 12 | Weather monitoring, stop-work triggers, hydration, shelter | 4 | Site Manager | Weather log |

This register is **a living document**. Every change in scope, plant, materials, contractor or following any incident requires re-assessment.

## 7. Risk Communication & Worker Involvement

- Register filed in the Site H&S File (Reg 7(1)(b)) and the SHE Office.
- Top 10 risks displayed on the site notice board in English plus dominant local language.
- Communicated at site induction, daily toolbox talks (15 min minimum) and weekly safety meetings.
- Workers entitled and required to raise newly-identified hazards on the Hazard Report Card; cards reviewed at the next H&S Committee meeting.

## 8. Linkage to Task-Level Documents

This baseline HIRA feeds:

- Job Safety Analyses (JSA / JHA) for each task.
- Safe Work Procedures (SWPs) per activity.
- Method Statements per contractor scope.
- Permits-to-Work (heights, hot work, confined space, electrical, excavation, lifting).
- Emergency Response Plan trigger thresholds.

` + STANDARD_FOOTER,
  },
  {
    id: "pol-hs-plan-reg7",
    type: "POLICY",
    category: "Construction Plan",
    title: "Construction Health & Safety Plan (Reg 7)",
    description: "Site-specific Contractor's H&S Plan required by Construction Regulation 7.",
    legalBasis: [
      "Construction Regulations 2014, Reg 5(1)(b) and Reg 7",
      "OHS Act Section 8 and 37",
    ],
    placeholders: [
      "{{COMPANY_NAME}}",
      "{{SITE_NAME}}",
      "{{CLIENT_NAME}}",
      "{{CEO_NAME}}",
      "{{SAFETY_OFFICER_NAME}}",
    ],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Construction Health & Safety Plan (Reg 7)") + `## 1. Purpose

This Construction Health & Safety Plan is prepared by {{COMPANY_NAME}} as Principal Contractor / Contractor for {{SITE_NAME}} on instruction of {{CLIENT_NAME}} in compliance with Regulation 7 of the Construction Regulations, 2014 read with the Client's Health & Safety Specification (Reg 5(1)(b)).

It is the implementation document for OHS on site and must be read with the Baseline HIRA, the OHS Policy, all SWPs and the Emergency Response Plan.

## 2. Project Description

- Project: _______________________________________________
- Address: _______________________________________________
- Scope of works: _________________________________________
- Client: {{CLIENT_NAME}}
- Principal Contractor: {{COMPANY_NAME}}
- Contract value: _________________________________________
- Duration: _________________________________________
- Notification to DoEL: required if works >30 days & >180 person-days, or >300 person-days, or > 6 m height risk — Form filed: ____________________

## 3. Organisational Structure & Legal Appointments

| Role | Name | Reference |
|------|------|-----------|
| Section 16(1) Accountable Officer | {{CEO_NAME}} | OHS Act Sec 16(1) |
| Section 16(2) Appointee | _______________ | OHS Act Sec 16(2) |
| Construction Manager | _______________ | Construction Reg 8(1) |
| Construction Supervisor | _______________ | Construction Reg 8(7) |
| Construction Health & Safety Manager | _______________ | Construction Reg 8(5) (≥40 persons) |
| Construction Safety Officer | {{SAFETY_OFFICER_NAME}} | Construction Reg 8(5)(b) |
| Risk Assessor (Reg 9) | _______________ | Construction Reg 9 |
| Fall Protection Plan Developer | _______________ | Construction Reg 10 |
| Excavation Supervisor | _______________ | Construction Reg 13 |
| Scaffold Erector / Inspector | _______________ | Construction Reg 16 |
| Lifting Machinery Operator | _______________ | DMR 18 |
| Electrical Competent Person | _______________ | EMR 9 |
| First Aider | _______________ | GSR 3 |
| Fire Marshal | _______________ | ERWP 9 |
| H&S Representatives | _______________ | OHS Act Sec 17 |
| H&S Committee Chair | _______________ | OHS Act Sec 19 |

All appointments shall be in writing on the company's Legal Appointment Letterhead, accepted by the appointee, and filed in the H&S File before the activity commences.

## 4. Risk Assessment & Method Statements

A site-specific Baseline HIRA (document ra-baseline-hira) has been compiled and is updated for every change. Each high-risk activity is governed by:

- A Safe Work Procedure (SWP) or Method Statement.
- A Job Safety Analysis (JSA) signed by the team prior to commencement.
- A Permit-to-Work where applicable.

## 5. Worker Competence & Induction

- All workers complete a documented site induction before first entry.
- High-risk tasks require accredited training certificates (valid).
- Sub-contractor workers complete a contractor's induction and provide proof of competency.
- The Training Matrix is reviewed weekly and gaps closed before tasks commence.

## 6. Plant & Equipment

- All plant has Certificates of Conformance (DMR 18 — lifting machinery).
- Pre-use inspections daily; weekly competent person inspection.
- Operators in possession of current PrDP and operator competency cards.

## 7. Welfare & Site Set-Up (Facilities Regulations 2004)

- Toilets — minimum 1 per 30 workers (segregated), serviced.
- Hand-washing facilities with soap and disposable towels.
- Drinking water — chilled and adequate.
- Eating area, separate from work and ablutions.
- Site office with telephone, first aid box, induction area, H&S notice board.
- Adequate lighting (per SANS 10114) and ventilation.
- Storage for materials and hazardous substances per HCS Regs.

## 8. Sub-Contractor Management (Section 37)

Every sub-contractor signs a Section 37(2) Mandatary Agreement before mobilising. {{COMPANY_NAME}} verifies prior to contract:

- Letter of Good Standing (COIDA) — current.
- Company-specific OHS Plan.
- Risk assessments, SWPs and method statements.
- Legal appointment letters for own personnel.
- Training matrix and certificates.
- Insurance (public liability, contract works).

## 9. Monitoring, Audit & Reporting

- Daily site inspection (Construction Reg 9, recorded on Daily Site Inspection Checklist).
- Weekly site inspection by H&S Officer with H&S Reps.
- Monthly client OHS report covering KPIs, incidents, audits and corrective actions.
- Quarterly external audit (target ≥90% compliance, ISO 45001-aligned).
- Annual independent legal compliance audit.

## 10. Incident Management

Incident reporting follows the Incident & Injury Reporting Procedure. Section 24 incidents are reported to the Provincial Director of the DoEL immediately by the quickest means.

## 11. Emergency Preparedness

The Site Emergency Response Plan is in force from day one and tested with a full drill within the first 30 days and every 6 months thereafter.

## 12. Document Control

This Plan is a controlled document. Master held in the Site H&S File. Reviewed monthly at the H&S Committee meeting and re-issued at every revision.

` + STANDARD_FOOTER,
  },
  {
    id: "chk-jsa",
    type: "CHECKLIST",
    category: "Risk Assessment",
    title: "Job Safety Analysis (JSA / JHA)",
    description: "Task-level pre-work hazard analysis signed by every team member.",
    legalBasis: [
      "Construction Regulations 2014, Reg 9(1)(b)",
      "OHS Act Section 8(2)(d)",
    ],
    placeholders: ["{{SITE_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Job Safety Analysis (JSA / JHA)") + `Site: {{SITE_NAME}}    Date: _______________   JSA No: _______________
Task / activity: ___________________________________________________________
Location on site: __________________________________________________________
Start time: _______________  Expected finish: _______________
Crew leader / supervisor: __________________________________________________
Permits required: [ ] Hot Work  [ ] Heights  [ ] Confined Space  [ ] Excavation  [ ] Electrical  [ ] Lifting  [ ] None

## 1. Preconditions

[ ] Baseline HIRA reviewed for this activity
[ ] SWP / method statement read and understood
[ ] Tools and materials inspected, on site, fit for purpose
[ ] All workers fit for duty (rested, sober, medically fit, trained)
[ ] Weather acceptable for the task
[ ] Emergency contacts and assembly point known to team
[ ] First aid box and fire extinguisher accessible

## 2. Step-by-Step Hazard Analysis

For each step of the task identify hazards, rate residual risk (L×C, see HIRA matrix), and list controls:

| Step | Task description | Hazard(s) | L | C | Risk | Controls (E,S,Eng,Adm,PPE) | Person responsible |
|------|------------------|-----------|---|---|------|----------------------------|--------------------|
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |  |
| 8 |  |  |  |  |  |  |  |

Risk legend: L=Likelihood (1–5), C=Consequence (1–5), Risk = L×C. Any score ≥10 requires additional controls before work proceeds.

## 3. PPE Required

[ ] Hard hat  [ ] Safety boots  [ ] Hi-vis  [ ] Eye protection  [ ] Hearing protection  [ ] Respirator (type ____)
[ ] Gloves (type ____)  [ ] Harness + lanyard  [ ] FR clothing  [ ] Chemical suit  [ ] Face shield  [ ] Other: ____

## 4. Emergency Considerations

- Nearest exit / route: ____________________________________________
- Assembly point: ____________________________________________
- Rescue plan (heights / confined space): __________________________________
- Spill / fire / medical contact: __________________________________________

## 5. Stop-Work Conditions

Work shall stop immediately if any of the following occurs:

[ ] An injury / near-miss occurs
[ ] Weather deteriorates (wind >32 km/h, lightning, storm)
[ ] Equipment malfunction
[ ] Unexpected utilities encountered
[ ] Atmospheric alarm (confined space)
[ ] Loss of communication with crew
[ ] Any worker exercises Stop-Work Authority

Re-start authorised by: ____________________________________________

## 6. Team Sign-On

By signing below, I confirm I attended the JSA brief, understand the hazards and controls, and accept my responsibility to comply and to invoke Stop-Work Authority if necessary.

| # | Name | ID No | Trade | Signature | Time |
|---|------|-------|-------|-----------|------|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |
| 4 |  |  |  |  |  |
| 5 |  |  |  |  |  |
| 6 |  |  |  |  |  |
| 7 |  |  |  |  |  |
| 8 |  |  |  |  |  |
| 9 |  |  |  |  |  |
| 10|  |  |  |  |  |

## 7. Supervisor Authorisation

Supervisor: ____________________________   Signature: _______________________   Time: _______________

Reviewed by H&S Officer ({{SAFETY_OFFICER_NAME}}): _______________________   Time: _______________

## 8. Post-Task Review

Did all controls work as intended? [ ] Yes  [ ] No (explain): ____________________________________

Hazards / near-misses encountered (raise on Hazard Report Card): _______________________

JSA closed at: _______________   By: _______________________________

` + STANDARD_FOOTER,
  },
  {
    id: "perm-hot-work",
    type: "CHECKLIST",
    category: "Permit-to-Work",
    title: "Hot Work Permit",
    description: "Single-shift permit form for welding, cutting, grinding or any spark-producing work.",
    legalBasis: ["General Safety Regulations Reg 9", "SANS 10238"],
    placeholders: ["{{SITE_NAME}}", "{{FIRE_MARSHAL_NAME}}"],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Hot Work Permit") + `Permit No: _______________   Site: {{SITE_NAME}}   Date: _______________
Valid from: _____:_____   to: _____:_____   (one shift maximum)

## 1. Work Details

Exact location: ______________________________________________
Description of work: _________________________________________
Equipment to be used: [ ] MMA welding  [ ] MIG/MAG  [ ] TIG  [ ] Oxy-fuel cutting  [ ] Plasma cutting  [ ] Grinding  [ ] Other: ____

Person performing work: ______________________________________
Qualification / cert no: ______________________________________
Fire watch: _________________________________________________
Trained fire watch — yes [ ]  Certificate no: _______________

## 2. Pre-Work Checklist (issuer & receiver jointly verify)

[ ] Combustible materials within 11 m removed or covered with fire-resistant blankets / screens
[ ] Floor swept, oily/greasy residues removed
[ ] Floor openings, drains, wall openings within 11 m covered or sealed
[ ] Atmospheric tested for flammable vapours (<10% LEL): reading _____ % LEL
[ ] If on tank/pipe — purged, cleaned, gas-tested
[ ] Sprinklers / fire detection isolated only with written approval and re-instatement plan
[ ] Hot work equipment inspected — hoses, regulators, flashback arrestors both sides of oxy-fuel
[ ] Cylinders secured upright, distance ≥3 m from work
[ ] Welding screens deployed to protect adjacent persons from arc flash
[ ] Local exhaust ventilation set up (mandatory on galvanised / coated / painted material)
[ ] Adequate PPE for welder: helmet (correct shade), apron, leather gloves & sleeves, FR clothing, safety boots, hearing protection
[ ] Adequate PPE for fire watch: hard hat, hi-vis, gloves
[ ] Fire extinguisher present — type: [ ] DCP 9 kg  [ ] CO₂ 5 kg  [ ] Hose reel
[ ] Charged fire hose / water source within 30 m where possible
[ ] Adjacent workers, sub-contractors and other affected persons notified
[ ] Means of communication tested (radio / phone)

## 3. Issued by (Fire Marshal / Competent Appointee)

Name: {{FIRE_MARSHAL_NAME}}
Signature: _______________________   Time: _______________

## 4. Accepted by Worker / Receiver

I have inspected the work area, agree the controls are in place, and accept this permit.

Name: ________________________   Signature: _______________   Time: _______________

## 5. Continuous Fire Watch

A trained fire watcher with a serviced extinguisher must remain in the area during the work and for a minimum of 30 minutes (60 minutes for high-hazard areas) after the last spark.

Fire watch sign-on:

| Time | Activity | Initial |
|------|----------|---------|
|      |          |         |
|      |          |         |
|      |          |         |

## 6. Close-Out

[ ] Work completed
[ ] Equipment removed / cooled
[ ] Final inspection 30 minutes after work — no smoke, no smouldering material
[ ] Sprinklers / detection re-instated
[ ] Area handed back to operator
[ ] Permit returned to permit issuer

Closed by (receiver): _______________________   Time: _______________
Accepted closed by (issuer): _______________________   Time: _______________

This permit is filed in the Permit-to-Work Register for a minimum of 3 years.

` + STANDARD_FOOTER,
  },
  {
    id: "perm-confined-space",
    type: "CHECKLIST",
    category: "Permit-to-Work",
    title: "Confined Space Entry Permit",
    description: "Single-shift permit for entry into tanks, manholes, pits, ducts and similar spaces.",
    legalBasis: ["General Safety Regulations Reg 5"],
    placeholders: ["{{SITE_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: false,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Confined Space Entry Permit") + `Permit No: _______________   Site: {{SITE_NAME}}   Date: _______________
Valid from: _____:_____   to: _____:_____   (one shift maximum, max 8 hours)

## 1. Confined Space Details

Identification / tag no: ______________________________________
Description: ________________________________________________
Previous contents: ___________________________________________
Reason for entry: ___________________________________________
Number of entry points: _______   Internal volume (approx): _______

## 2. Personnel

Entry Supervisor: _____________________ (competent, signed appointment)
Entrant(s):
1. _______________________   ID: _______________   Training cert: _______________
2. _______________________   ID: _______________   Training cert: _______________
3. _______________________   ID: _______________   Training cert: _______________

Standby attendant ("hole watch") — present at entry, no other duties, never enters:
Name: _______________________   ID: _______________

Rescue team / contact: ____________________________________

## 3. Hazards Identified

[ ] Oxygen deficiency / enrichment   [ ] Flammable atmosphere   [ ] Toxic gases (H₂S, CO, NH₃, SO₂, Cl₂, other: ____)
[ ] Engulfment (liquid / solid)   [ ] Mechanical (agitator, valve)   [ ] Electrical   [ ] Thermal (hot / cold)
[ ] Falling objects   [ ] Slip / trip / fall   [ ] Restricted access for rescue   [ ] Noise   [ ] Radiation

## 4. Pre-Entry Controls

[ ] Isolation: all inflow valves locked / blanked, electrical and mechanical sources locked-out (LOTO permit no _______)
[ ] Cleaning / purging completed (method: ____________________)
[ ] Internal lighting suitable (intrinsically safe if flammables possible)
[ ] Ventilation: [ ] natural [ ] forced (CFM: _____, air changes/hr: _____)
[ ] Permit posted at entry point
[ ] Equipment inspected: harness, lifeline, tripod & winch, SCBA / SABA if needed
[ ] Two-way communication tested (radio / line / banging signals)
[ ] Emergency / rescue equipment in position at entry point
[ ] Rescue plan reviewed and rehearsed

## 5. Atmospheric Testing

Calibration date of monitor: ______________   Monitor make/model: ____________________

Pre-entry readings (must be safe to proceed):

| Time | O₂ (19.5–23%) | LEL (<10%) | CO (<25 ppm) | H₂S (<10 ppm) | Other |
|------|---------------|------------|---------------|---------------|-------|
|      |               |            |               |               |       |
|      |               |            |               |               |       |

Continuous monitoring during entry:

| Time | O₂ | LEL | CO | H₂S | Comment / action |
|------|----|-----|----|-----|------------------|
|      |    |     |    |     |                  |
|      |    |     |    |     |                  |
|      |    |     |    |     |                  |
|      |    |     |    |     |                  |

If any reading goes outside limits — **evacuate immediately**, do not re-enter until atmosphere re-stabilised.

## 6. PPE for Entrants

[ ] Hard hat  [ ] Safety boots (anti-static where flammables)  [ ] Hi-vis  [ ] Full body harness with retrieval line
[ ] Eye protection  [ ] Hearing protection  [ ] Gloves (type ____)  [ ] Respirator: [ ] Air-purifying (type ____) [ ] SCBA [ ] SABA

## 7. Entry / Exit Log

| Entrant name | Time in | Time out | Initial |
|--------------|--------:|---------:|--------:|
|              |         |          |         |
|              |         |          |         |
|              |         |          |         |
|              |         |          |         |

## 8. Authorisation

Issued by ({{SAFETY_OFFICER_NAME}} / Competent Person):
Name: _______________________   Signature: _______________   Time: _______________

Accepted by Entry Supervisor:
Name: _______________________   Signature: _______________   Time: _______________

## 9. Close-Out

[ ] All entrants out and accounted for
[ ] All equipment retrieved
[ ] Space secured / re-sealed
[ ] Isolations restored under work-order
[ ] Permit returned to issuer

Closed at: _______________   By: _______________________

Filed in Permit-to-Work Register for ≥3 years.

` + STANDARD_FOOTER,
  },
  {
    id: "leg-37-2-mandatary",
    type: "LEGAL_APPOINTMENT",
    category: "Section 37(2)",
    title: "Section 37(2) Mandatary Agreement",
    description: "Written agreement between Principal Contractor and sub-contractor (mandatary) under Section 37(2) of the OHS Act.",
    legalBasis: [
      "OHS Act Section 37(2)",
      "Construction Regulations 2014, Reg 5(1)(k) and Reg 7(1)(c)(v)",
    ],
    placeholders: ["{{COMPANY_NAME}}", "{{CEO_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Section 37(2) Mandatary Agreement") + `## Agreement in terms of Section 37(2) of the Occupational Health and Safety Act, 85 of 1993

ENTERED INTO BETWEEN

**{{COMPANY_NAME}}** (Reg No: {{COMPANY_REG_NO}}) ("the Employer / Principal Contractor"), represented herein by {{CEO_NAME}} duly authorised hereto;

AND

________________________________________ (Reg No: ____________________) ("the Mandatary / Sub-Contractor"), represented herein by ________________________________________ duly authorised hereto.

## 1. Recitals

1.1 The Employer has appointed the Mandatary to perform certain work as defined in the contract dated ____________________ ("the Works").

1.2 The Mandatary represents and warrants that it is competent to perform the Works and that it has all necessary skills, knowledge, qualifications, registrations and experience.

1.3 The parties wish to record their agreement that the Mandatary will perform the Works as an independent contractor whilst nonetheless complying with the OHS Act and all applicable regulations.

## 2. Compliance Obligations of the Mandatary

The Mandatary undertakes:

2.1 To comply fully with the Occupational Health and Safety Act, 85 of 1993, all regulations promulgated thereunder, and any other applicable health, safety and environmental legislation;

2.2 To comply with the Employer's OHS Policy, Construction H&S Plan, Baseline HIRA, Permits-to-Work, Site Rules and any reasonable instruction given by the Employer's Safety Officer or Construction Supervisor;

2.3 To maintain a valid Letter of Good Standing from the Compensation Commissioner (COIDA) for the duration of the Works, and to provide the Employer with a copy upon request and at every renewal;

2.4 To make written appointments of all competent persons required by the OHS Act and the Construction Regulations (including without limitation 16(2), 8(1), 8(7), 9, 10, 13, 16, First Aider, Fire Marshal, H&S Representatives) and provide copies to the Employer;

2.5 To submit prior to mobilisation, and maintain current throughout the Works:
- its own site-specific OHS Plan aligned to the Employer's H&S Specification;
- task-specific Risk Assessments, Safe Work Procedures, Method Statements and JSAs;
- training certificates and competency proofs for all personnel;
- pre-use plant and equipment inspection records;
- Medical certificates of fitness where required;

2.6 To use only competent, trained, medically fit, sober persons to perform the Works;

2.7 To attend the Employer's site induction and Health & Safety Committee meetings;

2.8 To report all incidents, injuries, near-misses and occupational diseases to the Employer immediately (and in any event within 1 hour), and to cooperate with all investigations;

2.9 To pay for all costs of compliance, including PPE, training, medicals, plant inspections and statutory levies;

2.10 To indemnify and hold the Employer harmless against any claim, fine, penalty, loss or damage arising out of any breach by the Mandatary of this Agreement or the OHS Act.

## 3. Employer's Rights

3.1 The Employer reserves the right (without notice) to inspect, audit and verify compliance.

3.2 The Employer may, in the event of any contravention or imminent danger, immediately suspend or terminate the Works without prejudice to its other contractual or legal remedies.

## 4. Acknowledgement of Section 37(2)

The Mandatary acknowledges that this Agreement constitutes a written agreement contemplated by Section 37(2) of the OHS Act, the effect of which is that no act or omission by the Mandatary or its employees shall be deemed to be that of the Employer unless the Employer failed to take the steps reasonably required to prevent such act or omission.

## 5. Duration

This Agreement is co-terminous with the underlying contract for the Works and survives the termination thereof in respect of any matter arising during its currency.

## 6. Signatures

**For and on behalf of the Employer / Principal Contractor:**

Name: {{CEO_NAME}}   Designation: {{CEO_TITLE}}
Signature: _______________________________   Date: _______________________
Witness: _______________________________   Date: _______________________

**For and on behalf of the Mandatary / Sub-Contractor:**

Name: ________________________________   Designation: ________________________________
Signature: _______________________________   Date: _______________________
Witness: _______________________________   Date: _______________________

` + STANDARD_FOOTER,
  },
  {
    id: "leg-17-rep",
    type: "LEGAL_APPOINTMENT",
    category: "Section 17",
    title: "Health & Safety Representative Designation — Section 17",
    description: "Designation of an elected H&S Representative under Section 17 read with GAR 6 & 7.",
    legalBasis: [
      "OHS Act Section 17",
      "General Administrative Regulations 6 & 7",
    ],
    placeholders: ["{{COMPANY_NAME}}", "{{CEO_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Health & Safety Representative Designation — Section 17") + `## Designation of Health & Safety Representative

To: __________________________________ (full name)
ID No: __________________________________
Employee No: __________________________________

In terms of Section 17 of the Occupational Health and Safety Act, 85 of 1993, and following consultation with employees as required, you are hereby designated as a Health & Safety Representative for:

Workplace / area: ________________________________________
Number of employees represented: _______
Term of designation: 2 years (renewable)
Effective date: {{EFFECTIVE_DATE}}

## Functions (Section 18 of the Act)

You may, in respect of the workplace for which you are designated:

(a) Review the effectiveness of health and safety measures;
(b) Identify potential hazards and major incidents at the workplace;
(c) In collaboration with the employer, examine the causes of incidents at the workplace;
(d) Investigate complaints by any employee relating to that employee's health or safety at work;
(e) Make representations to the employer or to a Health and Safety Committee or, where such representations are unsuccessful, to an Inspector;
(f) Inspect the workplace at agreed intervals after notifying the employer;
(g) Participate in consultations with Inspectors at the workplace and accompany an Inspector on inspections;
(h) Receive information from Inspectors as contemplated in Section 36;
(i) Attend meetings of the Health & Safety Committee of which you are a member.

## Facilities, Training and Time Off (GAR 6 & 7)

The Employer undertakes to:

- Provide reasonable time off (with pay) for you to perform your functions and to attend training.
- Provide accredited Section 17 training within 30 days of designation, with refreshers every 2 years.
- Provide facilities, assistance and information required for the performance of your functions.
- Indemnify you from any civil liability arising from the proper performance of your statutory duties (Section 17(4)).
- Not victimise, discriminate against or dismiss you for performing your duties (constitutes an unfair labour practice).

## Acceptance

I, the undersigned, accept this designation and confirm I am willing and able to perform the functions described.

Designee signature: _______________________   Date: _______________

## Designated by

{{CEO_NAME}}, {{CEO_TITLE}}, for and on behalf of {{COMPANY_NAME}}

Signature: _______________________   Date: _______________

` + STANDARD_FOOTER,
  },
  {
    id: "leg-19-committee",
    type: "LEGAL_APPOINTMENT",
    category: "Section 19",
    title: "Health & Safety Committee Constitution — Section 19",
    description: "Constitution and terms of reference for the OHS Act Section 19 Health & Safety Committee.",
    legalBasis: ["OHS Act Section 19", "General Administrative Regulations 5"],
    placeholders: ["{{COMPANY_NAME}}", "{{CEO_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Health & Safety Committee Constitution — Section 19") + `## 1. Establishment

In terms of Section 19(1) of the Occupational Health and Safety Act, 85 of 1993, {{COMPANY_NAME}} hereby establishes a Health & Safety Committee for the workplace.

## 2. Composition

The Committee shall comprise:

- All designated Health & Safety Representatives (Section 17).
- Management representatives appointed by the CEO, in numbers not exceeding the number of H&S Representatives.
- The Safety, Health & Environmental Practitioner (ex officio).
- The Construction Supervisor / Site Manager (ex officio where applicable).
- Sub-contractor representatives where reasonably required by the size of operations.

## 3. Office Bearers

- **Chairperson:** appointed by the Committee at its first meeting from amongst its members.
- **Secretary:** appointed by the employer, responsible for minutes, agenda and circulation.

## 4. Functions (Section 20)

(a) Make recommendations to the employer or, where the recommendations fail to resolve the matter, to an Inspector regarding any matter affecting the health or safety of persons at the workplace;
(b) Discuss any incident at the workplace in which a person was injured, became ill or died, and report in writing to an Inspector on the matter;
(c) Perform such other functions prescribed by regulation.

## 5. Meetings

- Held monthly at a fixed date, time and venue (no longer than 3-month interval as per GAR 5).
- Quorum: 50% of members including at least one H&S Rep and one Management member.
- Minutes circulated within 7 days and tabled at the next meeting.
- Standing agenda: previous minutes; legal compliance; incidents & near-misses; inspections & audits; risk assessments; training; PPE; environmental matters; H&S Reps' reports; client/contractor issues; review of corrective actions; new business.

## 6. Records

Minutes and recommendations are retained for at least 3 years. A copy is held in the Site H&S File and available to DoEL Inspectors.

## 7. Authority

The Committee is a consultative body. Recommendations are submitted in writing to the CEO who must respond within 30 days. Unresolved matters may be escalated to a DoEL Inspector.

## 8. Approval

Adopted by the Health & Safety Committee on _______________ and approved by:

{{CEO_NAME}}, {{CEO_TITLE}}, for and on behalf of {{COMPANY_NAME}}

Signature: _______________________   Date: _______________

` + STANDARD_FOOTER,
  },
  {
    id: "pol-manual-handling",
    type: "POLICY",
    category: "Ergonomics",
    title: "Manual Handling & Ergonomics Policy",
    description: "Prevention of musculoskeletal disorders (MSDs) from manual handling, repetitive work and poor workstation design.",
    legalBasis: [
      "Ergonomics Regulations, 2019",
      "OHS Act Section 8",
    ],
    placeholders: ["{{COMPANY_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Manual Handling & Ergonomics Policy") + `## 1. Purpose

To eliminate so far as is reasonably practicable, and otherwise control, the risk of musculoskeletal disorders (MSDs) arising from manual handling, awkward postures, repetition, vibration and poor workstation design — in compliance with the Ergonomics Regulations, 2019 promulgated under the OHS Act.

## 2. Definitions

- **Manual handling** — any activity requiring the use of force exerted by a person to lift, lower, push, pull, carry, hold or restrain a person, animal or object.
- **MSD** — injury or disease of the muscles, nerves, tendons, joints, cartilage or spinal discs.
- **Ergonomic risk factor** — any feature of work that contributes to MSD risk (force, posture, repetition, duration, vibration, contact stress, environment).

## 3. Hierarchy of Control

The following order shall be applied:

1. **Eliminate** manual handling (e.g. mechanical conveyor, vacuum lift, design out the lift).
2. **Substitute** with mechanical aid (trolley, hoist, hand truck, scissor lift).
3. **Engineering** controls (workstation re-design, height adjustment, anti-fatigue mats, vibration-isolation tools).
4. **Administrative** controls (job rotation, micro-breaks, training, team-lifts).
5. **PPE** (back supports are NOT a primary control; gloves with grip; knee pads for kneeling work).

## 4. Maximum Recommended Loads (NIOSH-derived, single lift, healthy adult, ideal conditions)

Where elimination is not reasonably practicable, lifts shall not exceed:

- 23 kg — ideal lift (close to body, knuckle height, no twist, infrequent).
- 16 kg — frequent / above shoulder / below knee.
- 10 kg — twisting, asymmetric, prolonged or repetitive.

Above these thresholds: mechanical aid, team lift or task re-design is mandatory.

## 5. Risk Assessment & Worker Involvement

- Every job involving manual handling >5 kg is risk-assessed using the NIOSH lifting equation or REBA / RULA where appropriate.
- Workers performing manual handling are consulted; their feedback is recorded and acted upon.
- Pregnant workers, workers returning from injury and workers >50 years receive individual assessments.

## 6. Workstation Ergonomics (Office / VDU)

- Chair adjustable in height (38–53 cm), with back support and 5-star base.
- Monitor top at eye level, 50–70 cm from eyes.
- Keyboard and mouse on flat surface, elbows at ~90°.
- Adequate task lighting (300–500 lux), no glare.
- Document holder used if frequent reference.
- 5-minute micro-break every 60 minutes; eye-rest every 20 minutes ("20-20-20 rule").

## 7. Training

All workers receive ergonomic awareness training at induction. Workers doing significant manual handling receive specific manual-handling training every 2 years.

## 8. Medical Surveillance

Workers exposed to high MSD risk (≥daily lifts above thresholds, hand-arm vibration >2.5 m/s² A(8), whole-body vibration >0.5 m/s² A(8)) receive baseline and bi-annual medicals.

## 9. Reporting

MSD symptoms (pain, numbness, stiffness, tingling, swelling) are reportable to {{SAFETY_OFFICER_NAME}}. Early reporting is encouraged and protected — no employee is penalised for raising an ergonomic concern.

` + STANDARD_FOOTER,
  },
  {
    id: "proc-noise-conservation",
    type: "PROCEDURE",
    category: "Occupational Hygiene",
    title: "Noise Conservation Programme",
    description: "Hearing conservation programme for workers exposed at or above the 85 dB(A) action level.",
    legalBasis: [
      "Noise-Induced Hearing Loss Regulations, 2003",
      "Environmental Regulations for Workplaces Reg 7",
      "SANS 10083 (hearing conservation)",
    ],
    placeholders: ["{{COMPANY_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Noise Conservation Programme") + `## 1. Action Levels

- **Lower action level:** 85 dB(A) — 8-hour time-weighted average (TWA).
- **Upper action level:** 90 dB(A) TWA.
- **Peak action level:** 135 dB(C) instantaneous.

At or above 85 dB(A) TWA the full Hearing Conservation Programme applies.

## 2. Programme Elements

1. **Noise survey** — by competent occupational hygienist, calibrated Type 1 SLM, every 24 months or whenever process changes.
2. **Engineering controls** — silencers, enclosures, damping, isolation, maintenance, quieter substitutes.
3. **Administrative controls** — exposure-time reduction, job rotation, "noise zones" signed and barriered (≥85 dB(A)).
4. **Hearing protection** — issued in zones ≥85 dB(A); double protection (plugs + muffs) ≥105 dB(A); attenuation matched to exposure (SLC₈₀ from SANS 10083).
5. **Audiometric testing** — baseline within 30 days of first noise exposure; annual periodic; exit audiogram on leaving exposure.
6. **Training** — annual; covers hazards, controls, correct use & care of HPDs, signs of NIHL.
7. **Record keeping** — exposure assessments, audiograms, training, HPD issue — retained 40 years.

## 3. Standard Threshold Shift

A standard threshold shift (≥10 dB worsening at 2, 3 & 4 kHz average vs baseline) triggers:

- Confirmatory audiogram within 30 days.
- Workplace assessment to identify the cause.
- Re-fitting / upgraded HPD.
- Notification to the worker and the medical practitioner.
- Reporting as occupational disease (W.Cl.22) where confirmed.

## 4. Noise Map

A site noise map identifying ≥85 dB(A) zones is posted on the H&S notice board and updated after every survey.

## 5. Procurement

Plant & equipment procurement specifications require manufacturers to declare sound power levels. Quieter alternatives are selected where the price differential is reasonable.

` + STANDARD_FOOTER,
  },
  {
    id: "proc-method-statement",
    type: "PROCEDURE",
    category: "Method Statement",
    title: "Construction Method Statement Template",
    description: "Standard professional template for documenting the safe method of an activity.",
    legalBasis: [
      "Construction Regulations 2014, Reg 9 and Reg 7",
      "OHS Act Section 8(2)(d)",
    ],
    placeholders: ["{{COMPANY_NAME}}", "{{SITE_NAME}}", "{{SAFETY_OFFICER_NAME}}"],
    requiresAck: true,
    content: HEADER_BLOCK.replace("{{TITLE}}", "Construction Method Statement") + `## 1. Activity Description

Activity / scope: _______________________________________________________________________
Location on site: ______________________________________________________________________
Start date: _______________   Expected completion: _______________   Duration: _______________
Responsible supervisor: _________________________________________________________________

## 2. Reference Documents

- Baseline HIRA (ra-baseline-hira)
- Task-specific JSA (chk-jsa)
- Applicable SWPs: _______________________________________________
- Applicable permits: ____________________________________________
- OEM operating manuals / drawings: ______________________________

## 3. Workforce & Competence

| Role | Name | Competency / training | Cert no & expiry |
|------|------|-----------------------|------------------|
| Supervisor |  |  |  |
| Operator |  |  |  |
| Banksman |  |  |  |
| Riggers |  |  |  |
| Workers |  |  |  |

All workers medically fit (annual certificate of fitness — Reg 7).

## 4. Plant, Equipment & Materials

| Item | Quantity | Spec / size | Inspection status | Operator |
|------|----------|-------------|-------------------|----------|

## 5. Sequence of Work (Step-by-Step)

For each step describe: WHAT is done, HOW it is done, WHO does it, WHAT controls apply, WHAT can go wrong.

1. **Set-up & isolation** — _______________________________________________
2. **Material delivery & storage** — ______________________________________
3. **Main works (each phase)** — __________________________________________
4. **Quality checkpoints** — ______________________________________________
5. **Clean-up & demobilisation** — ________________________________________
6. **Hand-over & sign-off** — ____________________________________________

## 6. Hazards & Controls Summary

| Hazard | Control (E,S,Eng,Adm,PPE) | Residual risk |
|--------|---------------------------|---------------|

## 7. Emergency Arrangements

- First aider on site: ________________________
- Fire extinguishers location: ________________________
- Nearest assembly point: ________________________
- Rescue arrangements (heights / confined / electrical): ________________________
- Emergency numbers posted: ________________________

## 8. Environmental Aspects

- Dust suppression: ________________________
- Noise control: ________________________
- Spill containment: ________________________
- Waste streams & disposal: ________________________
- Cultural / heritage / ecological constraints: ________________________

## 9. Approvals

Compiled by: _______________________   Signature: _______________   Date: _______________

Reviewed by Safety Officer ({{SAFETY_OFFICER_NAME}}): _______________________   Date: _______________

Approved by Construction Manager: _______________________   Date: _______________

Acknowledged by Client / Engineer (if required): _______________________   Date: _______________

## 10. Team Briefing & Sign-On

| # | Name | Trade | Signature | Date |
|---|------|-------|-----------|------|

` + STANDARD_FOOTER,
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
  ...ADVANCED,
];

export const OHS_TEMPLATE_CATEGORIES = [
  { type: "POLICY", label: "Policies", count: OHS_TEMPLATES.filter((t) => t.type === "POLICY").length },
  { type: "PROCEDURE", label: "Procedures", count: OHS_TEMPLATES.filter((t) => t.type === "PROCEDURE").length },
  { type: "CHECKLIST", label: "Checklists & Permits", count: OHS_TEMPLATES.filter((t) => t.type === "CHECKLIST").length },
  { type: "EMERGENCY_PLAN", label: "Emergency Plans", count: OHS_TEMPLATES.filter((t) => t.type === "EMERGENCY_PLAN").length },
  { type: "LEGAL_APPOINTMENT", label: "Legal Appointments", count: OHS_TEMPLATES.filter((t) => t.type === "LEGAL_APPOINTMENT").length },
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
