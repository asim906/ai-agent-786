export interface Lead {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  appointmentTime?: string;
  raw: string;
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/g;
const ADDRESS_RE = /\b\d{1,5}\s[\w\s]{2,30},?\s[\w\s]{2,20},?\s[A-Z]{2}\b/g;
const APPT_RE = /(?:appointment|meeting|call|session|visit)\s*(?:at|on|@)?\s*[\w\s,]+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi;

export function extractLeads(text: string): Lead | null {
  const emails = text.match(EMAIL_RE);
  const phones = text.match(PHONE_RE);
  const addresses = text.match(ADDRESS_RE);
  const appointments = text.match(APPT_RE);

  if (!emails && !phones && !addresses && !appointments) return null;

  return {
    email: emails?.[0],
    phone: phones?.[0],
    address: addresses?.[0],
    appointmentTime: appointments?.[0],
    raw: text,
  };
}
