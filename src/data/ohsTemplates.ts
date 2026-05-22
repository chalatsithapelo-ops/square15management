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

{{COMPANY_NAME}} regards the protection of the health and safety of its employees, sub-contractors, visitors and the public as an inseparable corporate value, ranked equal in priority to quality, production, schedule and cost. The Chief Executive accepts the duty imposed by section 16(1) of the Occupational Health and Safety Act, 85 of 1993 ("the Act") and provides this policy as the framework within which all operations of the company shall be planned, supervised and reviewed.

We do not regard injuries, occupational disease, or significant environmental damage as inevitable consequences of doing business. Our stated objective is **zero harm** to people, the public and the natural environment, achieved through systematic hazard elimination, engineered controls and a competent, accountable workforce.

## 2. Scope

This policy is binding on every person who performs work for or on behalf of {{COMPANY_NAME}}, including:

- Permanent, temporary, seasonal and part-time employees.
- All sub-contractors and their workers (engaged as mandataries under section 37(2) of the Act).
- Labour-broker employees.
- Suppliers, hauliers and service providers entering company premises or sites.
- Visitors, clients, consultants and members of the public lawfully on site.

It covers all undertakings of {{COMPANY_NAME}}, including offices, workshops, stores, project sites, vehicles and any temporary workplace established for the execution of contracted work.

## 3. Guiding Principles

1. **No work is so urgent that it may not be done safely.** Production and programme are subordinate to safety.
2. **The hierarchy of control** (elimination, substitution, engineering, administration, PPE) is applied at every level of planning and at every revision of method.
3. **Line management owns safety.** OHS practitioners advise and audit; they do not relieve managers and supervisors of their statutory duties.
4. **Workers are the most important source of risk intelligence.** Their reports, concerns and refusals to do unsafe work are protected and acted upon.
5. **Sub-contractors are held to the same standard as direct employees.**
6. **Compliance is the floor, not the ceiling.** Where industry good practice or our internal standards exceed the law, our internal standards apply.

## 4. Strategic Objectives & Performance Targets

{{COMPANY_NAME}} commits to the following annual targets, reviewed quarterly by the executive:

| KPI | Target |
|-----|--------|
| Fatalities | Zero |
| Lost-Time Injury Frequency Rate (LTIFR per 1 000 000 hours) | <1.0 |
| Total Recordable Injury Frequency Rate (TRIFR) | <3.0 |
| All Section 24 incidents reported to DoEL on time | 100% |
| Risk assessments current (within 24 months) for active activities | 100% |
| Workforce training in date for the task performed | 100% |
| Internal audit corrective actions closed by due date | >95% |
| Toolbox talks delivered per worker per month | >=4 |
| Hazard / near-miss reports per 100 workers per month | >=10 |
| Sub-contractor section 37(2) agreements in place before mobilisation | 100% |

## 5. Responsibilities & Accountabilities

### 5.1 Chief Executive / Managing Director — Section 16(1)

Accountable to the board and to the regulator for the discharge of all duties imposed on the employer by the Act. Signs, issues and reviews this policy; ensures that suitable Section 16(2) appointments are made; ensures that adequate financial, human and technical resources are made available; chairs the annual OHS management review.

### 5.2 Section 16(2) Appointee(s)

Appointed in writing in terms of section 16(2) to act on behalf of the CEO in respect of named operations or geographical areas. Responsible for implementing this policy, the OHS management system and the audit programme; for ensuring that all subordinate appointments under the Act and its regulations are made and accepted; and for reporting OHS performance quarterly to the CEO. The appointment letter, signed acceptance and current role description form part of the company OHS file.

### 5.3 Construction / Project Manager

Responsible for executing each project in accordance with the project-specific Health & Safety Plan, the Baseline HIRA and all applicable SWPs and permits. Ensures site induction, daily site inspection and weekly H&S meetings are held and recorded.

### 5.4 OHS Manager / Safety Officer

A technical advisor to line management. Co-ordinates the OHS management system, the audit programme, incident investigation, training records and the regulatory interface. Has the standing authority to stop unsafe work without prior reference to line management.

### 5.5 Supervisors

Accountable for safety in their work area for every shift they supervise. Before work commences they verify the JSA, permits, PPE, tools and competence of their crew; during work they remain present, observe and correct unsafe acts; after work they account for personnel and equipment and close out the permit.

### 5.6 Health & Safety Representatives — Section 17

Elected by the workforce; trained at company cost; perform monthly inspections; participate in incident investigations; sit on the Health & Safety Committee.

### 5.7 Health & Safety Committee — Section 19

Constituted where there are two or more H&S Representatives. Meets at least quarterly under written constitution; minutes filed in the H&S file and posted on the notice board.

### 5.8 Employees — Section 14

Take reasonable care for their own health and safety and that of others affected by their acts or omissions; co-operate with the employer; use the PPE and safety equipment provided; report unsafe conditions, unsafe acts and incidents; obey lawful safety instructions; comply with the alcohol & drug policy; and exercise their right and duty to stop unsafe work.

### 5.9 Sub-contractors — Section 37(2)

Deemed an employee of the mandator for purposes of the Act unless the contractor has signed a Mandatary Agreement assuming the duties of an employer. {{COMPANY_NAME}} requires every sub-contractor to sign such an agreement, to demonstrate competence and resources, and to comply with this policy.

## 6. Risk Management

A structured Hazard Identification and Risk Assessment (HIRA) process is the foundation of the system. Baseline HIRAs are compiled by competent risk assessors appointed under Construction Regulation 9 and are reviewed:

- before any new activity commences;
- when there is a material change in plant, method, environment or workforce;
- after every recordable incident; and
- at least every 24 months.

Task-level Job Safety Analyses (JSAs) are completed and signed by the work team before each high-risk task. Permit-to-Work systems control hot work, confined-space entry, work at heights >6 m, excavation deeper than 1.5 m, electrical isolation, and lifting operations.

## 7. Right to Refuse Unsafe Work

No employee may be dismissed, disciplined, prejudiced or victimised in any way for refusing in good faith to perform work they reasonably believe to be unsafe, for raising an OHS concern, or for participating as a H&S Representative. Any such conduct against an employee is itself a disciplinary offence.

## 8. Consultation, Communication & Worker Involvement

OHS information flows in both directions. Methods include:

- Site induction for every new arrival.
- Daily pre-task briefings and toolbox talks (recorded with signatures).
- Monthly H&S Representative inspections.
- Quarterly H&S Committee meetings.
- Hazard report cards and an anonymous SHEQ suggestion mailbox.
- Visible felt leadership: senior managers conduct a minimum of one documented safety walk per quarter.

## 9. Competence & Training

No person performs a task for which they are not trained, certified and authorised. Training requirements per role are captured in the Training Matrix, which is reviewed monthly. Records of training, refreshers and certificates of fitness are retained for the period required by law and for a minimum of five years after termination of employment.

## 10. Sub-contractor & Supplier Management

Prospective sub-contractors are screened on OHS performance, competence and resources before contract award. Mobilisation is permitted only after the H&S file is verified complete (Letter of Good Standing, mandatary agreement, appointments, training matrix, risk assessments and method statements). Performance is monitored during execution and feeds into the approved supplier rating.

## 11. Health, Wellness & Medical Surveillance

Medical fitness certificates are obtained at induction and at the intervals required by the regulations applicable to the worker's role (construction, heights, drivers, noise, dust, chemicals). The company provides access to an Employee Assistance Programme for confidential support.

## 12. Incident Management & Learning

All incidents — including near-misses — are reported, investigated and learned from in terms of the Incident & Injury Reporting Procedure. Section 24 incidents are reported to the Provincial Director of the Department of Employment & Labour as required. Lessons learned are communicated in toolbox talks, in safety alerts and at the H&S Committee.

## 13. Emergency Preparedness

A site-specific Emergency Response Plan is in force from day one of every site set-up. Drills are conducted at least every six months and after any material change in occupancy, layout or hazards.

## 14. Document Control & Records

The master OHS file is maintained at the registered office and, for each project, at the site office. Records required to be retained by law are kept for the legally prescribed period; in any event, audit, training and exposure records are retained for not less than forty years where the law so requires.

## 15. Management Review & Continuous Improvement

This policy and the OHS management system are reviewed by the executive at least annually, using the structure of ISO 45001:2018 (Plan-Do-Check-Act). The review considers performance against the KPIs in section 4, audit findings, incident trends, legal updates, and stakeholder concerns. The outputs of the review are documented and drive the next annual OHS objectives.

## 16. Communication of this Policy

This policy is displayed prominently at every workplace, included in the induction pack for every new arrival, and acknowledged in writing by every employee, sub-contractor and visitor receiving an induction.

## 17. Approval

Issued under the authority of the Chief Executive Officer of {{COMPANY_NAME}}:

_______________________________
{{CEO_NAME}}
{{CEO_TITLE}}
Date of issue: {{EFFECTIVE_DATE}}
Next scheduled review: {{REVIEW_DATE}}
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

To set out the requirements for the selection, provision, fitting, use, inspection, maintenance, replacement and disposal of personal protective equipment (PPE) at {{COMPANY_NAME}}, so as to discharge the employer's duty under section 8(1) of the OHS Act, General Safety Regulation 2 and Construction Regulation 5(1)(j), and to ensure that PPE is in fact the **last** line of defence after upstream controls have been applied.

## 2. Scope

Applies to every person on premises or sites under the control of {{COMPANY_NAME}}, whether employee, sub-contractor, visitor, supplier or member of the public who may be exposed to a hazard.

## 3. Hierarchy of Control

PPE is the last layer of protection. Before issuing PPE, {{COMPANY_NAME}} will attempt to:
- Eliminate the hazard.
- Substitute with a less hazardous alternative.
- Apply engineering controls (guards, ventilation).
- Apply administrative controls (procedures, rotation).
- Issue appropriate PPE.

The rationale for relying on PPE for any residual risk is recorded in the relevant risk assessment, together with the PPE specification and the inspection regime.

## 4. Mandatory Site PPE

The following items are mandatory on every site at all times for every person within the work area:

- Hard hat (SANS 1397, Class A/B, full peak preferred). Replaced every 36 months from the date of manufacture stamped on the shell, or immediately following any impact or visible damage.
- Safety boots with steel toe and steel or composite midsole, ankle support, oil-and-slip-resistant sole (SANS 20345 S3 minimum; S5 for wet work).
- High-visibility upper garment, Class 2 minimum (SANS 1387). Class 3 (long sleeves + bands) required where mobile plant operates at >40 km/h or where visibility is reduced.
- Safety glasses with side-shields (SANS 1404), worn at all times outside the air-conditioned site office.
- Long-sleeve overalls or work-shirt with long trousers; no shorts and no synthetic clothing where hot work is performed.

## 5. Task-Specific PPE

Issued in accordance with the risk assessment for the task:

- **Working at heights (>2 m or where a fall of any height could cause injury):** Full body harness with double lanyard and shock absorber, SANS 50361 / EN 361, inspected before each use and formally inspected by a competent person at intervals not exceeding 6 months. Harness retired after a fall arrest event, after 6 years of service, or earlier on the manufacturer's recommendation.
- **Electrical work:** Insulated gloves rated to system voltage (Class 00 to Class 4 per SANS 60903 / IEC 60903), with leather over-protectors; arc-rated clothing matched to the calculated incident energy (Cat 1 to 4 per NFPA 70E / SANS 10198-12); dielectric safety boots; insulated tools (SANS 60900); and a face shield rated for arc flash where indicated.
- **Welding & hot work:** Auto-darkening welding helmet with shade matched to the process (DIN 9 to 14), full-length leather apron, leather gauntlets and sleeves, flame-resistant overalls (SANS 1423), safety boots, hearing protection. A P2 or P3 respirator (with appropriate gas / fume cartridge) is mandatory on galvanised, painted, plated or coated metal; powered air-purifying respirator (PAPR) for prolonged duty.
- **Chemicals:** Indirect-vent splash goggles or full face shield (SANS 1404); chemical-resistant gloves of the correct polymer for the substance, breakthrough time exceeding the foreseeable exposure (consult the SDS section 8); chemical-resistant apron, suit or coverall; chemical-resistant boots; respirator selected on the basis of the SDS and an exposure assessment.
- **Dust, silica, paint, spray & abrasive blasting:** Quantitatively fit-tested half- or full-face P2 or P3 respirator (SANS 50149); air-fed hood or PAPR for blasting and confined-space spray; eye protection rated for the spray substance.
- **Noise:** Hearing protection issued for any exposure at or above 85 dB(A) TWA. Class of HPD selected such that the protected exposure under the HPD lies between 70 and 80 dB(A). Double protection (plugs + muffs) is required at or above 105 dB(A).
- **Grinding, cutting & impact tools:** Full face shield over safety glasses; leather gauntlets; hearing protection; appropriate respirator for the substrate.
- **Public road work & traffic exposure:** Class 3 high-visibility coverall; reflective trousers; hard hat with reflective banding.
- **Cold work & exposure to refrigerants:** Insulated gloves; thermal coveralls; face shield where venting.
- **Hot environments:** Cooling vest, hydration plan, cotton-only base layer, scheduled rest.
- **Biological hazards (sewerage, medical waste, vermin):** Nitrile gloves, splash goggles, P3 respirator if aerosolisation possible, disposable coverall, washable boots, hand hygiene station.

## 6. Selection & Procurement

PPE is selected against a risk-assessment-derived specification, not on price alone. All PPE bears the manufacturer's name, the relevant SANS / EN / ISO mark and the date of manufacture. Counterfeit or unmarked PPE is rejected on inspection.

## 7. Fit Testing

- Tight-fitting respirators (half-face, full-face) are quantitatively fit-tested on the wearer before first issue and at intervals not exceeding 12 months thereafter. A fit-test record (method, pass/fail, technician) is filed.
- Workers shall be clean-shaven where the seal contacts the face. Beards, stubble or moustaches that cross the seal are incompatible with tight-fitting respirators; alternatives (PAPR with hood) are used.
- Harnesses are sized to the wearer; one size does not fit all.

## 8. Issue, Inspection & Replacement

- All PPE is issued free of charge against the worker's signature on the PPE Issue Register.
- The register records item, size, manufacturer, batch / serial number, issue date, expected replacement date and signature.
- The worker performs a pre-use visual inspection before every shift; any damage or doubt removes the item from service.
- Formal periodic inspections by a competent person follow the schedule: harnesses 6-monthly; respirators monthly; hearing protection annual; hard hats 6-monthly.
- Damaged, worn, expired or contaminated PPE is withdrawn and destroyed to prevent re-issue.

## 9. Training

Workers receive practical training on the correct donning, doffing, adjustment, inspection, limitations and cleaning of every category of PPE issued to them. Training is repeated whenever the equipment changes and at intervals not exceeding 24 months.

## 10. Refusal to Wear PPE

Wearing the prescribed PPE is a condition of work. A worker who refuses to wear required PPE is immediately removed from the workplace and the matter is dealt with as a disciplinary offence in accordance with the company disciplinary code. Repeat offences may result in dismissal.

## 11. Visitors & Sub-contractors

Visitors are issued site PPE at the gate. Sub-contractors are required to provide compliant PPE to their workers and to maintain their own PPE issue register, which is open to audit by {{COMPANY_NAME}}.

## 12. Records & Audit

The PPE Issue Register, fit-test records and inspection records are retained for a minimum of five years. The PPE programme is audited internally at least annually and findings are tabled at the H&S Committee.

## 13. Responsibility

{{SAFETY_OFFICER_NAME}} owns the PPE programme: specifications, stockholding, the issue register, inspections and audit. Line supervisors enforce daily compliance.
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

In accordance with General Safety Regulation 2A read with section 8 of the OHS Act, {{COMPANY_NAME}} prohibits any person who is, or who appears to be, under the influence of intoxicating liquor, narcotic drugs or any other intoxicating substance from entering or remaining on premises or sites under its control. The use, possession, distribution, sale or manufacture of any such substance on company property is strictly forbidden and may lead to summary dismissal and reporting to the South African Police Service.

## 2. Application

This policy applies to all employees, sub-contractors, visitors and delivery personnel.

## 3. Prohibited

- Reporting for duty under the influence of alcohol or any drug having a narcotic or intoxicating effect.
- Possessing or consuming alcohol on site.
- Possessing, using or trafficking illegal substances.
- Misusing prescription medication that may affect work ability without disclosing it.

## 4. Prescription Medication

Employees taking prescription medication that may impair judgement, reaction time or balance must inform their supervisor before commencing work.

## 5. Testing Programme

{{COMPANY_NAME}} operates a testing programme conducted by suitably trained personnel in accordance with documented protocols:

### 5.1 Categories of test

- **Pre-employment / pre-placement** — for safety-critical positions (operators of mobile plant, drivers, working-at-heights, electricians, riggers, banksmen, confined-space entrants, supervisors).
- **Periodic** — annual for safety-critical positions, as part of the medical surveillance programme.
- **Random** — by computer-generated selection, no warning, both day and night shift, at a sampling rate of not less than 10% of safety-critical roles per quarter.
- **For-cause / reasonable suspicion** — based on observed indicators (slurred speech, unsteady gait, smell of alcohol, abnormal behaviour) documented on the Reasonable Suspicion Report by two trained observers (usually the supervisor and the Safety Officer).
- **Post-incident** — mandatory after any incident resulting in injury requiring more than first aid, significant property damage, or where reasonable suspicion of substance use exists.
- **Return-to-duty** — after any period of leave related to substance use treatment.

### 5.2 Methodology

- Alcohol — calibrated evidential breathalyser. Threshold for impairment: any reading above 0.00 mg/l breath alcohol concentration on site (zero tolerance) and 0.24 mg/l for the purpose of declaring an offence. A confirmatory test is taken 15 minutes after a positive screen.
- Drugs — oral fluid / urine immunoassay screen for at least the following panel: amphetamines, cannabis (THC), cocaine, opiates, methamphetamine, benzodiazepines. Positive screens are confirmed by laboratory GC-MS / LC-MS using chain-of-custody procedures.
- A Medical Review Officer reviews all non-negative laboratory results and engages the donor before a final result is recorded.
- Records of testing are confidential and held by occupational health under the rules applicable to medical records.

### 5.3 Refusal

Refusal to submit to a test, tampering with a sample, or attempting to substitute a sample, is treated as a positive result for disciplinary purposes.

## 6. Consequences

A positive test, refusal or visible impairment results in:

- Immediate removal from the workplace and prohibition of self-driving home.
- Suspension pending a formal disciplinary enquiry.
- Sanction up to and including summary dismissal for a first offence in respect of safety-critical work.
- Where appropriate, reporting to the South African Police Service and to the relevant statutory body.

## 7. Voluntary Disclosure & Employee Assistance

An employee who, before being selected for any test or any incident, voluntarily discloses a dependence and requests assistance:

- Is referred without disciplinary consequence to the Employee Assistance Programme.
- May be temporarily moved to a non-safety-critical role for the duration of treatment.
- Returns to safety-critical duty only after a negative return-to-duty test and a treatment-provider's letter of fitness.
- Is subject to an enhanced random testing regime (monthly) for a period of 24 months from the date of return.

## 8. Prescription Medication

Employees lawfully using prescription or over-the-counter medication that may impair judgement, reaction time, balance or sleep must inform their supervisor before commencing work. The Occupational Health Practitioner determines fitness for the assigned task; alternative duty is provided where necessary.

## 9. Records & Confidentiality

Testing records are medical records, retained by occupational health for the period required by law, accessible only to the worker, the Medical Review Officer and (in anonymised form) to management for the purpose of programme oversight.

## 10. Responsibility

The Section 16(2) Appointee owns this policy. {{SAFETY_OFFICER_NAME}} arranges testing logistics and disciplinary follow-up; Human Resources arranges enquiries; Occupational Health holds the medical records.
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

Every employee, sub-contractor and visitor at {{COMPANY_NAME}} has the unconditional right — and the express duty — to stop any work activity they reasonably believe poses an imminent risk of serious harm to people, property or the environment. Stop Work Authority (SWA) is a cornerstone of our safety culture and is exercised without fear of victimisation or reprisal, in line with section 14 of the OHS Act.

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

## 4. Stop Work Card & Register

A pre-numbered Stop Work Card is completed for every SWA event. The card records: the date and time, the location and activity stopped, the reason, the person stopping the work, the supervisor notified, the immediate corrective action, the formal corrective action with a due date and responsible person, and the verification before resuming work. Cards are entered into the Stop Work Register and reviewed at the next H&S Committee meeting; trends are analysed quarterly.

## 5. Resuming Work

Work may resume only when the supervisor (in consultation with the Safety Officer if the hazard category warrants it) has verified that:

- The hazard is eliminated or reduced to an acceptable residual level.
- A revised JSA or method statement has been agreed and signed.
- Any required permit, training or equipment is in place.
- The work team has been re-briefed.

## 6. No Reprisal

{{COMPANY_NAME}} prohibits any retaliation, victimisation, intimidation, financial penalty, withdrawal of overtime, or any other adverse treatment of any person who exercises Stop Work Authority in good faith — even if subsequent investigation finds the perceived risk was lower than first appraised. Any such retaliation is itself a serious disciplinary offence and is investigated as such.

## 7. Abuse of SWA

Malicious, vexatious or repetitive false invocation of SWA is dealt with under the disciplinary code. The threshold for proving abuse is high: an honest mistake is **not** abuse.

## 8. Recognition & Monitoring

- Every SWA invocation is acknowledged in writing by management within 7 days, irrespective of finding.
- A recognition programme rewards individuals and crews whose interventions prevent serious incidents.
- The number of Stop Work Cards raised is tracked as a leading indicator; an unusually low rate is treated as a warning sign of under-reporting rather than as good performance.

## 9. Training

SWA is covered in every site induction and reinforced quarterly in toolbox talks. All supervisors receive specific training on how to respond to an SWA event without being defensive.
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
    content: HEADER_BLOCK.replace("{{TITLE}}", "Driving & Vehicle Safety Policy") + `## 1. Purpose & Scope

This policy governs the use of every motor vehicle operated for or on behalf of {{COMPANY_NAME}} — company-owned, hired, leased, sub-contractor-owned and employee-owned vehicles used on company business — and gives effect to the National Road Traffic Act 93 of 1996, the Driven Machinery Regulations and Construction Regulation 23 (Construction Vehicles & Mobile Plant). Driving company business is treated as a workplace activity subject to the OHS Act.

## 2. Authorisation to Drive

No person may operate a vehicle on company business unless they hold a Letter of Authorisation issued by the Fleet Manager and signed by the line manager. The authorisation is conditional on:

- A valid South African driver's licence of the correct class, in physical possession during driving.
- A valid Professional Driving Permit (PrDP) where required — G (goods >3 500 kg GVM), P (passengers for reward), or D (dangerous goods).
- A current operator's certificate (Driven Machinery Regulations) for forklift, telehandler, MEWP, excavator, dozer, TLB, roller, mobile crane or any other driven machinery, issued by a registered training provider, refreshed at intervals not exceeding 24 months.
- A clean traffic record check at appointment and annually thereafter; significant infringements (over-speeding >40 km/h above limit, reckless / negligent driving, driving under the influence) trigger re-assessment.
- An annual eye test (Snellen 6/12 with both eyes; field of view 120Â°; no uncorrected colour-blindness for traffic-signal-critical roles).
- A defensive-driving certificate for drivers of heavy / passenger / dangerous-goods vehicles, refreshed every 24 months.
- An annual medical certificate of fitness in terms of Construction Regulation 7(1) for drivers operating on construction sites.

Licence and certificate copies are kept on file by HR and verified against the original at issue, on renewal and at annual audit. Suspended, withdrawn, expired or fraudulent licences result in immediate withdrawal of authorisation.

## 3. Vehicle Specification & Maintenance

- All vehicles are roadworthy in terms of the National Road Traffic Act and carry a valid licence disc, COR / COF where applicable, and insurance.
- A planned preventive-maintenance programme by an authorised dealer or accredited workshop services every vehicle at the manufacturer's recommended intervals or 10 000 km, whichever comes first. Service records are filed.
- Tyres are replaced at 1.6 mm tread (sooner for heavy vehicles or wet-climate routes). Re-treaded tyres are prohibited on the steering axle.
- Every vehicle carries: spare wheel, jack and wheel-spanner; reflective warning triangles (two); a 1 kg DCP fire extinguisher (with service tag in date); a first-aid kit (Regulation 7 contents); reflective vest for the driver; the up-to-date logbook.
- Long-haul and heavy vehicles additionally carry: high-visibility chocks; reflective rear marker board; load-securing straps inspected pre-trip.
- Reversing alarms and amber rotating beacons are fitted to all light vehicles entering construction sites and to all yellow-fleet items.
- Seatbelts in all seating positions, including rear, are serviceable and used.

## 4. Pre-Use Inspection

Drivers complete the Vehicle Pre-Use Checklist before each shift, on paper or on the digital app, and sign it. Defects are categorised as: (A) safety-critical — vehicle parked and reported immediately; (B) major — reported and repaired within 24 hours; (C) minor — reported at next service. A vehicle with a category A defect may not be driven until the defect is corrected and signed off.

The checklist includes: tyres (including spare) for pressure, tread, sidewall damage and lug-nut torque; lights, indicators, hazards, brake lights and reverse lights; brakes (parking and service); steering free play; fluid levels (oil, coolant, brake, power steering, screen-wash); battery and electrical; mirrors, screens and wipers; horn; seatbelts; first aid kit; fire extinguisher; warning triangles; load-securing equipment; vehicle documents (licence disc, logbook, driver's licence, PrDP).

## 5. Journey Management

- Trips of more than 200 km or more than 3 hours' driving are pre-planned: route, expected duration, scheduled rest stops, fuel stops, overnight accommodation, emergency contact.
- Departure and arrival are reported to a duty controller.
- Hours of driving comply with section 70 of the National Road Traffic Act and the National Road Traffic Regulations — maximum 15 hours' driving in any 24 hours including breaks; maximum 5 hours' continuous driving; minimum 30-minute rest after 5 hours; minimum 8 hours' continuous rest in any 24 hours.
- High-risk routes (night driving in mountainous terrain, dangerous goods through dense urban areas, single-driver long haul) require approval from the line manager.

## 6. Behaviour at the Wheel

- Seatbelts in all positions, all the time.
- Speed: within the legal speed limit and within the conditions of road, weather and visibility, whichever is lower. Company maximum speeds: 100 km/h for light vehicles on freeways; 80 km/h for goods >3 500 kg; 40 km/h on construction sites; 15 km/h within material laydown areas and adjacent to pedestrians; 5 km/h reversing.
- Cellphone use — prohibited whether held or hands-free, both for voice calls and for any message handling. Devices are silenced and stowed before the engine is started.
- Eating, drinking, smoking and any in-vehicle entertainment that distracts from the driving task are prohibited.
- Following distance: minimum 3 seconds dry, 4 seconds wet, 5 seconds at night or under poor visibility.
- Reverse parking on arrival is standard.
- Spotter / banksman required for all reversing of heavy vehicles in occupied areas.

## 7. Fatigue Management

Fatigue is treated with the same seriousness as alcohol. Indicators are wandering across lanes, missed exits, micro-sleeps, repetitive yawning. A driver who is fatigued is required to stop immediately at a safe location and rest until fit, irrespective of schedule pressure. Disciplinary action does **not** follow a fatigue-related delay reported in advance.

## 8. Alcohol & Drugs

The Alcohol & Drug Policy applies in full. The legal limit (0.24 mg/l breath, 0.05 g/100 ml blood; 0.10 mg/l breath, 0.02 g/100 ml blood for PrDP holders) is the State threshold for prosecution — the company threshold for driving on company business is zero.

## 9. Vehicle Incidents

- All incidents — including "minor" parking bumps, single-vehicle off-road events and near-misses — are reported within 24 hours on the Vehicle Incident Report Form.
- The driver remains at the scene (where safe), ensures injured persons receive first aid, calls emergency services where required, secures the scene, photographs damage and exchanges details.
- Post-incident substance testing is mandatory for any injury or significant damage.
- An IVMS / telematics download is preserved.
- A formal investigation is conducted using ICAM; corrective actions are tracked to closure.

## 10. In-Vehicle Monitoring

Company vehicles are fitted with GPS / IVMS telematics that record location, speed, harsh acceleration / braking / cornering and seatbelt use. Reports are reviewed monthly by the Fleet Manager and discussed with drivers. The data is used both as a coaching tool and as evidence in disciplinary matters.

## 11. Sub-contractor Drivers

Sub-contractor drivers undergo the same authorisation process before being allowed to drive on company business or on any site under company control.

## 12. Records

Licences, PrDPs, medicals, defensive-driving certificates, vehicle inspection sheets and incident reports are retained for the period required by law and, in any event, for not less than three years.
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
    content: HEADER_BLOCK.replace("{{TITLE}}", "Working at Heights Policy") + `## 1. Definitions

- **Working at heights** — any work performed where a person could fall a distance of 2 metres or more, or where a fall of any height could result in injury (e.g. into machinery, water, traffic, hot or chemical processes, on rebar). Construction Regulation 10 applies.
- **Competent person (Construction Reg 10)** — a person who has the knowledge, training and experience specific to the work or task being performed, is registered with a relevant statutory body and has been issued a competency certificate accepted by the Department of Employment & Labour.
- **Fall arrest** — a system designed to arrest a fall already in progress, limiting deceleration force on the worker to 6 kN and free-fall distance to 2 m.
- **Travel restraint** — a system that prevents the worker from reaching a fall hazard; preferred over fall arrest where layout permits.
- **Total fall distance** — lanyard length + deceleration distance + harness stretch + worker height below D-ring + safety margin (minimum 1 m).
- **Anchor** — a structural attachment certified at minimum 12 kN for single-user arrest, or 22 kN for two users, or designed by a professional engineer.

## 2. Hierarchy of Fall Protection

In order of preference:

1. **Eliminate** — design the work to be done at ground level (e.g. pre-assemble components on the ground and lift complete).
2. **Passive collective protection** — guard-rails (top rail 1.0 to 1.1 m, mid-rail at 500 mm, toe-board 150 mm), covered openings, scaffolding with deck and edge-protection, mobile elevating work platforms.
3. **Travel restraint** — harness and lanyard set to length such that the worker cannot reach the fall edge.
4. **Fall arrest** — full body harness (SANS 50361 / EN 361), double lanyard with energy absorber (SANS 50355 / EN 355), self-retracting lanyard, certified anchor and a documented rescue plan.
5. **Work positioning** — used only in conjunction with a back-up fall arrest system.

The selection rationale is recorded in the Fall Protection Plan for every task.

## 3. Fall Protection Plan (Construction Reg 10(1)(a))

A written Fall Protection Plan, compiled and signed by a Construction-Reg-10-competent person, is in place before any work at heights begins. It contains:

- The risk assessment for the specific work at heights.
- The procedures, controls, equipment and PPE selected.
- The names of all competent persons and authorised workers.
- A rescue procedure, with the names of trained rescuers, the rescue equipment and the maximum tolerable suspension time.
- The emergency procedure including notification, summoning and management of a suspended casualty.
- The procedure for inspection of all equipment.
- The training and medical fitness records.

## 4. Worker Requirements

No person performs work at heights unless they have:

- A valid certificate of fitness from an Occupational Medical Practitioner (Construction Reg 7 and Reg 10(1)(c)) addressing fitness for working at heights specifically — vertigo, epilepsy, cardiac, diabetic, blood-pressure and musculoskeletal screen.
- A current Working at Heights certificate (theory + practical assessment) from an accredited training provider, refreshed every 24 months.
- A current Harness User certificate covering inspection, donning, anchoring and self-rescue.
- Where the worker is to perform rescues, an additional Suspended-Casualty Rescue certificate.
- A documented psychological assessment (where the risk assessment identifies indications for one).

## 5. Equipment

- All fall protection PPE is procured from a reputable manufacturer with the SANS / EN mark and the date of manufacture.
- A unique serial number is engraved or labelled on every harness, lanyard, anchor, connector and SRL.
- The Equipment Register records: item, serial, manufacturer, date of issue, expiry, inspection history, condition.
- **Pre-use inspection** by the user before every use — webbing, stitching, hardware, energy absorber, lanyard ends.
- **6-monthly inspection** by a Construction-Reg-10 competent person, logged in the register; sticker affixed to the harness with date and inspector identifier.
- **Service life**: 6 years from date of manufacture for textile components, unless the manufacturer specifies otherwise; lifetime for hardware if not deformed. Any component subjected to a fall arrest event is permanently withdrawn from service.

## 6. Anchors

- Permanent anchors are installed and certified by a competent engineer; tested to 22 kN.
- Temporary anchors (cross-arm straps, beam anchors, deadweight) are inspected before each use.
- The Anchor Register identifies every certified anchor on site with a photograph, location and certification number.
- Improvisation — anchoring to gutters, light fittings, conduits, ductwork, unsecured scaffolding or unrated structural members — is strictly prohibited.

## 7. Rescue

Rescue is **planned** before work commences. The plan addresses suspension trauma, which can become critical in 5 to 30 minutes of immobile suspension. Rescue equipment matched to the system (mechanical advantage haul, descent device, rescue tripod, MEWP rescue) is on-site, not back at the office. A minimum of two trained rescuers are present whenever fall-arrest is in use. Rescue drills are conducted quarterly with timed results recorded.

## 8. Permit System

A Working-at-Heights Permit is issued by {{SAFETY_OFFICER_NAME}} or a delegated competent person before any work commences:

- above 6 metres;
- on a roof of any pitch;
- within 2 metres of an unprotected edge or opening;
- on a fragile surface (translucent sheeting, weathered fibre-cement, glass);
- in adverse weather windows;
- at night.

The permit is valid for a single shift, a single defined location and a single defined activity.

## 9. Adverse Conditions

Work at heights is suspended when wind speed exceeds 32 km/h (40 km/h for ground-supported scaffolding only); during lightning storms; in heavy rain affecting visibility or footing; or where any surface is icy or wet beyond a safe friction threshold. A handheld anemometer is used to verify wind on exposed steel.

## 10. Prohibitions

- Lone working at heights with fall-arrest systems.
- Working at heights from a ladder (ladders are for access / egress only; brief light work above 6 m may be performed from a ladder only with a separate task-specific risk assessment and a stand-by buddy).
- Working at heights without a current permit where one is required.
- Use of damaged, expired, modified or unmarked equipment.
- Stacking pallets, scaffolding components or any improvised platform to gain working height.
- Sub-contractor crews working at heights without a Section 37(2) Mandatary Agreement and verified competence.

## 11. Roles

- {{SAFETY_OFFICER_NAME}} owns the policy, the Fall Protection Plans, the Equipment Register and the Rescue Programme.
- Construction Reg 10 competent person signs every plan and every 6-monthly inspection.
- Site supervisor verifies daily that workers, equipment and conditions are compliant before authorising work to commence.
- Workers inspect their own equipment pre-use and report defects.

## 12. Records

The Fall Protection Plan, Equipment Register, training certificates, medical fitness certificates, inspection records, permits and rescue drill reports are retained for not less than five years.
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
    content: HEADER_BLOCK.replace("{{TITLE}}", "Hot Work Policy") + `## 1. Definition & Scope

"Hot work" means welding (arc, MIG, TIG, stick, spot), oxy-fuel cutting and heating, plasma cutting, grinding, disc-cutting, brazing, soldering, thermal spraying, the use of blow-torches, induction heating, and any other operation that generates an open flame, electric arc, sparks, slag, hot surfaces or significant heat capable of igniting combustible material. The policy applies on every premises and site under the control of {{COMPANY_NAME}}, in accordance with General Safety Regulation 9, Environmental Regulations for Workplaces Reg 9 and SANS 10238 (Oxy-fuel) and SANS 10142-1 (electrical welding).

## 2. Permit-to-Work

No hot work commences without a current Hot Work Permit issued by {{FIRE_MARSHAL_NAME}} or a competent delegated issuer. Permits are pre-numbered, valid for a single shift, a single defined location and a single defined activity, and are returned, signed-off and filed at the end of work. The permit is posted at the work location.

## 3. Pre-Work Survey

Before issuing the permit the issuer inspects the site and confirms:

- Combustible material within an 11-metre radius (horizontal and vertical) is either removed or shielded with non-combustible barriers, fire-retardant blankets (SANS 10238) and dampened sheeting as appropriate.
- Floor and wall openings, ductwork penetrations, drains, cable trays and pipe penetrations within the radius are covered, sealed or shielded against falling sparks and slag.
- Where work is on partitions, walls or ceilings, the opposite side is inspected, posted with a stand-by, and any combustibles removed.
- The work area atmosphere has been tested with a calibrated 4-gas monitor for flammable vapours where any risk of vapour exists. LEL is below 5%.
- Sprinklers and smoke detectors are operational; smoke detectors in the immediate area may be isolated only with written approval, restored within 30 minutes of work completion, and logged.
- A trained Fire Watcher is briefed, equipped and in position.
- Suitable extinguishers (DCP 9 kg minimum, or COâ‚‚ 5 kg minimum, plus a charged fire hose where available) are within 9 m of the work and accessible.
- Hot work on closed containers, vessels, tanks, drums or pipework that has previously held a flammable, combustible or unknown substance is **not authorised** until the vessel has been emptied, cleaned, gas-freed (verified by 4-gas monitor with LEL <1%), and continuously ventilated.
- Hot work in a confined space requires a separate Confined Space Entry Permit running concurrently with the Hot Work Permit.

## 4. Fire Watch

- A trained Fire Watcher is present **throughout** the hot work and for not less than 60 minutes after work stops (and after the lunch break or any other extended pause). During the fire watch period the Fire Watcher does no other task, including no cellphone use.
- The Fire Watcher is competent in operating an extinguisher (theoretical and practical training within 12 months), knows the alarm activation procedure, and has the contact details of the emergency services.
- For high-risk work (vapour areas, near insulation, multi-level structures) two Fire Watchers may be required — one at the work and one on the opposite side or the level below.

## 5. Equipment

- Gas cylinders are stored upright, chained to a stable structure, with their valve protection caps in place when not in use, and with full and empty cylinders segregated and labelled.
- Cylinder valves are opened slowly; oxygen valves are never opened in the presence of oil, grease or any hydrocarbon.
- Flashback arrestors are fitted at both the regulator and the torch end of every oxy-fuel set; non-return valves on every line.
- Hoses are inspected pre-use for cracks, cuts and contamination, and replaced on any defect; whip-checks or cable ties secure couplings.
- Welding leads are inspected for nicks, cracks and burns; earth returns are clamped directly to the workpiece, not to scaffolding, conduits, pipes, structural steel or rebar.
- Power-source enclosures and earthing are intact.
- Welding screens of opaque flame-retardant material isolate adjacent work areas from arc flash.
- Local exhaust ventilation extracts fume at source; respirator backup (P3) for galvanised, coated, painted or stainless work.

## 6. PPE

Auto-darkening welding helmet (shade 9 to 14 matched to process), full-length leather apron, leather gauntlets and sleeves, flame-resistant overalls (SANS 1423), safety boots, hearing protection. P2 or P3 respirator (with the appropriate gas cartridge if vapours are present) on coated, plated, painted or galvanised metal. Powered air-purifying respirator for prolonged work or stainless steel where hexavalent chromium fume is generated.

## 7. Cylinder Storage & Transport

- Outdoor, shaded, fenced cylinder store with separation between oxidisers (oxygen, nitrous oxide) and fuel gases (acetylene, LPG): minimum 6 m, or a 1.6 m non-combustible barrier extending 500 mm above the taller cylinder.
- LPG and acetylene cylinders are not stored in basements or below-ground areas.
- Transport upright in a vented cradle; never in the cab of a vehicle.
- A signed Cylinder Register tracks every cylinder on and off site.

## 8. Prohibitions

- Hot work without a current permit posted at the work.
- Hot work in atmospheres above 5% LEL.
- Hot work on closed containers without gas-freeing and continuous monitoring.
- Hot work within 11 m of explosive, flammable or oxidising material that has not been removed or fully shielded.
- Hot work in confined spaces without the additional confined-space permit.
- Hot work performed by an untrained person; welders are trade-tested or competency-assessed and identified by name on the permit.
- Hot work where smoke detection has been isolated and not reinstated.

## 9. Roles

- {{FIRE_MARSHAL_NAME}} issues and audits permits, maintains the register, and conducts random spot inspections.
- Welders / cutters are responsible for the safe operation of their equipment and for stopping work immediately on any abnormality (gas smell, hose damage, unsafe environment).
- Fire Watchers maintain a constant watch, sound the alarm, and operate the first-response extinguisher.
- Supervisors verify the permit is in place before allowing the activity to start on their shift.

## 10. Records

The Hot Work Permit Register is retained for not less than three years. Permits, gas-test calibration certificates, welder competencies and Fire Watcher training records are filed in the H&S file.
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

To protect employees, contractors, visitors and the public from communicable disease transmitted in or arising from the workplace, in accordance with section 8 of the OHS Act, the Hazardous Biological Agents Regulations, 2022 (HBA Regs) and the requirements of the National Health Act.

## 2. Risk Categorisation

Hazardous biological agents are classified per HBA Reg 5 by risk group (RG1 to RG4). Workplaces and activities are assessed for exposure pathways: airborne droplet, airborne aerosol, contact (skin, mucous membrane), vector-borne, and contaminated-surface (fomite). The Baseline HIRA covers biological agents alongside other hazards, and is updated whenever a new agent (e.g. an epidemic-stage pathogen) emerges.

## 3. General Hygiene Standards

- Hand-washing stations with running water, liquid soap and disposable towels at every welfare unit, ablution, canteen and worksite entry.
- 70% alcohol hand sanitiser at additional points (turnstiles, vehicle cabs, shared tool stores, meeting rooms).
- Drinking water from a Department-of-Water-and-Sanitation approved source; potable water signage; no shared cups.
- Ablutions cleaned at least twice per shift, with cleaning records signed and posted.
- Eating, drinking and smoking are confined to designated areas separated from production / construction zones.
- Shared tools, control surfaces, vehicle cabs, MEWP controls and PPE that cannot be assigned to a single user are wiped down at shift hand-over with an appropriate disinfectant.
- Personal-use PPE is not shared; where shared PPE is unavoidable (welding helmets, PAPR hoods) the inner surface is cleaned and a disposable hood liner is used.

## 4. Reporting of Illness & Symptoms

Employees presenting any of the following symptoms before or during a shift report to the supervisor and do not enter or remain in the workplace until reviewed by the Occupational Health Practitioner:

- Fever ≥ 37.8 Â°C.
- Persistent cough, shortness of breath.
- Diarrhoea, vomiting or jaundice.
- Unexplained rash, sores or open wounds.
- A positive notifiable-disease test within the prior 14 days.

Sick leave to seek medical assessment is unconditional; presenteeism is discouraged. Workers placed on isolation by a medical practitioner remain on certificated leave until cleared. Confidentiality of medical information is maintained.

## 5. Notifiable Diseases

Diseases listed under the National Health Act Notifiable Medical Conditions Regulations (e.g. tuberculosis, measles, viral haemorrhagic fevers, cholera, plague, meningococcal disease, Hepatitis A, food-borne intoxications above a defined incidence) are reported to the relevant District Health authority by the Occupational Health Practitioner. Workplace cases that meet the COIDA threshold are reported as occupational diseases.

## 6. Outbreak Response

On confirmation of a cluster or notifiable case, {{COMPANY_NAME}} will:

- Notify the Provincial Department of Health and the Department of Employment & Labour where required by law.
- Convene the Incident Management Team within 4 hours.
- Conduct contact tracing covering the infectious period back from symptom onset; communicate with affected workers individually.
- Isolate confirmed cases per public-health guidance; quarantine close contacts where instructed.
- Implement enhanced environmental cleaning of affected areas using the disinfectant matched to the pathogen.
- Reassess the Baseline HIRA and implement additional engineering, administrative and PPE controls (e.g. respiratory protection upgrade to N95 / P2, increased ventilation, partitioning, shift de-densification, remote-work arrangements).
- Maintain communication with the workforce through daily briefings and the H&S Committee.

## 7. Vaccination

Vaccinations recommended by the Department of Health for the worker's exposure profile are made available at company cost (tetanus for all construction workers; hepatitis A / B for workers exposed to sewerage or human blood; rabies pre-exposure for select roles; seasonal influenza voluntary; the current routine adult schedule). Vaccination records are kept by Occupational Health.

## 8. Pregnancy & Vulnerable Workers

Pregnant workers and workers with medical conditions affecting immunity disclose voluntarily to Occupational Health, which assesses fitness for the specific exposure profile and recommends alternative duty or additional controls where required.

## 9. Sub-contractor & Visitor Controls

Sub-contractors are required to apply equivalent hygiene standards. Visitors are screened at access, declare relevant symptoms, and are issued PPE matched to the area they enter.

## 10. Records

Medical and surveillance records are retained for the period required by HBA Reg 10 (forty years where the agent so requires) and are accessible only on a need-to-know basis to comply with the rules governing medical records.

## 11. Responsibility

The Occupational Health Practitioner owns the medical and surveillance programme. {{SAFETY_OFFICER_NAME}} owns the hygiene programme and the outbreak-response plan. Line management enforces daily compliance.
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
    content: HEADER_BLOCK.replace("{{TITLE}}", "Incident & Injury Reporting Procedure") + `## 1. Purpose & Scope

This procedure ensures that every incident, injury, dangerous occurrence, occupational disease and near-miss occurring on premises or sites under the control of {{COMPANY_NAME}} is reported, recorded, investigated and that effective corrective actions are implemented to prevent recurrence. It gives effect to section 24 and section 25 of the OHS Act, General Administrative Regulation 8 (GAR 8), and the requirements of the Compensation for Occupational Injuries and Diseases Act, 130 of 1993 (COIDA).

The procedure applies to all employees, sub-contractors (as deemed employees per section 37(2)), labour-broker workers, visitors and members of the public affected by company operations.

## 2. Definitions

- **Incident** — any unplanned, undesired event arising out of and in the course of work that results in, or has the potential to result in, injury, ill-health, damage to property, environmental harm, security breach or other loss.
- **Injury** — personal injury, occupational disease or ill-health.
- **First aid case (FAC)** — injury requiring single-treatment first aid with no further medical follow-up, no time off and no work restriction.
- **Medical treatment case (MTC)** — injury treated by a medical practitioner (beyond first aid) but with no time lost beyond the day of the incident.
- **Restricted work case (RWC)** — injury preventing the worker from performing all their normal duties on the next shift, but no shift fully lost.
- **Lost-time injury (LTI)** — injury resulting in absence from work for one or more full shifts after the day of injury.
- **Section 24 incident** — any incident which (a) results in a fatality, (b) results in injuries likely to result in permanent disablement, (c) results in unconsciousness, loss of substantial limb or hospital admission, (d) results in loss of >14 days' work, (e) is a dangerous occurrence, or (f) is the release of a substance with potential off-site impact.
- **Dangerous occurrence** — unplanned event with serious potential (collapse, scaffold failure, crane failure, uncontrolled release, fire, explosion, electrical flashover, runaway plant) regardless of whether injury occurred.
- **Occupational disease** — any disease listed in Schedule 3 of COIDA or any other disease arising out of and in the course of employment.
- **Near-miss / High Potential Incident (HPI)** — incident without injury or loss but with the credible potential for either.

## 3. Immediate Actions at the Scene

When an incident occurs the discovering worker or supervisor shall, in this order:

1. **Secure the scene** — stop the activity, isolate energy sources, prevent further harm, evacuate non-essential personnel.
2. **Render aid** — commence first aid (DRSABCD); call the appointed First Aider; for serious injury call EMS on 10177 (cellphone 112). Do not move a casualty unless they are in further immediate danger.
3. **Notify** — inform the line supervisor and {{SAFETY_OFFICER_NAME}} on {{SAFETY_OFFICER_CONTACT}} immediately. The Safety Officer notifies executive management for any Section 24 event without delay.
4. **Preserve evidence** — do not disturb the scene, plant, tools, materials, PPE, position of casualty, switchgear or any item until released by the Safety Officer or, in Section 24 cases, by the Department of Employment & Labour inspector (s 24(3) prohibits disturbance without prior approval, except to save life, prevent further injury, or maintain essential services).
5. **Photograph** — take photographs of the scene before any cleanup, from multiple angles, with reference for scale.
6. **Identify witnesses** — list everyone in the area; collect contact details and request that they remain available for an interview.

## 4. Reporting Timeline & Channels

| Event | Recipient | Method | Timing |
|-------|-----------|--------|--------|
| All incidents (verbal) | Supervisor and Safety Officer | Phone / in-person | Within 1 hour |
| All incidents (written) | Safety Officer | Incident Report Form | Within 24 hours |
| Section 24 incident (initial) | Provincial Director, Department of Employment & Labour | Telephone / email | As soon as possible, in any event within 24 hours |
| Section 24 incident (formal) | Provincial Director, DoEL | Annexure 1 (W.Cl.1) form | Within 7 days |
| Occupational injury (COIDA) | Commissioner for COIDA | W.Cl.2 / online claim | Within 7 days |
| Occupational disease | Commissioner for COIDA | First Medical Report W.Cl.22 + Notice of Occupational Disease | Within 14 days of diagnosis |
| Notifiable medical condition | Provincial Department of Health | NMC form | As prescribed (typically within 24 hours) |
| Incident affecting client / project | Client representative | As required by contract | As per contract, typically 24 hours |
| Insurance claim | Risk department / broker | Per policy | As per policy |

For sites under the Mine Health and Safety Act or other specific legislation, the corresponding statutory reporting routes apply in parallel.

## 5. Internal Documentation

- **Incident Report Form** — completed for every event, including near-miss. Captures who, what, when, where, why and the immediate response.
- **Witness Statement Form** — written, signed and dated in the witness's own words. The form opens with the disclaimer that the statement is voluntary and may be used in subsequent proceedings.
- **Section 24 Annexure 1 (W.Cl.1)** — used for all reportable incidents to DoEL; copies retained for 3 years.
- **COIDA W.Cl.2** — used for compensation claims for occupational injury.
- **Incident Register** — the master list of all incidents on site, maintained continuously, available for inspection by H&S Representatives, the H&S Committee, the client and the DoEL inspector.

## 6. Investigation

6.1 **Trigger and Depth.** All incidents are investigated. The depth of investigation scales with the actual and potential severity:

| Category | Lead | Method | Team |
|----------|------|--------|------|
| Near-miss / first aid | Line supervisor | 5-Why | Supervisor + H&S Rep |
| Medical treatment / restricted work | {{SAFETY_OFFICER_NAME}} | 5-Why or Tap-Root | Supervisor, H&S Rep, Safety Officer |
| Lost-time injury / property damage > R50 000 | Safety Officer | ICAM | Safety Officer, Operations Manager, H&S Rep, Subject Matter Expert |
| Section 24 / dangerous occurrence | Section 16(2) Appointee | ICAM with external facilitator if required | Section 16(2), Safety Officer, Operations Manager, Legal, H&S Rep, SME |
| Fatality | Chief Executive | ICAM with external investigator; DoEL leads the statutory enquiry | As Section 24 plus Legal and Communications |

6.2 **Method.** The Incident Cause Analysis Method (ICAM) is the standard method for serious investigations, examining: absent / failed defences, individual / team actions, task / environmental conditions, organisational factors, and external influences. For shallow investigations the 5-Why technique with verifiable evidence at every step is used. The investigation produces a chronology, an evidence inventory, an absent defences analysis, a root cause statement and SMART corrective actions.

6.3 **Timing.** Investigations commence within 24 hours of the incident. Section 24 investigation reports are issued within 14 working days; lesser investigations within 7 working days.

6.4 **Co-operation with the regulator.** Where a DoEL inspector attends, the Section 16(2) Appointee or designated representative makes the site, documents, witnesses and personnel fully available. Internal investigation continues in parallel.

## 7. Corrective & Preventive Actions

Corrective actions are categorised against the hierarchy of control. Administrative actions (training, signage, briefings) are accepted only when higher-order controls are not reasonably practicable, and the rationale is recorded. Each action has a single named owner, a target date, evidence of completion and a verification step. Actions are tracked in the Action Tracker; outstanding items are escalated at the weekly site meeting and the monthly H&S Committee. Closed actions are audited at random by the Safety Officer for effectiveness.

## 8. Lessons Learned & Communication

Within 5 working days of every recordable incident, a one-page Safety Alert is issued in the worker's first language. The alert covers what happened, how it happened, immediate actions, and three things the workforce can do differently. The alert is read in the next toolbox talk, signed by attendees and filed. For high-potential incidents the alert is also shared with sub-contractors and, where appropriate, the client and the industry forum.

## 9. Records & Retention

- Incident Register, Incident Reports and Investigation Reports: 5 years minimum (10 for Section 24).
- COIDA documents: as required by the Commissioner (claims file retained for life of file + 4 years).
- Medical records of occupational disease: 40 years from the date of last exposure (HBA / Asbestos / Lead / Silica regs as applicable).
- DoEL correspondence: 5 years.
- Witness statements: stored in confidential file, retained 5 years.

## 10. No-Blame Reporting

{{COMPANY_NAME}} operates a no-blame reporting culture for honest reports of incidents and near-misses. Workers who report in good faith are protected from disciplinary action, even where their own conduct contributed to the event, provided the conduct was not reckless, malicious or under the influence of substances. Concealment, falsification or non-reporting is itself a serious disciplinary offence. The distinction between honest error and reckless or wilful misconduct follows the principles of a just culture.

## 11. Recovery & Return-to-Work

For injured workers an occupational rehabilitation plan is established in conjunction with the treating medical practitioner and the occupational health practitioner. Modified or alternative duty is offered where the worker is medically fit but not yet able to perform full duties. Return-to-work is gated on a medical fitness certificate.

## 12. Roles & Responsibilities

- **Worker / Witness** — secure the scene, render aid, notify, preserve evidence, provide a truthful statement.
- **Supervisor** — attend the scene, take command of immediate response, complete the Incident Report Form, lead shallow investigations.
- **{{SAFETY_OFFICER_NAME}}** — lead serious investigations, ensure statutory reporting, maintain the register, drive corrective actions, communicate lessons.
- **Section 16(2) Appointee** — accountable for the statutory notification of Section 24 incidents, the adequacy of investigations, and the implementation of corrective actions.
- **HR / COID Administrator** — lodge COIDA claims, manage medical-aid and compensation, support the rehabilitation plan.
- **Executive** — review incident statistics monthly, chair the Section 24 review, sponsor corrective action funding.
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
    content: HEADER_BLOCK.replace("{{TITLE}}", "Emergency Evacuation Procedure") + `## 1. Purpose & Scope

This procedure establishes the action to be taken at {{SITE_NAME}} on detection of any emergency requiring evacuation, including fire, explosion, gas release, hazardous-chemical spill, structural collapse, bomb threat, armed-intruder event, severe weather, or any other event in which continued occupation of the premises poses a credible threat to life. It gives effect to Environmental Regulations for Workplaces Regulations 9 and 10, SANS 10400-T (Fire Protection), the National Building Regulations and the local-authority Fire Brigade by-laws.

## 2. Emergency Organisation

The site emergency organisation comprises:

- **Incident Controller** — the senior person on site, who assumes command on activation.
- **Fire Marshals** (one per 50 workers per floor / zone, identified by red vests with FIRE MARSHAL printed front and rear) — sweep the zone, account for evacuees, command first response.
- **First Aiders** (per General Safety Regulation 3) — establish casualty point at the assembly area, triage and treat.
- **Floor / Zone Wardens** — assist Fire Marshals and verify their assigned zones are cleared.
- **Buddy assistants** — named persons assigned to assist workers with mobility, hearing or visual disabilities, and to assist visitors.
- **Communications Officer** — manages communications with emergency services, families, media and the client.
- **Salvage Team** (selected high-risk sites) — attempts to remove critical records and dangerous goods if and only if safe to do so under Fire Marshal direction.

Appointments are in writing, posted on the H&S notice board, and re-issued whenever there is a change.

## 3. Detection & Alarm Activation

Any person discovering or suspecting an emergency shall:

1. Activate the alarm by breaking the nearest manual call point or sounding the air-horn / siren.
2. Call {{FIRE_MARSHAL_NAME}} or dial {{EMERGENCY_NUMBER}} from a safe location; in addition call the public emergency line 10177 (cellphone 112).
3. Provide the following information clearly: the type of emergency, the exact location, the number of casualties (known or estimated), the dangerous goods involved, and the safest approach for emergency services.
4. Attempt to fight an incipient fire (no larger than a waste-bin) only if trained on the extinguisher, the egress route remains behind the responder, and at least one other person is aware and standing by.

## 4. Action on Hearing the Alarm

- **STOP** all work immediately. Make machinery safe — use the local emergency stop, isolate energy where this can be done in seconds, and leave it.
- **LEAVE** personal belongings (lunchbox, bag, jacket). Take only the means of personal identification and your phone if immediately at hand.
- **WALK** — do not run, push, or stop in doorways. Use the nearest marked emergency escape route, not the route you came in by if a closer route is available.
- **DO NOT use lifts.** Use stairs.
- **ASSIST** visitors, contractors, mobility-impaired persons and learners; follow the buddy assignment.
- **CLOSE** doors and fire-doors behind you to slow smoke and fire propagation; do not lock.
- **REPORT** to your assigned assembly point. Remain there until the Fire Marshal authorises departure.

## 5. Assembly Points

The primary assembly point for {{SITE_NAME}} is marked on the Site Emergency Plan posted at each entry, each notice board and each muster point. An alternative assembly point is identified for use when wind, smoke direction, gas release direction or hazard area makes the primary point unsuitable. Assembly points are:

- A minimum of 30 m from any building under threat (60 m for high-rise or gas-handling installations).
- Clear of vehicle access routes used by emergency services.
- Equipped with signage, a high-visibility flag and an emergency kit (sign-in registers copy, first aid bag, megaphone, torch, high-visibility vests).

## 6. Roll Call & Accountability

The Fire Marshal performs a roll call against the daily sign-in register (updated continuously at the access-control turnstile or gate). The Fire Marshal reports to the Incident Controller:

- Total present at the assembly point.
- Names of any persons unaccounted for, their last known location, role and any disability or medical condition.
- Confirmation that the assigned zone is swept clear.

Unaccounted persons are reported to the attending emergency services immediately. **No employee, contractor or visitor re-enters the building under any circumstances until cleared by the senior fire officer or the Incident Controller.**

## 7. Special Circumstances

- **Persons with disabilities** — a Personal Emergency Evacuation Plan (PEEP) is prepared on induction; refuge areas are identified.
- **Lone workers and after-hours work** — lone-worker monitoring is mandatory; the controller calls emergency services on missed check-in.
- **Confined-space, work-at-heights or hot-work in progress** — separate emergency provisions in the permit override the general procedure for the affected persons; rescue is by the trained team in the permit, not by spontaneous responders.
- **Bomb threat** — the bomb-threat checklist is completed by the person receiving the threat; the building is evacuated by route furthest from the suspected device; no radios are used near the device; the South African Police Service Bomb Squad assumes scene command.
- **Armed intruder** — "run, hide, tell" applies; do not assemble at the standard assembly point if it is within line-of-sight or shooting range of the building; SAPS assumes scene command.
- **Hazardous-chemical release / gas plume** — evacuate upwind and uphill of the release; secondary assembly point applies; do not pass through visible vapour clouds.
- **Severe-weather lightning** — outdoor workers move to enclosed structures; assembly point may be inside a vehicle or substantial building during a lightning storm.

## 8. Communication with Emergency Services

The Communications Officer meets the responding fire / EMS / police crew at the gate, hands over the site plan, the dangerous-goods inventory, the roll call status, the unaccounted-persons list and the keys / access cards. The Incident Controller transfers command to the senior responding officer on their arrival, and remains the company's single point of contact for the duration of the response.

## 9. All-Clear & Re-Entry

Only the senior attending fire officer (and, in their absence, the Incident Controller after a full assessment) may authorise re-entry. On re-entry, the Fire Marshal performs a second roll call, the Safety Officer inspects the building for residual hazards, and operations resume in a controlled sequence. The Section 24 reporting test is applied to any incident that injured a person, was a dangerous occurrence, or that involved the fire brigade or a chemical release.

## 10. Drills & Training

- A full evacuation drill is conducted at least every 6 months and within 30 days of any material change in occupancy, layout or hazards.
- Drills are observed by the Safety Officer and an external observer where possible; timed; debriefed; and the resulting actions tracked to completion.
- Fire Marshals and Floor Wardens receive theoretical and practical training every 24 months; First Aiders every 36 months as required by GSR 3.
- All workers and contractors receive evacuation training on induction.
- Tabletop exercises covering bomb threat, armed intruder, hazardous-chemical release and major fire scenario are conducted annually.

## 11. Inspection & Maintenance of Emergency Equipment

| Equipment | Inspection | Frequency | Service |
|-----------|------------|-----------|---------|
| Manual call points & sirens | Functional test | Monthly | Annual by competent contractor |
| Smoke / heat detectors | Visual / functional | 6-monthly | Annual by SAQCC-FGS contractor |
| Fire extinguishers | Visual | Monthly | Annual service per SANS 1475 |
| Fire hose reels | Visual | Monthly | Annual hydrostatic test per SANS 1475 |
| Hydrants & risers | Pressure & flow | Monthly | Annual contractor test |
| Sprinkler system | Visual | Weekly | Quarterly + annual by ASIB contractor |
| Emergency lighting | Functional, 30 min battery | Monthly | Annual full-duration test |
| Fire doors & escape routes | Obstructions, signage | Daily | Annual integrity inspection |
| AEDs | Battery / pads | Monthly | Per manufacturer |
| Spill kits & PPE caches | Inventory | Monthly | Replace consumables on use |

Inspections are signed and logged; deficiencies are corrected within 24 hours or the affected area is taken out of use.

## 12. Records

The Emergency Plan, drill records, inspection logs and any actual emergency reports are retained for 5 years and made available on inspection by the local-authority fire brigade and the DoEL.
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
    content: HEADER_BLOCK.replace("{{TITLE}}", "Lockout / Tagout (Isolation of Energy) Procedure") + `## 1. Purpose & Scope

This procedure prevents injury arising from the unexpected energisation, start-up or release of stored energy in plant, machinery, equipment or installations during cleaning, inspection, set-up, fault-finding, adjustment, maintenance, modification or repair. It gives effect to General Machinery Regulation 3, Electrical Installation Regulations 2009 Regulation 9, Driven Machinery Regulations and SANS 10380.

The procedure applies on all premises and sites under the control of {{COMPANY_NAME}} and is binding on employees, sub-contractors, OEMs, service providers and equipment hirers.

## 2. Definitions

- **Energy source** — electrical, mechanical, hydraulic, pneumatic, thermal, chemical, gravitational, radiological, or stored (capacitors, springs, raised loads, pressurised systems).
- **Authorised Person** — an employee who has been trained and appointed in writing to apply or remove a lockout, and to perform live testing within their competence.
- **Affected Person** — any worker who operates or works in the area of the locked-out equipment.
- **Energy Isolation Device (EID)** — a mechanical device that physically prevents energy transmission, e.g. a manually operated electrical disconnect, line valve, slip blind, blank flange.
- **Try-out / Zero-energy verification** — the action of attempting to operate the equipment using its normal controls after isolation, plus the use of test instruments to confirm absence of stored or residual energy.

## 3. When LOTO Is Required

LOTO is mandatory whenever:

- A worker is required to remove or bypass a guard or other safety device.
- A worker must place a part of their body in an area on a machine or piece of equipment where work is performed on material being processed (the point of operation), or where an associated danger zone exists.
- The equipment includes hazardous energy that could be unexpectedly released.
- Any of: maintenance, lubrication, cleaning, adjustment, fault-finding, jamming-clearance, modification or repair is performed.
- Workers enter a confined space served by piping, ducting or moving plant.

Minor servicing performed during normal production (e.g. fault clearance designed-in to the operation) is permitted only under an alternative control specifically engineered for the task, documented in the equipment manual, and assessed as equivalent in protection — it is **not** the default option.

## 4. Energy Isolation Procedure (the Eight Steps)

1. **Identify and prepare.** The Authorised Person identifies all energy sources for the equipment from the LOTO Energy Source Register — main electrical supply, control supply, UPS, capacitor banks, motor and brake circuits, gas, steam, compressed air, hydraulic, process feed, drains, gravity loads, springs, accumulators. Reviews the equipment-specific Isolation Plan (one per machine on first installation, updated on any modification).
2. **Notify.** Notify all Affected Persons in the area of the planned isolation, the equipment affected, the expected duration and the responsible Authorised Person.
3. **Shut down.** Operate the normal stop controls of the equipment to bring it to a controlled stop, in accordance with the OEM manual.
4. **Isolate.** Operate each Energy Isolation Device to the off / closed / blanked position. Where remote isolation is used, physically inspect the local indication to confirm.
5. **Lock and tag.** Each affected Authorised Person applies their own personal padlock and personal danger tag to each EID. The lock is keyed to the worker (single key, no master). The tag bears the worker's name, employee number, contact, date, time, equipment and reason. Multiple workers — use a multi-lock hasp; for many isolation points — use a group lockout box into which the keys are placed and the box itself locked by every affected worker.
6. **Dissipate stored energy.** Bleed compressed gases, vent hydraulic pressure, drain process fluid, block or chock raised loads, release spring-loaded mechanisms by approved means, ground capacitor banks, allow thermal cool-down, confirm zero atmospheric pressure differential.
7. **Try out.** Attempt to start the equipment using all start controls (push-buttons, remote, automation triggers). Return controls to off. Verify zero energy with the appropriate test instrument applied to a known live conductor immediately before and immediately after the equipment under test (test-prove-test method). Document the verification.
8. **Authorise work.** The Authorised Person signs the Permit to Work or Isolation Certificate. Work proceeds.

## 5. Multiple-Worker, Multiple-Shift, Contractor and OEM Lockouts

- Every individual worker who relies on the isolation — employee or contractor, mechanical or electrical, OEM commissioning engineer — applies their own personal lock. No exceptions.
- A multi-lock hasp accepts up to six personal locks per EID; chained hasps extend this.
- A group lockout box is used when there are many EIDs: each EID is locked with a single operational lock, the key placed inside the box, and the box itself locked with each worker's personal lock.
- On shift change, the outgoing worker hands over the equipment status to the incoming worker, who applies their own lock before the outgoing worker removes theirs. The lock is never "left behind" with the next shift.
- Contractor crews apply their own locks alongside the company's. The Permit Issuer (company) retains overall control.

## 6. Removal of a Lock by Someone Other Than the Owner

A personal lock may be removed only by the worker who applied it. Removal by another person is permitted only under a Lock Removal Authorisation, signed by the Section 16(2) Appointee or Engineering Manager, and only after:

- All reasonable efforts have been made to contact the worker (phone, manager, HR).
- A documented site search has been completed.
- The equipment has been inspected and verified safe to re-energise (no person in danger zone, guards in place, tools removed).
- A written record of the removal, justification and verification is filed.
- The worker is informed before they next attempt to access the equipment.

Unauthorised removal of a lock or tag is a summary-dismissal offence.

## 7. Restoring Energy

1. Verify tools, parts, rags, instruments and personnel are clear of the equipment.
2. Refit all guards, covers and safety devices; verify their function.
3. Notify Affected Persons that energy is about to be restored.
4. Each Authorised Person removes their own lock and tag in reverse order; the last worker logs the time of de-isolation.
5. Operate the EID to restore energy in the sequence specified by the Isolation Plan.
6. Start the equipment under controlled conditions; observe a verification run.
7. Sign off the Isolation Certificate as closed.

## 8. Locks, Tags & Devices

- Personal padlocks are uniquely keyed, identified by colour or number to the worker, and used only for LOTO (not for general security).
- Tags are durable, UV-resistant, weatherproof and bear a standard format approved by the Safety Officer.
- Lockout devices appropriate to each EID type (breaker lockouts, plug lockouts, valve lockouts in sizes for ball, gate, butterfly, globe; cable lockouts; pneumatic line lockouts; blank flanges and slip blinds for piping) are kept at every LOTO station.
- Re-issued locks and tags are inspected for serviceability; damaged items are destroyed.

## 9. Training & Competency

- All Authorised Persons complete formal LOTO training (theory + practical) on appointment and every 24 months thereafter.
- All Affected Persons receive awareness training at induction.
- Equipment-specific Isolation Plans are reviewed with the workforce on first issue and after any modification.

## 10. Audit

The Safety Officer audits LOTO compliance at least quarterly using a standard checklist (random selection of active isolations and a sample review of the register). Findings are reported to the H&S Committee.

## 11. Records

The LOTO Register records every isolation event: date, equipment, energy sources, Authorised Person, Affected Persons, verification, restoration time and signatures. Records are retained for 5 years.

## 12. Roles

- **Engineering Manager** — owns the LOTO procedure, Energy Source Register and equipment-specific Isolation Plans.
- **Safety Officer** — owns the audit programme, training register and lock issue.
- **Supervisor** — verifies LOTO is in place before signing the permit and authorising work.
- **Authorised Person** — performs the isolation, applies the lock, performs verification, removes the lock on completion.
- **Affected Person** — observes the prohibition, does not attempt to start equipment, reports any abnormality.
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
    content: HEADER_BLOCK.replace("{{TITLE}}", "First Aid Procedure") + `## 1. Purpose & Scope

This procedure ensures the prompt and competent provision of first aid to any injured or acutely ill person on premises and sites under the control of {{COMPANY_NAME}}, in accordance with General Safety Regulation 3 of the OHS Act and Construction Regulation 5(1)(j)(i). It applies to employees, sub-contractors, visitors and members of the public who may sustain injury or take ill while on site.

## 2. First-Aid Capacity

- One trained First Aider per 50 employees (or any part thereof) on every shift, calculated separately for each workplace, building or excavation more than 50 m from other working areas.
- One additional First Aider per 10 employees where the work involves a substantial risk of injury (construction, work at heights, work with chemicals, work with electricity).
- A registered Occupational Health Practitioner or Occupational Health Nursing Practitioner is contracted for sites of >100 workers, providing on-site or telephonic clinical guidance.
- First Aiders are appointed in writing by the employer and the appointment letter is filed.

{{FIRST_AIDER_NAME}} is the appointed Lead First Aider for this site.

## 3. Competency & Training

- First Aiders hold a current certificate at SAQA-aligned Level 1 (minimum) or Level 2 / 3 where the risk profile warrants. Where defibrillation is provided, AED training is required in addition.
- Refresher training every 36 months as required by GSR 3, with practical reassessment.
- A Training Register lists every First Aider with name, certificate, expiry and assigned area.
- First Aiders are identified by a green cross on their high-visibility vest or hard hat.

## 4. First-Aid Box & Equipment

- One First-Aid Box per 50 employees, located at a clearly marked station, indicated on the site plan, and accessible within 4 minutes of any working location.
- Contents per General Safety Regulations Annexure (minimum) and supplemented by site-specific risk: wound cleaner / antiseptic, cotton wool, gauze swabs, sterile gauze pads (assorted), bandages (crepe, conforming, triangular), adhesive plasters (assorted), large wound dressings, burn dressings (gel or hydrogel), adhesive tape, scissors (blunt-tipped), tweezers, splinter forceps, safety pins, disposable nitrile gloves (multiple sizes), CPR pocket mask with one-way valve, sterile saline eye-wash 500 ml, instant cold packs, foil rescue blanket, sterile water for irrigation, a first-aid manual.
- Site-specific additions where the risk warrants: AED, occlusive chest seals, haemostatic dressings, tourniquet, eye-cup, splint, oxygen with mask (only where personnel are trained in its use), spineboard / scoop stretcher, evacuation chair, biohazard bag, hydrofluoric-acid antidote (Calcium Gluconate gel for HF-exposure sites).
- **Medication is not stocked** in the First-Aid Box. Aspirin, paracetamol or any other oral or topical medication is not provided; workers self-administer their own.
- An emergency contact card listing site emergency numbers, the nearest hospital, the nearest 24-hour pharmacy, EMS (10177 / 112) and the on-call OHP is fixed to the box.

## 5. Initial Approach to a Casualty

The First Aider applies the **DRSABCD** primary survey:

1. **Danger** — assess and remove the danger to the casualty, the responder and bystanders; do not enter the danger zone until safe.
2. **Response** — talk to the casualty, tap the shoulder; categorise as alert / verbal / pain / unresponsive (AVPU).
3. **Send for help** — call EMS (10177 / 112), summon a second First Aider, retrieve the AED and the kit.
4. **Airway** — open the airway with head-tilt-chin-lift (jaw thrust if neck injury suspected); clear visible obstruction; recovery position if breathing and unconscious.
5. **Breathing** — look, listen, feel for not more than 10 seconds; if not breathing or breathing abnormally, commence CPR.
6. **CPR** — 30 chest compressions at depth 5–6 cm, rate 100–120 / min, followed by 2 rescue breaths; continue until handover to EMS, AED prompt, casualty recovers, or rescuer cannot continue.
7. **Defibrillator** — attach the AED as soon as it arrives; follow voice prompts; resume CPR immediately after each shock or no-shock advisory.

## 6. Specific Conditions

The First Aider treats according to current South African Resuscitation Council and Heart and Stroke Foundation SA guidelines, including but not limited to: severe haemorrhage (direct pressure, elevation, packing, tourniquet for catastrophic limb bleed); shock (legs elevated, warmed, oxygen if trained); fractures (immobilise in position found); spinal injury (do not move unless airway compromised); burns (cool with running water 20 minutes, do not break blisters, do not apply ointments); chemical splash (irrigate 15 minutes minimum, refer to SDS); chemical eye splash (irrigate from inner to outer for 15 minutes, retain run-off direction away from unaffected eye); electric shock (only after isolation verified; treat as cardiac casualty); heat exhaustion / heat stroke (cool, hydrate, evacuate); hypothermia (warm gradually, no rubbing); seizure (protect from injury, do not restrain, do not insert anything in the mouth); diabetic emergency (sugar by mouth if conscious); asthma (own inhaler, sit upright); anaphylaxis (own adrenaline auto-injector, EMS); poisoning (do not induce vomiting unless on Poison Information line advice).

## 7. Calling Emergency Services

The caller provides: location (street address, GPS, gate number, landmarks, mustering point for EMS), nature of the emergency, number and condition of casualties, hazards in the area, the caller's name and call-back number. The caller remains on the line until the dispatcher releases them. A runner is dispatched to the gate to direct the responding ambulance into the site.

## 8. Bloodborne-Pathogen Precautions

Universal precautions apply to every casualty. Disposable nitrile gloves are donned before contact. Resuscitation is performed using a CPR pocket mask with a one-way valve; never mouth-to-mouth without a barrier. Sharps are not recapped; placed directly in the puncture-resistant sharps bin. Soiled dressings, gloves and other clinical waste are bagged as Group A medical waste and removed by the contracted medical-waste handler. Blood and body-fluid spills are contained, absorbed and disinfected with 1:10 hypochlorite solution. Workers with non-intact skin exposure or a needle-stick injury report immediately to occupational health for risk assessment and post-exposure prophylaxis.

## 9. Recording & Confidentiality

Every treatment, however minor, is recorded in the First Aid Register: date, time, casualty's name, employer, nature of injury / illness, treatment given, advised follow-up, First Aider's name and signature. The register is a legal record under the OHS Act and is retained for not less than 4 years (longer where COIDA or HBA applies). The information is medical-grade confidential; access is restricted to the casualty, the occupational health practitioner and management on a need-to-know basis.

## 10. COIDA & Section 24

Where the injury constitutes a COIDA claim the W.Cl.2 is initiated within 24 hours; where Section 24 reporting applies (see the Incident & Injury Reporting Procedure) the Safety Officer is notified for statutory action.

## 11. Stock Control & Audit

- The First-Aid Box is inspected monthly by the First Aider; the inventory check is signed and dated on the box.
- Used items are replaced within 24 hours.
- Expired items are removed and replaced.
- An annual external audit verifies content compliance and First Aider currency.

## 12. AED Programme

Where an AED is provided: monthly visual / self-test indicator check; pad and battery expiry tracked; deployment debrief after every use; data download to the medical advisor.

## 13. Mental Health & Psychological First Aid

First Aiders are briefed in psychological first aid for workers affected by traumatic events (witnessing a fatal injury, threats of violence, suicide). Acute referrals are made to the Employee Assistance Programme. Confidentiality is maintained.

## 14. Drills & Review

Medical-emergency drills are conducted at least annually, including a simulated cardiac arrest with AED deployment, and a casualty extraction. The First Aid Procedure is reviewed annually and after every incident requiring its activation.
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
    content: HEADER_BLOCK.replace("{{TITLE}}", "Confined Space Entry Procedure") + `## 1. Purpose & Scope

This procedure governs the entry of any person into a confined space on premises or sites under the control of {{COMPANY_NAME}} in accordance with General Safety Regulation 5 of the OHS Act, the Hazardous Chemical Substances Regulations and SANS 10395-1 (Safe work in confined spaces). It is a high-hazard procedure: most confined-space fatalities occur to would-be rescuers, and the rule "plan the rescue before the entry" is enforced without exception.

## 2. Definition & Classification

2.1 **Confined space** means any chamber, tank, vat, silo, pit, pipe, flue, sewer, manhole, ship hold or other space that:

- Is enclosed or substantially enclosed;
- Has restricted or limited means of entry or exit;
- Is not designed for continuous human occupancy;
- Has a reasonably foreseeable specified risk — fire / explosion arising from flammable atmosphere, loss of consciousness / asphyxiation from oxygen deficiency or biological agents, drowning from increased liquid level, asphyxiation / loss of consciousness from free-flowing solids, entrapment, or loss of consciousness from raised temperature.

2.2 **Classification.** Each space is classified at the Pre-Entry Survey:

- **Permit-Required** — has, or has potential for, a hazardous atmosphere, engulfment hazard, internal configuration that could trap, or any other recognised serious hazard. Most company confined spaces fall here.
- **Non-Permit (Reclassified)** — hazards eliminated or reduced to non-hazardous (e.g. fully cleaned, ventilated, isolated and verified for the duration of the work); re-classification documented and reviewed continuously; reverts to Permit-Required on any change.

## 3. Permit-to-Work

No entry occurs without a current Confined Space Entry Permit issued and signed by {{SAFETY_OFFICER_NAME}} or a delegated Confined Space Entry Issuer who is appointed in writing. The permit identifies the space, the task, the personnel, the controls, the atmospheric limits, the duration (maximum one shift), the rescue arrangements and the signatures of issuer, Authorised Entrant, Authorised Attendant and Authorised Supervisor. The permit is posted at the entry; copies are filed.

## 4. Pre-Entry Risk Assessment

A task-specific risk assessment is completed before the permit is issued, addressing:

- The history of the space (previous contents, residues, prior cleaning, hot-work history).
- Connected piping, ducting, conveyors and drains (sources of inflow, energy and contaminant).
- The work to be performed (hot work, abrasive blasting, painting, mechanical work — each of which introduces additional hazards).
- Ergonomic and access factors (top entry, side entry, vertical drop, internal obstructions).
- Environmental factors (heat stress, lighting, communications).
- Adjacent operations that could affect the space (welding, fuelling, batch reactions).

## 5. Atmospheric Testing & Limits

5.1 **Pre-entry test** in the sequence:

1. Oxygen — acceptable 19.5% to 23.0%.
2. Flammable gases / vapours — acceptable <10% LEL (zero for hot work).
3. Toxic gases / vapours (CO, H2S, SO2, NO2, NH3, HCN, organic vapours as relevant) — below the occupational exposure limit; below half the IDLH where IDLH applies.

5.2 **Continuous monitoring** with a calibrated 4-gas (or 5-gas) personal monitor on every entrant, plus a fixed monitor at the entry, throughout the entry. Calibration certificate and bump-test before each shift.

5.3 **Stratification & remote sampling.** Top, middle and bottom of the space are sampled because gases stratify (H2S and propane sink; methane and CO rise). Long-probe remote sampling is used before any person is inserted.

5.4 **Alarm response.** On any alarm the entry is suspended and the space evacuated immediately; re-entry only after the cause is identified and controlled.

## 6. Isolation

Before entry every connected energy source and material inflow is isolated:

- Mechanical and electrical: Lockout-Tagout per the LOTO procedure.
- Process piping: positive isolation by single block-and-bleed for low-risk fluids; double block-and-bleed or slip blinds / spectacle blinds for high-risk fluids (toxic, flammable, hot, pressurised). Closed valves alone are not acceptable for hazardous fluids.
- Gravity / chemical: feeders and conveyors physically interrupted, hoppers emptied and demonstrated empty, suspect dust or solids fluidised then removed.
- Stored energy: springs blocked, hydraulic/pneumatic pressure bled.

Isolation evidence is photographed and attached to the permit.

## 7. Ventilation & Cleaning

- The space is cleaned of residues using procedures and PPE matched to the contaminant.
- Mechanical ventilation is established — supply at the bottom for gases lighter than air; supply at the top with extraction at the bottom for heavier-than-air contaminants — sized for at least 20 air changes per hour, and demonstrated by smoke / tracer testing.
- Where inert atmosphere is required (specific chemistry tasks), the work is re-engineered to avoid entry, or supplied-air breathing equipment is mandatory.

## 8. Entry Personnel & Roles

8.1 **Authorised Supervisor** — a competent person appointed in writing; verifies all controls before authorising entry; signs the permit on issue, on any change and on closure.

8.2 **Authorised Entrant** — trained and competent; medically fit (no claustrophobia, no uncontrolled cardiac, respiratory or seizure conditions); equipped with PPE and continuous gas monitor; signs in and out; evacuates immediately on alarm, on direction of the Attendant, or on any sense of compromise.

8.3 **Authorised Attendant ("Hole Watch")** — trained and competent; positioned at the entry for the duration; performs no other duty; maintains continuous communication with entrants (voice, line-pull, radio); operates the entry register; activates rescue. The Attendant **never enters the space**.

8.4 **Rescue Team** — trained in non-entry retrieval, breathing apparatus, casualty handling and the specific space; equipped and positioned to commence rescue within 4 minutes of alarm. Where the local fire brigade is the designated rescue team, written confirmation of capability and response time is on file.

## 9. Equipment

- Full-body harness with dorsal attachment for retrieval; rescue tripod / davit with mechanical-advantage winch where vertical entry > 1.5 m.
- Retrieval line attached to every entrant; entrants > 1.5 m apart use separate lines and a non-tangling configuration.
- Lighting and tools rated for the atmosphere: intrinsically safe (Ex ia, Ex e) where flammable atmosphere possible.
- Communications system tested before entry.
- Self-contained breathing apparatus (SCBA) and supplied-air sets with escape bottles, for rescue and for tasks where IDLH conditions might develop.
- A first-aid responder and AED at the entry.
- An emergency power supply / UPS for fixed lighting and ventilation.

## 10. PPE

PPE matched to the residual hazards: fire-retardant coveralls, intrinsically-safe lamp, head protection (low-profile helmet with chinstrap), hearing protection, gloves, knee/elbow pads, supplied-air respirator where atmosphere not demonstrably safe, fall arrest where vertical fall hazard.

## 11. Entry & Work

- Each Authorised Entrant signs the entry log on entry and exit, and at hourly intervals during work.
- The Attendant logs gas readings every 15 minutes.
- Hot work, painting, abrasive blasting and any other activity that affects the atmosphere triggers a re-assessment and a separate, concurrent permit (Hot Work Permit).
- Communication is maintained continuously; loss of communication is treated as an emergency.

## 12. Emergency & Rescue

- Rescue is by **non-entry retrieval** from outside the space wherever the configuration allows. Lines are pre-rigged.
- Where non-entry rescue is not feasible, entry rescue is performed only by the trained Rescue Team wearing SCBA, with a separate Attendant.
- **Untrained spontaneous rescue is strictly prohibited.** The single greatest cause of multiple confined-space fatalities is the spontaneous responder. Workers are trained on this prohibition and reminded at every entry briefing.
- Rescue drills are conducted at least every 12 months, timed, and the corrective actions tracked.

## 13. Close-Out

- All entrants and equipment are accounted for; tools are removed; the entry log is closed.
- The space is sealed, isolations verified, signage updated.
- The permit is signed off, filed and entered in the Permit Register.
- The retrieval equipment is cleaned, inspected and returned to the equipment store.

## 14. Training & Competency

All roles (Supervisor, Entrant, Attendant, Rescuer, Issuer) complete formal training (theory + practical, including SCBA donning and live drill) on appointment and every 24 months thereafter. Records on file.

## 15. Records

Permits, gas-test calibration certificates, training certificates, rescue-drill reports, equipment inspections, medical fitness certificates and incident reports are retained for 5 years.
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
    content: HEADER_BLOCK.replace("{{TITLE}}", "Electrical Safety Procedure") + `## 1. Purpose & Scope

This procedure governs all work on or near electrical installations, equipment and conductors under the control of {{COMPANY_NAME}}, in accordance with the Electrical Installation Regulations 2009, the Electrical Machinery Regulations, SANS 10142-1 (LV wiring code), SANS 10142-2 (MV wiring code), SANS 10198 (Selection, handling and installation of electric cables), SANS 10142-3 (Hazardous locations) and the Occupational Health and Safety Act.

It applies to permanent installations, temporary site supplies, generators, portable equipment, hand tools, instrumentation and any work in proximity to overhead or underground electricity.

## 2. Competence & Appointments

- Only persons holding the relevant Wireman's Licence (Single Phase, Three Phase, Installation Electrician, Master Installation Electrician) issued by the Department of Employment & Labour may carry out, oversee or certify electrical installation work, within the scope of their licence.
- A Registered Electrical Contractor (RE Co.) registered with the Department issues every Certificate of Compliance (CoC).
- A competent Senior Engineer is appointed in writing in terms of Electrical Machinery Regulation 9 for premises where machinery > 100 kVA is operated.
- A Person Designated as Responsible for the safe operation of electrical machinery is appointed in writing where required.
- Live work, switching at MV, isolation and earthing, and high-voltage testing are performed only by persons authorised in writing for the specific competence and equipment.
- A current Register of Electrical Competence lists every authorised person with their licence number, scope and expiry.

## 3. Cardinal Rules

1. Treat every conductor as **live** until proven dead by an authorised person using a tested instrument.
2. **De-energise before working** on any electrical equipment except where it is impossible to do so and a written Live Work Permit is in force.
3. Lock out and tag out per the LOTO procedure on every isolation.
4. **Test before touch** — voltage tester proved on a known live source immediately before and after testing (test-prove-test).
5. Maintain minimum safe approach distances.
6. Apply earthing where required (MV and HV).
7. Use insulated tools rated for the system voltage (SANS 60900).
8. Wear arc-rated PPE matched to the calculated incident energy (NFPA 70E / SANS 10198-12 categories).

## 4. De-Energised Work — The Seven Safe Steps

1. **Identify** the equipment and the limits of the work.
2. **Disconnect** — operate the upstream isolator; verify the visible break.
3. **Secure against re-connection** — apply lock and tag at every disconnect point.
4. **Test for absence of voltage** — on every conductor, phase-to-phase, phase-to-earth, neutral-to-earth, using a tested instrument.
5. **Earth and short-circuit** — mandatory for MV / HV; recommended for LV bus-work and capacitive circuits. Earths are visible from the work position.
6. **Cordon and signpost** — barriers and "Danger: Authorised Person Only" signage delineate the safe work zone from adjacent live equipment.
7. **Authorise work** — Permit-to-Work signed by issuer and accepted by recipient.

## 5. Live Work

Live work is permitted only when:

- De-energisation is shown in writing to be impracticable (testing a fault, life-support systems, certain measurements).
- A Live Work Permit signed by the Senior Engineer is in force.
- The work is performed by an authorised person with current Live Work competence.
- Insulated tools, gloves (SANS 60903 / IEC 60903 Class matched to voltage, with leather over-protectors), arc-rated clothing (Cat 1 to 4 matched to incident energy), face shield with arc rating, dielectric boots are worn.
- A second authorised person is in attendance, in line-of-sight, capable of de-energising and trained in electrical rescue.
- A clear rescue plan with a rescue hook / shepherd's crook is at the work.

Live work above 1000 V AC / 1500 V DC is restricted to authorised HV personnel and supplementary procedures apply.

## 6. Approach Distances

Minimum approach distances for unqualified personnel (and for plant operating near lines):

| Nominal voltage | Distance |
|-----------------|----------|
| LV up to 1 kV | 1.0 m |
| > 1 kV up to 11 kV | 3.0 m |
| > 11 kV up to 33 kV | 4.0 m |
| > 33 kV up to 132 kV | 5.0 m |
| > 132 kV up to 275 kV | 6.0 m |
| > 275 kV up to 400 kV | 7.0 m |
| 765 kV | 9.0 m |

Work inside these zones requires a written permit from the line owner (Eskom / municipality) and on-site supervision.

## 7. Portable Electrical Equipment & Hand Tools

- All portable electrical equipment is inspected by the user before each use — plug, cable, earth pin, casing, switch, accessories.
- Earth-leakage protection (30 mA RCD) is in line with every socket outlet feeding portable equipment on a construction site.
- Cables are routed off the ground (cable stands, hooks) or protected from mechanical damage by trunking, ramps or matting where they cross trafficked routes.
- Cables are protected from water; equipment used outdoors or in wet areas is at least IP44 rated.
- Damaged plugs, cables, sockets or equipment are removed from service immediately by attaching a red "Out of Service / Do Not Use" tag and surrendering to the workshop for repair.
- The Portable Appliance Register records every item and the date of its quarterly insulation-resistance and earth-continuity test (per SANS 10198).
- Class II (double-insulated) tools are preferred for handheld equipment in conductive environments.

## 8. Temporary Construction Supply

- Designed, installed and commissioned by a competent person; CoC issued.
- Distribution boards are IP44 outdoor / IP54 wet area, locked, with up-to-date single-line diagrams.
- Every circuit is RCD-protected (30 mA, 30 ms operating time).
- Cables are armoured or routed protected; flexible cables of HO7RN-F or equivalent.
- Generators are bonded and earthed; an earth-electrode resistance test on installation.
- The supply is reinspected weekly and after every incident or modification.

## 9. Working Near Overhead Lines

- The presence of overhead lines is identified at the planning stage; the line owner is consulted.
- Goalposts at the line height are installed at the approach to the line; signage warns of the maximum equipment height permitted.
- Tipping vehicles, cranes, MEWPs, excavators and concrete pumps comply with the approach distances of section 6.
- A flagman / spotter is positioned for every plant movement within 10 m of any conductor.
- Permit-to-work from the line owner, including switch-off or sleeving, is obtained when work inside the zone is unavoidable.

## 10. Excavation Near Buried Cables

- Cable plans are obtained from the utility, the municipality and any private owners before excavation.
- A Cable Avoidance Tool (CAT) scan and a Genny signal scan are performed by a competent operator before any digging; results plotted on the work plan.
- Trial holes are hand-dug at 5 m intervals along the trench line to confirm absence or location of services.
- Within 1.0 m of any indicated cable, only hand-digging with insulated tools is permitted (no mechanical excavation).
- Treat all unidentified cables as live until verified by the asset owner.
- Exposed cables are protected from damage by covers or armour during the works and reinstated to the SANS standard on completion.

## 11. Hazardous-Location Equipment

Equipment for use in flammable atmospheres is selected and installed in accordance with SANS 10108 and SANS 10142-3, certified to the relevant Ex protection method (Ex ia, Ex e, Ex d, Ex p) and zone (0, 1, 2 for gas; 20, 21, 22 for dust), and inspected periodically (SANS 60079-17).

## 12. Electric Shock & Arc Flash Response

- Do not touch the casualty until the supply is verified de-energised; if unable to de-energise, separate the casualty using a non-conductive device (wooden / fibreglass insulated rod, dry rope).
- Once safe: DRSABCD; commence CPR if no pulse; activate the AED.
- All electric-shock cases are referred to medical assessment regardless of how minor they appear (delayed cardiac arrhythmia is recognised).
- Arc-flash casualties: smother any burning clothing, cool burns with running water 20 minutes, cover with sterile non-adherent dressing, evacuate to specialised burns unit.
- The incident is investigated as a Section 24 dangerous occurrence.

## 13. Certificate of Compliance

A Certificate of Compliance signed by a Registered Electrical Contractor is issued for every new installation, every alteration of an installation, and on change of user. The CoC is retained for the life of the installation and presented on inspection.

## 14. Records

Licences, written appointments, permits to work, live-work permits, portable appliance register, RCD test records, earth electrode resistance tests, CoCs, single-line diagrams and incident reports are retained for not less than 5 years.
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
