/**
 * Seed FIVE work-sample tasks per open job (idempotent by title):
 *   2 × quotation-scenario tasks (candidate builds a mini quote from a brief)
 *   3 × general work-sample tasks (role-specific practical exercises)
 *
 * All tasks are AI-scored via candidateSubmitWorkSample → Gemini.
 *
 * Re-run any time: existing rows keyed on (jobId, title) are left alone.
 */
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BRAND = "Square 15 Facility Solutions";

// Shared rubric for role-specific tasks
const RUBRIC_ROLE = {
  scale: 5,
  dimensions: [
    { code: "TECHNICAL",     label: "Technical accuracy",     weight: 2,   description: "Correct facts and methods for the role." },
    { code: "STRUCTURE",     label: "Structure & clarity",    weight: 1.5, description: "Easy to follow, no missing steps." },
    { code: "COMMUNICATION", label: "Written communication",  weight: 1.5, description: "Professional tone, no ambiguity." },
    { code: "COMMERCIAL",    label: "Commercial awareness",   weight: 1,   description: "Realistic costs, ROI, or client empathy." },
  ],
};

// Quotation-specific rubric — weights price accuracy and margin discipline higher
const RUBRIC_QUOTE = {
  scale: 5,
  dimensions: [
    { code: "SCOPE",     label: "Scope clarity",       weight: 2,   description: "Line items match the brief, no gaps, no scope creep." },
    { code: "PRICING",   label: "Pricing realism",     weight: 2,   description: "Market-related material + labour rates, plausible totals." },
    { code: "MARGIN",    label: "Margin discipline",   weight: 1.5, description: "Includes markup/overhead + VAT correctly (15% ZAR)." },
    { code: "TERMS",     label: "Terms & assumptions", weight: 1,   description: "Payment terms, validity, exclusions stated clearly." },
    { code: "PRESENTATION", label: "Presentation",     weight: 1,   description: "Client-ready layout, no typos, professional tone." },
  ],
};

// -----------------------------------------------------------------------
// Task bank — 5 tasks per role
//   * 2 quotation scenarios (use RUBRIC_QUOTE)
//   * 3 role-specific work samples (use RUBRIC_ROLE)
// -----------------------------------------------------------------------

const TASKS = {
  // ────────────────────── PAINTING ──────────────────────
  Painting: [
    {
      title: "Quotation — 3-bedroom repaint (interior)",
      kind: "quote",
      timeLimitMinutes: 45,
      instructions:
        `A landlord has asked ${BRAND} for a quotation to repaint the interior of a 3-bedroom, 2-bathroom flat (110 m² total, ceilings 2.7 m). Walls are currently magnolia and moderately marked. The landlord wants matte white walls and satin white trim throughout. Ceilings are in good condition and need only a light cut-in + roll.\n\n` +
        `Produce a full client-ready quotation containing:\n` +
        `1) A line-item breakdown (surface prep, primer, top coats, trim, ceiling, materials, labour) with quantities and unit rates in ZAR.\n` +
        `2) A materials sub-total, a labour sub-total, an overhead/markup line, and VAT at 15%.\n` +
        `3) Stated assumptions and exclusions (e.g. furniture moving, wall repairs > 100 mm crack).\n` +
        `4) Payment terms and validity period.\n` +
        `5) A one-paragraph covering note to the landlord.`,
    },
    {
      title: "Quotation — Exterior facade repaint (walk-up block)",
      kind: "quote",
      timeLimitMinutes: 45,
      instructions:
        `A body corporate has requested a quotation for the exterior repaint of a 3-storey walk-up block (18 units, 620 m² of painted facade, 40 m of steel balustrade, 8 timber doors). The existing paint is bubbling in patches — surface prep will need scraping, filling and priming of ± 15% of the wall area. Access at 3rd-floor level requires scaffolding for 3 days.\n\n` +
        `Produce a full quotation covering:\n` +
        `1) Surface preparation line items (scraping, filling, priming allocation).\n` +
        `2) Wall paint quantities (m² × spread rate × 2 coats), steel primer + top coat, timber prep + varnish.\n` +
        `3) Scaffold hire, PPE, and site set-up allowances.\n` +
        `4) Labour hours per day × crew size × days on site.\n` +
        `5) Materials + labour + overhead + VAT (15%) totals.\n` +
        `6) Exclusions, payment terms, validity.`,
    },
    {
      title: "Prep + specification for a tenant turn-around",
      kind: "task",
      timeLimitMinutes: 45,
      instructions:
        `An apartment is being repainted between tenants (2 bedrooms + open plan). Provide:\n` +
        `1) The full surface-prep steps you'd take before opening the first tin.\n` +
        `2) Products (brand + type) you'd use for walls, ceiling, and trim, with quantities.\n` +
        `3) A 2-day schedule assuming you have one helper.`,
    },
    {
      title: "Fault diagnosis — flaking paint on external plaster wall",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `A property manager reports the exterior plaster wall of a client building is flaking in large patches, particularly on the sun-facing side, within 18 months of a repaint.\n\n` +
        `Explain in writing:\n` +
        `1) The 4 most likely root causes in order of probability.\n` +
        `2) The site inspection you would carry out to confirm the cause (what you would look for, what you would test).\n` +
        `3) The remediation method statement (steps + products) once the root cause is confirmed to be poor surface prep.\n` +
        `4) The warranty position you would offer the client on the repair.`,
    },
    {
      title: "Colour + finish specification for a client boardroom",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `A corporate client wants their boardroom repainted. The room has poor natural light, is used for video calls, and the CEO wants a "calm, professional" feel without going grey.\n\n` +
        `Provide a written recommendation covering:\n` +
        `1) The wall, ceiling and trim colour + finish (matt / satin / eggshell) and why.\n` +
        `2) Two specific paint brand + code recommendations for each surface.\n` +
        `3) Any pre-work advice (sample patches, sheen check under artificial light).\n` +
        `4) Aftercare guidance for cleaning marks off the walls without damaging the finish.`,
    },
  ],

  // ────────────────────── PLUMBING ──────────────────────
  Plumbing: [
    {
      title: "Quotation — Complete geyser replacement (200 L)",
      kind: "quote",
      timeLimitMinutes: 45,
      instructions:
        `A tenant reports a burst 200 L horizontal geyser in the ceiling void. The client wants the geyser replaced, the drip tray and overflow inspected and corrected if non-compliant, and the electrical isolator re-certified. Access is via a hatch in the passage ceiling.\n\n` +
        `Produce a full quotation with:\n` +
        `1) Line items: geyser (200 L Kwikot or Heat Tech), drip tray, overflow pipe, thermostat, element, vacuum breaker, pressure control valve, safety valve, isolator switch, labour.\n` +
        `2) Realistic ZAR unit prices per line (± market current).\n` +
        `3) Sub-totals for materials and labour, overhead/markup, VAT at 15%.\n` +
        `4) Assumptions (e.g. existing plumbing is compliant, drip tray outlet exits externally).\n` +
        `5) Callout / after-hours surcharge policy if applicable.\n` +
        `6) Payment terms and warranty (SANS 10254 + geyser manufacturer's 5-year).`,
    },
    {
      title: "Quotation — Bathroom refit (guest en-suite)",
      kind: "quote",
      timeLimitMinutes: 45,
      instructions:
        `A homeowner wants to refit a guest en-suite: replace the toilet, basin + vanity, taps, shower mixer + rose, and re-tile the shower cubicle (2.5 m²). All existing waste lines are in position; the client will supply the sanitaryware (you quote installation only).\n\n` +
        `Produce a quotation showing:\n` +
        `1) Removal + safe disposal of existing fittings.\n` +
        `2) New installation labour (per fitting).\n` +
        `3) Silicone, plumbing fittings, tile adhesive & grout, waterproofing.\n` +
        `4) Tiler day rate × days.\n` +
        `5) Site protection allowance (dust sheets etc.).\n` +
        `6) Materials + labour + overhead + VAT breakdown.\n` +
        `7) Timeline and payment terms.`,
    },
    {
      title: "Diagnostic sequence & materials list — no hot water at kitchen tap",
      kind: "task",
      timeLimitMinutes: 45,
      instructions:
        `A tenant reports 'no hot water from the kitchen tap but the geyser is running and the bathroom hot tap works'. In writing:\n` +
        `1) List, in order, the exact diagnostic steps you would take before touching any pipe.\n` +
        `2) Once you conclude the mixer cartridge is faulty, list the materials + tools needed to replace it, with likely costs (ZAR).\n` +
        `3) State the 3 safety checks you'd do before leaving.`,
    },
    {
      title: "Leak triage — burst pipe in occupied flat",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `You are called out after hours to a burst copper pipe behind the kitchen units of an occupied 2-bedroom flat. Water has already reached the neighbour below.\n\n` +
        `Write, in the order you would perform them:\n` +
        `1) Your first 5 actions on site (before you touch a tool).\n` +
        `2) How you would isolate the leak permanently within 90 minutes.\n` +
        `3) The written follow-up you would send the tenant + property manager the next morning, including what still needs to happen and who is liable for the neighbour's ceiling.`,
    },
    {
      title: "Compliance letter — geyser installation certificate",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `You have completed a geyser installation and need to issue a plumbing installation certificate to the client and insurer.\n\n` +
        `Write:\n` +
        `1) A short client-facing letter confirming the installation is SANS 10254-compliant, listing what was installed, and the 12-month workmanship warranty.\n` +
        `2) The technical checklist of everything you tested before signing off (temperature, pressure, drip-tray drain, vacuum breaker, electrical isolator).\n` +
        `3) A one-line statement that you (or your PIRB-registered principal) take responsibility for the installation.`,
    },
  ],

  // ────────────────────── ELECTRICAL ──────────────────────
  Electrical: [
    {
      title: "Quotation — DB board upgrade + earth-leakage",
      kind: "quote",
      timeLimitMinutes: 45,
      instructions:
        `A landlord wants to upgrade a 12-way domestic DB board to an 18-way board, fit a new 40 A earth-leakage unit, replace all circuit breakers with new SANS-marked units, and issue a full CoC on completion. Access is straightforward.\n\n` +
        `Produce a client-ready quotation containing:\n` +
        `1) Materials (DB enclosure, main switch, earth-leakage, MCBs × 18, busbars, cable ferrules, DIN rail, gland plate).\n` +
        `2) Realistic ZAR unit prices.\n` +
        `3) Labour (installation + re-wiring day rate).\n` +
        `4) CoC issuance line item (Registered Person's fee).\n` +
        `5) Overhead/markup + VAT at 15%.\n` +
        `6) Assumptions (existing wiring is in reusable condition, no rewiring required beyond DB) and exclusions.\n` +
        `7) Payment terms and warranty.`,
    },
    {
      title: "Quotation — Emergency lighting compliance retrofit",
      kind: "quote",
      timeLimitMinutes: 45,
      instructions:
        `A commercial client's fire officer has issued a non-compliance notice: emergency lighting on the ground and first floor of a 400 m² office is inadequate. You need to quote for installation of 8 new self-contained emergency luminaires (3 hr rating), 4 illuminated exit signs, and a monthly 3-year maintenance contract.\n\n` +
        `Produce a quotation containing:\n` +
        `1) Bill of materials (luminaires, exit signs, cable + trunking, distribution board tap-off, isolator).\n` +
        `2) Installation labour breakdown per luminaire and per sign.\n` +
        `3) Testing + commissioning line item.\n` +
        `4) 3-year maintenance contract line item (per visit × 36 months) — quoted separately at bottom.\n` +
        `5) Materials + labour + markup + VAT.\n` +
        `6) SANS 10142 + NRS 048 compliance statement, payment terms, warranty.`,
    },
    {
      title: "Fault-finding walkthrough — earth-leakage trip on printer",
      kind: "task",
      timeLimitMinutes: 45,
      instructions:
        `A commercial tenant reports 'earth-leakage keeps tripping when the printer switches on but not on other devices'. In writing:\n` +
        `1) List the 5 most likely causes in order of probability.\n` +
        `2) Describe the test sequence you would follow (list which instrument used at each step).\n` +
        `3) State the exact CoC-relevant regulations you'd cite when explaining the fix to the client.`,
    },
    {
      title: "Cable size + protection calc — new sub-DB feed",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `You need to run a new sub-DB feed 34 m from the main DB to a workshop drawing a maximum 45 A single-phase load. Existing supply is 230 V, TN-S.\n\n` +
        `Show your workings for:\n` +
        `1) Correct cable size per SANS 10142-1 (voltage drop < 3%).\n` +
        `2) Correct upstream MCB rating.\n` +
        `3) The earthing conductor size.\n` +
        `4) The written explanation to the client of why this cable is one size up from what a "cheap" quote would specify.`,
    },
    {
      title: "Client explanation — CoC declined and why",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `You have inspected a home the client wants to sell. You cannot issue a CoC because you found (a) an unlabelled shared neutral in the roof void, (b) missing earth-leakage on the socket circuit, and (c) a non-compliant electric fence energiser installation.\n\n` +
        `Write:\n` +
        `1) A short, respectful email to the seller explaining what you found, why you cannot issue a CoC as-is, and roughly what the remedial work will cost.\n` +
        `2) A list of remedial line items you will price separately.\n` +
        `3) The legal reference (Electrical Installation Regulations 2009) you would cite if the seller pushes back.`,
    },
  ],

  // ────────────────────── CARPENTRY ──────────────────────
  Carpentry: [
    {
      title: "Quotation — Fitted kitchen (small U-shape)",
      kind: "quote",
      timeLimitMinutes: 45,
      instructions:
        `A homeowner wants a new fitted U-shape kitchen: 4.2 m of base units + 3.5 m of wall units + a pull-out pantry column. Melamine carcasses, supawood shaker-style doors, engineered stone counter (4.2 m run), stainless drop-in sink, and installation of the client's own appliances (fridge, oven, hob, extractor).\n\n` +
        `Produce a quotation showing:\n` +
        `1) Bill of materials with rates (carcasses per lin. m, doors per m², counter per lin. m incl. cut-outs, hinges/runners/handles, sealants, silicone).\n` +
        `2) Manufacturing labour (workshop) and installation labour (on site).\n` +
        `3) Delivery, template, install day allowances.\n` +
        `4) Materials + labour + overhead + VAT.\n` +
        `5) Exclusions (plumbing, electrical, wall/floor prep), payment terms (progress schedule), and warranty.`,
    },
    {
      title: "Quotation — Bespoke built-in wardrobe (bedroom)",
      kind: "quote",
      timeLimitMinutes: 30,
      instructions:
        `A client wants a built-in wardrobe 2.4 m wide × 2.6 m tall × 60 cm deep in a main bedroom: 2 hanging sections, 1 shelving section, drawers × 4, and sliding mirror doors.\n\n` +
        `Produce a quotation showing:\n` +
        `1) Materials (carcass boards, sliding-door hardware, drawer runners, mirror doors, edging, fasteners).\n` +
        `2) Workshop labour + install labour.\n` +
        `3) Materials + labour + overhead + VAT.\n` +
        `4) Payment schedule (deposit / progress / handover), warranty, and exclusions.`,
    },
    {
      title: "Costing + method for drywall + built-in",
      kind: "task",
      timeLimitMinutes: 45,
      instructions:
        `A landlord asks you to install a dry-wall partition (3m × 2.5m) and a small built-in wardrobe (1.8m × 1.2m × 60cm) in a residential unit. Provide:\n` +
        `1) A materials list with quantities and approximate costs (ZAR).\n` +
        `2) The sequence of work over 3 days.\n` +
        `3) 3 finishing details you'd insist on to make it look professional.`,
    },
    {
      title: "Site method statement — door hanging + skirting install",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `You are hanging 6 new solid-core interior doors and fitting matching skirting in a rental flat that has just been re-plastered.\n\n` +
        `Write a short method statement covering:\n` +
        `1) The site protection / dust control you will put in place.\n` +
        `2) The sequence and tolerances (gaps, hinge positions, skirting mitre joins).\n` +
        `3) The final QC check before you invoice.`,
    },
    {
      title: "Client explanation — engineered wood vs solid timber",
      kind: "task",
      timeLimitMinutes: 20,
      instructions:
        `A homeowner has asked whether their bespoke bookcase should be built in solid oak or engineered oak-veneered board.\n\n` +
        `Write a short, honest explanation covering:\n` +
        `1) The cost delta on a typical 2 m × 2 m bookcase.\n` +
        `2) The look, weight, and long-term durability differences.\n` +
        `3) The scenarios in which you would recommend one over the other.`,
    },
  ],

  // ────────────────────── SALES ──────────────────────
  Sales: [
    {
      title: "Quotation — Facilities management contract (annual)",
      kind: "quote",
      timeLimitMinutes: 45,
      instructions:
        `A property manager wants a 12-month facilities-management contract for a 4-building portfolio (± 320 units). Services required: reactive maintenance (up to 20 tickets/month), quarterly compliance inspections (electrical, fire, roof, plumbing), monthly common-area cleaning, and an on-call after-hours line.\n\n` +
        `Produce a client-ready commercial proposal containing:\n` +
        `1) A one-page executive summary of what ${BRAND} will deliver.\n` +
        `2) A pricing table with a monthly retainer + separate line items for after-hours callouts, non-included work rates, and consumables at cost + 15%.\n` +
        `3) An annual total and payment schedule.\n` +
        `4) Assumptions (labour hours capped, materials excluded).\n` +
        `5) SLA metrics you commit to (response time, uptime, reporting cadence).\n` +
        `6) Contract term, notice period, escalation rate.`,
    },
    {
      title: "Quotation — Once-off complex clean-up (post-renovation)",
      kind: "quote",
      timeLimitMinutes: 30,
      instructions:
        `A client has just completed a renovation of their offices (450 m²) and needs a full post-construction deep clean before staff return on Monday. The site currently has dust, cement residue on floors, paint splatters on windows, and construction debris.\n\n` +
        `Produce a quotation containing:\n` +
        `1) A scope breakdown (windows, floors, sanitary, air-cons, upholstery).\n` +
        `2) Crew size × hours × day rate.\n` +
        `3) Consumables (chemicals, mop heads, disposal bags).\n` +
        `4) A single all-inclusive VAT-inclusive price and a broken-down price.\n` +
        `5) Any conditions (site access hours, waste removal).`,
    },
    {
      title: "Cold pitch script + objection handling",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `You are calling a property manager who has never heard of ${BRAND}. Write:\n` +
        `1) A 60-second opener pitch that gets to value in the first 15 seconds.\n` +
        `2) Your response to the objection 'we already have a preferred contractor'.\n` +
        `3) The one commitment you would try to secure from the call, and how you'd close it.`,
    },
    {
      title: "Lead-qualification brief + email follow-up",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `An inbound lead has filled out the ${BRAND} contact form: "Hi, we're a body corporate for a 46-unit block in Randburg and our current contractor is unreliable. Please call to discuss."\n\n` +
        `Write:\n` +
        `1) The 6 qualifying questions you'll ask on your first call (in order).\n` +
        `2) A same-day follow-up email if the trustee does not answer the phone.\n` +
        `3) The 3 pieces of information you need to give the operations manager before they can quote.`,
    },
    {
      title: "Objection handling — price challenge",
      kind: "task",
      timeLimitMinutes: 20,
      instructions:
        `A prospect has received a quote from ${BRAND} for a maintenance contract and comes back with: "You're 22% more expensive than the incumbent, and they've been fine for 3 years."\n\n` +
        `Write:\n` +
        `1) Your written reply (kept under 200 words) that reframes the value without discounting.\n` +
        `2) The 2 concessions you would be willing to offer, in order.\n` +
        `3) The one deal-breaker you would walk away on.`,
    },
  ],

  // ────────────────────── ADMIN ──────────────────────
  Admin: [
    {
      title: "Quotation — Data-capture project (100 tenant files)",
      kind: "quote",
      timeLimitMinutes: 30,
      instructions:
        `A property manager wants to hire ${BRAND} admin staff for a one-off data-capture project: digitise 100 hard-copy tenant files (each ± 6 pages) into the SQR15 system, verify each entry against source documents, and produce a summary report of discrepancies.\n\n` +
        `Produce a quotation covering:\n` +
        `1) Per-file rate × 100 files (labour).\n` +
        `2) A verification / QA percentage line (typically 10% double-check).\n` +
        `3) Report + hand-over meeting fee.\n` +
        `4) Sub-total + VAT.\n` +
        `5) Deliverables (Excel export, digitised files in shared drive, discrepancy summary).\n` +
        `6) Turnaround time and payment terms.`,
    },
    {
      title: "Quotation — Monthly administrative retainer",
      kind: "quote",
      timeLimitMinutes: 30,
      instructions:
        `A small owner-managed property portfolio (48 units) wants ${BRAND} to take over back-office admin for 12 months: monthly rent-run reconciliation, tenant-communication drafting (up to 20 letters/month), utility-reading capture, and a monthly management report.\n\n` +
        `Produce a quotation containing:\n` +
        `1) A monthly retainer priced at labour-hours × rate.\n` +
        `2) Any per-tenant surcharge above a stated cap.\n` +
        `3) A separate line for month-end reporting.\n` +
        `4) VAT and total annual value.\n` +
        `5) A short paragraph on what is included and excluded.\n` +
        `6) Notice period and escalation.`,
    },
    {
      title: "Data-capture + customer email",
      kind: "task",
      timeLimitMinutes: 45,
      instructions:
        `1) Below is a small tenant list with intentional errors (typos, missing amounts, wrong dates). Type it back into Excel-ready CSV format with everything corrected.\n` +
        `TENANT,UNIT,AMOUNT,DUE\n` +
        `Naledi M,4B,R 3,500,04/09/26\n` +
        `Sipho k,7A,r3200,4-Sep-206\n` +
        `Amahle Z, 2C,3800,04/09/2026\n\n` +
        `2) Draft a polite but firm follow-up email to Sipho K, whose rent is 5 days overdue. Include a payment reminder, offer to arrange, and a WhatsApp option. Sign off as the Junior Administrator at ${BRAND}.`,
    },
    {
      title: "Escalation email — complaint from body corporate",
      kind: "task",
      timeLimitMinutes: 30,
      instructions:
        `The trustee of a body corporate has emailed ${BRAND}: "For the third time this month a callout has taken more than 48 hours to be attended. This is unacceptable."\n\n` +
        `Write:\n` +
        `1) An acknowledgement + escalation email to the trustee (within 200 words) that neither over-promises nor dismisses.\n` +
        `2) An internal message to the operations manager summarising the incident + the 3 questions you need answered before you can respond in full.\n` +
        `3) The one preventative measure you would recommend.`,
    },
    {
      title: "Diary planning — recruiter's day",
      kind: "task",
      timeLimitMinutes: 20,
      instructions:
        `You are the admin for a recruiter who has, on the same day: 3 candidate interviews at 30 min each, 2 client meetings (60 min + 45 min), a 15 min stand-up, 90 min of screening calls, and a hard deadline at 17:00 for a shortlist report.\n\n` +
        `Write:\n` +
        `1) A proposed day schedule from 08:00 to 17:00 with buffers.\n` +
        `2) The 3 things you would push back on if the recruiter tried to add another commitment.\n` +
        `3) The one clarifying question you would ask before finalising the day.`,
    },
  ],
};

// -----------------------------------------------------------------------
// Category aliases so a job with a variant category name still gets seeded.
// -----------------------------------------------------------------------

const CATEGORY_ALIASES = {
  Painter: "Painting",
  Painters: "Painting",
  Plumber: "Plumbing",
  Plumbers: "Plumbing",
  Electrician: "Electrical",
  Electricians: "Electrical",
  Carpenter: "Carpentry",
  Carpenters: "Carpentry",
  Handyman: "Carpentry",
  "General Maintenance": "Carpentry",
  "Sales Agent": "Sales",
  "Sales Consultant": "Sales",
  Administration: "Admin",
  Administrator: "Admin",
};

function resolveTasks(category) {
  if (!category) return null;
  if (TASKS[category]) return TASKS[category];
  const aliased = CATEGORY_ALIASES[category];
  if (aliased && TASKS[aliased]) return TASKS[aliased];
  return null;
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  const adminUserId = 2;
  const token = jwt.sign({ userId: adminUserId }, secret, { expiresIn: "10m" });

  const jobs = await prisma.job.findMany({
    where: { status: "OPEN" },
    select: { id: true, title: true, category: true },
  });

  let created = 0;
  let skipped = 0;
  let jobsWithoutTemplate = 0;

  for (const job of jobs) {
    const bank = resolveTasks(job.category);
    if (!bank) {
      console.log(`Skip (no task bank): #${job.id} ${job.title} category=${job.category}`);
      jobsWithoutTemplate++;
      continue;
    }

    for (const t of bank) {
      const existing = await prisma.workSampleTask.findFirst({
        where: { jobId: job.id, title: t.title },
      });
      if (existing) {
        skipped++;
        continue;
      }
      const res = await fetch(`${process.env.BASE_URL || "http://localhost:3000"}/trpc/createWorkSampleTask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          json: {
            token,
            jobId: job.id,
            title: t.title,
            instructions: t.instructions,
            timeLimitMinutes: t.timeLimitMinutes,
            rubric: t.kind === "quote" ? RUBRIC_QUOTE : RUBRIC_ROLE,
            passingScore: 60,
          },
        }),
      });
      const text = await res.text();
      if (res.status !== 200) {
        console.error(`FAIL job #${job.id} "${t.title}":`, text);
        continue;
      }
      console.log(`Created  #${job.id} ${job.title.padEnd(40)}  ${t.kind === "quote" ? "[QUOTE]" : "[TASK] "}  ${t.title}`);
      created++;
    }
  }

  console.log(
    `\nDone. Created=${created}  Skipped(existing)=${skipped}  JobsWithoutTemplate=${jobsWithoutTemplate}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
