import type { PrismaClient, PreferredChannel } from "@prisma/client";

export type CandidateCaptureInput = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredChannel?: PreferredChannel | null;
};

const toNull = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeEmail = (value?: string | null) => {
  const email = toNull(value);
  return email ? email.toLowerCase() : null;
};

export const normalizePhone = (value?: string | null) => {
  const phone = toNull(value);
  return phone;
};

export const getCandidateLookupOrder = (input: CandidateCaptureInput): Array<{ field: "email" | "phone"; value: string }> => {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  const lookups: Array<{ field: "email" | "phone"; value: string }> = [];
  if (email) lookups.push({ field: "email", value: email });
  if (phone) lookups.push({ field: "phone", value: phone });
  return lookups;
};

export const upsertCandidate = async (prisma: PrismaClient, input: CandidateCaptureInput) => {
  const firstName = toNull(input.firstName);
  const lastName = toNull(input.lastName);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  const lookupOrder = getCandidateLookupOrder(input);

  let existing = null as Awaited<ReturnType<typeof prisma.candidate.findFirst>> | null;

  for (const lookup of lookupOrder) {
    existing =
      lookup.field === "email"
        ? await prisma.candidate.findFirst({ where: { email: lookup.value } })
        : await prisma.candidate.findFirst({ where: { phone: lookup.value } });

    if (existing) break;
  }

  if (existing) {
    return prisma.candidate.update({
      where: { id: existing.id },
      data: {
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        preferredChannel: input.preferredChannel ?? existing.preferredChannel
      }
    });
  }

  return prisma.candidate.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      preferredChannel: input.preferredChannel ?? null
    }
  });
};
