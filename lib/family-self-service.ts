export const FAMILY_SELF_SERVICE_VERSION = 1;

export const AVAILABILITY_TYPES = [
  "unavailable",
  "holiday",
  "injured",
  "ill",
  "returning_next_week",
] as const;

export type AvailabilityType = (typeof AVAILABILITY_TYPES)[number];

export const SESSION_RESPONSE_STATUSES = ["attending", "not_attending", "unsure"] as const;

export type SessionResponseStatus = (typeof SESSION_RESPONSE_STATUSES)[number];

export type CommunicationPreferences = {
  sessionReminders: boolean;
  campUpdates: boolean;
  weeklyReminders: boolean;
  reports: boolean;
  marketing: boolean;
};

export type NotificationPreferences = {
  emailReminders: boolean;
  campUpdates: boolean;
  weeklyReminders: boolean;
  reports: boolean;
  marketing: boolean;
};

export type FamilyProfileData = {
  phone: string | null;
  emergencyContact: string | null;
  preferredEmail: string | null;
  communicationPreferences: CommunicationPreferences;
};

export type ChildProfileData = {
  preferredName: string | null;
  pronouns: string | null;
  medicalInformation: string | null;
  allergies: string | null;
  medication: string | null;
  emergencyNotes: string | null;
  schoolYear: string | null;
  shirtSize: string | null;
  bootSize: string | null;
  photoUrl: string | null;
};

export type AvailabilityEntry = {
  id: string;
  type: AvailabilityType;
  note: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionResponseEntry = {
  status: SessionResponseStatus;
  reason: string | null;
  updatedAt: string;
};

export type DocumentCompletion = {
  completedAt: string | null;
  acknowledged: boolean;
};

export type PaymentPauseRequest = {
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
};

export type FamilySelfServiceRecord = {
  version: number;
  coachApprovalRequired: boolean;
  family: FamilyProfileData;
  familyPending: Partial<FamilyProfileData> | null;
  child: ChildProfileData;
  childPending: Partial<ChildProfileData> | null;
  availability: AvailabilityEntry[];
  sessionResponses: Record<string, SessionResponseEntry>;
  documents: Partial<Record<string, DocumentCompletion>>;
  notifications: NotificationPreferences;
  paymentPauseRequest: PaymentPauseRequest | null;
};

export const AVAILABILITY_LABELS: Record<AvailabilityType, string> = {
  unavailable: "Unavailable",
  holiday: "Holiday",
  injured: "Injured",
  ill: "Ill",
  returning_next_week: "Returning next week",
};

export const SESSION_RESPONSE_LABELS: Record<SessionResponseStatus, string> = {
  attending: "Attending",
  not_attending: "Not attending",
  unsure: "Unsure",
};

const DEFAULT_COMMUNICATION: CommunicationPreferences = {
  sessionReminders: true,
  campUpdates: true,
  weeklyReminders: true,
  reports: true,
  marketing: false,
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  emailReminders: true,
  campUpdates: true,
  weeklyReminders: true,
  reports: true,
  marketing: false,
};

export function emptyFamilySelfService(): FamilySelfServiceRecord {
  return {
    version: FAMILY_SELF_SERVICE_VERSION,
    coachApprovalRequired: true,
    family: {
      phone: null,
      emergencyContact: null,
      preferredEmail: null,
      communicationPreferences: { ...DEFAULT_COMMUNICATION },
    },
    familyPending: null,
    child: {
      preferredName: null,
      pronouns: null,
      medicalInformation: null,
      allergies: null,
      medication: null,
      emergencyNotes: null,
      schoolYear: null,
      shirtSize: null,
      bootSize: null,
      photoUrl: null,
    },
    childPending: null,
    availability: [],
    sessionResponses: {},
    documents: {},
    notifications: { ...DEFAULT_NOTIFICATIONS },
    paymentPauseRequest: null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFamilySelfService(
  raw: unknown,
  seed?: { parentPhone?: string | null; parentEmail?: string | null },
): FamilySelfServiceRecord {
  const base = emptyFamilySelfService();
  if (!isPlainObject(raw)) {
    if (seed?.parentPhone) base.family.phone = seed.parentPhone;
    if (seed?.parentEmail) base.family.preferredEmail = seed.parentEmail;
    return base;
  }

  const family = isPlainObject(raw.family) ? raw.family : {};
  const child = isPlainObject(raw.child) ? raw.child : {};
  const notifications = isPlainObject(raw.notifications) ? raw.notifications : {};
  const communication = isPlainObject(family.communicationPreferences)
    ? family.communicationPreferences
    : {};

  return {
    version: FAMILY_SELF_SERVICE_VERSION,
    coachApprovalRequired:
      typeof raw.coachApprovalRequired === "boolean" ? raw.coachApprovalRequired : true,
    family: {
      phone:
        typeof family.phone === "string" ? family.phone : seed?.parentPhone ?? null,
      emergencyContact:
        typeof family.emergencyContact === "string" ? family.emergencyContact : null,
      preferredEmail:
        typeof family.preferredEmail === "string"
          ? family.preferredEmail
          : seed?.parentEmail ?? null,
      communicationPreferences: {
        sessionReminders:
          typeof communication.sessionReminders === "boolean"
            ? communication.sessionReminders
            : true,
        campUpdates:
          typeof communication.campUpdates === "boolean" ? communication.campUpdates : true,
        weeklyReminders:
          typeof communication.weeklyReminders === "boolean"
            ? communication.weeklyReminders
            : true,
        reports: typeof communication.reports === "boolean" ? communication.reports : true,
        marketing:
          typeof communication.marketing === "boolean" ? communication.marketing : false,
      },
    },
    familyPending: isPlainObject(raw.familyPending)
      ? (raw.familyPending as Partial<FamilyProfileData>)
      : null,
    child: {
      preferredName: typeof child.preferredName === "string" ? child.preferredName : null,
      pronouns: typeof child.pronouns === "string" ? child.pronouns : null,
      medicalInformation:
        typeof child.medicalInformation === "string" ? child.medicalInformation : null,
      allergies: typeof child.allergies === "string" ? child.allergies : null,
      medication: typeof child.medication === "string" ? child.medication : null,
      emergencyNotes: typeof child.emergencyNotes === "string" ? child.emergencyNotes : null,
      schoolYear: typeof child.schoolYear === "string" ? child.schoolYear : null,
      shirtSize: typeof child.shirtSize === "string" ? child.shirtSize : null,
      bootSize: typeof child.bootSize === "string" ? child.bootSize : null,
      photoUrl: typeof child.photoUrl === "string" ? child.photoUrl : null,
    },
    childPending: isPlainObject(raw.childPending)
      ? (raw.childPending as Partial<ChildProfileData>)
      : null,
    availability: Array.isArray(raw.availability)
      ? raw.availability
          .filter(isPlainObject)
          .map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
            type: AVAILABILITY_TYPES.includes(entry.type as AvailabilityType)
              ? (entry.type as AvailabilityType)
              : "unavailable",
            note: typeof entry.note === "string" ? entry.note : null,
            startDate: typeof entry.startDate === "string" ? entry.startDate : null,
            endDate: typeof entry.endDate === "string" ? entry.endDate : null,
            createdAt:
              typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
            updatedAt:
              typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
          }))
      : [],
    sessionResponses: isPlainObject(raw.sessionResponses)
      ? Object.fromEntries(
          Object.entries(raw.sessionResponses)
            .filter(([, value]) => isPlainObject(value))
            .map(([sessionId, value]) => [
              sessionId,
              {
                status: SESSION_RESPONSE_STATUSES.includes(
                  (value as SessionResponseEntry).status as SessionResponseStatus,
                )
                  ? ((value as SessionResponseEntry).status as SessionResponseStatus)
                  : "unsure",
                reason:
                  typeof (value as SessionResponseEntry).reason === "string"
                    ? (value as SessionResponseEntry).reason
                    : null,
                updatedAt:
                  typeof (value as SessionResponseEntry).updatedAt === "string"
                    ? (value as SessionResponseEntry).updatedAt
                    : new Date().toISOString(),
              },
            ]),
        )
      : {},
    documents: isPlainObject(raw.documents)
      ? (raw.documents as FamilySelfServiceRecord["documents"])
      : {},
    notifications: {
      emailReminders:
        typeof notifications.emailReminders === "boolean" ? notifications.emailReminders : true,
      campUpdates:
        typeof notifications.campUpdates === "boolean" ? notifications.campUpdates : true,
      weeklyReminders:
        typeof notifications.weeklyReminders === "boolean"
          ? notifications.weeklyReminders
          : true,
      reports: typeof notifications.reports === "boolean" ? notifications.reports : true,
      marketing:
        typeof notifications.marketing === "boolean" ? notifications.marketing : false,
    },
    paymentPauseRequest: isPlainObject(raw.paymentPauseRequest)
      ? {
          status:
            raw.paymentPauseRequest.status === "approved" ||
            raw.paymentPauseRequest.status === "rejected"
              ? raw.paymentPauseRequest.status
              : "pending",
          reason:
            typeof raw.paymentPauseRequest.reason === "string"
              ? raw.paymentPauseRequest.reason
              : null,
          requestedAt:
            typeof raw.paymentPauseRequest.requestedAt === "string"
              ? raw.paymentPauseRequest.requestedAt
              : new Date().toISOString(),
          reviewedAt:
            typeof raw.paymentPauseRequest.reviewedAt === "string"
              ? raw.paymentPauseRequest.reviewedAt
              : null,
        }
      : null,
  };
}

export function mergeFamilyProfile(
  current: FamilySelfServiceRecord,
  updates: Partial<FamilyProfileData>,
  approvalRequired: boolean,
): FamilySelfServiceRecord {
  if (!approvalRequired) {
    return {
      ...current,
      family: { ...current.family, ...updates },
      familyPending: null,
    };
  }
  return {
    ...current,
    familyPending: { ...(current.familyPending ?? {}), ...updates },
  };
}

export function mergeChildProfile(
  current: FamilySelfServiceRecord,
  updates: Partial<ChildProfileData>,
  approvalRequired: boolean,
): FamilySelfServiceRecord {
  if (!approvalRequired) {
    return {
      ...current,
      child: { ...current.child, ...updates },
      childPending: null,
    };
  }
  return {
    ...current,
    childPending: { ...(current.childPending ?? {}), ...updates },
  };
}

export function approveFamilyPending(record: FamilySelfServiceRecord): FamilySelfServiceRecord {
  if (!record.familyPending) return record;
  return {
    ...record,
    family: { ...record.family, ...record.familyPending },
    familyPending: null,
  };
}

export function approveChildPending(record: FamilySelfServiceRecord): FamilySelfServiceRecord {
  if (!record.childPending) return record;
  return {
    ...record,
    child: { ...record.child, ...record.childPending },
    childPending: null,
  };
}

export function upsertAvailability(
  record: FamilySelfServiceRecord,
  entry: Omit<AvailabilityEntry, "createdAt" | "updatedAt" | "id"> & { id?: string },
): FamilySelfServiceRecord {
  const now = new Date().toISOString();
  const id = entry.id ?? crypto.randomUUID();
  const nextEntry: AvailabilityEntry = {
    id,
    type: entry.type,
    note: entry.note ?? null,
    startDate: entry.startDate ?? null,
    endDate: entry.endDate ?? null,
    createdAt: record.availability.find((item) => item.id === id)?.createdAt ?? now,
    updatedAt: now,
  };
  const without = record.availability.filter((item) => item.id !== id);
  return {
    ...record,
    availability: [nextEntry, ...without].slice(0, 20),
  };
}

export function setSessionResponse(
  record: FamilySelfServiceRecord,
  sessionId: string,
  response: { status: SessionResponseStatus; reason?: string | null },
): FamilySelfServiceRecord {
  return {
    ...record,
    sessionResponses: {
      ...record.sessionResponses,
      [sessionId]: {
        status: response.status,
        reason: response.reason ?? null,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export function hasPendingApprovals(record: FamilySelfServiceRecord): boolean {
  return Boolean(record.familyPending || record.childPending);
}

export const FAMILY_DRAFT_STORAGE_PREFIX = "awarix:family-draft:v1:";
