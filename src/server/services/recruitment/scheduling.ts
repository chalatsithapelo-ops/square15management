/**
 * Scheduling helpers — conflict detection + ICS generation.
 */

export function generateICS(params: {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  organizerEmail?: string;
  attendeeEmails?: string[];
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SQR15//Recruitment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(params.start)}`,
    `DTEND:${fmt(params.end)}`,
    `SUMMARY:${escapeICS(params.summary)}`,
  ];
  if (params.description) lines.push(`DESCRIPTION:${escapeICS(params.description)}`);
  if (params.location) lines.push(`LOCATION:${escapeICS(params.location)}`);
  if (params.organizerEmail) lines.push(`ORGANIZER:mailto:${params.organizerEmail}`);
  for (const a of params.attendeeEmails ?? []) {
    lines.push(`ATTENDEE;RSVP=TRUE:mailto:${a}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeICS(s: string): string {
  return s.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}
