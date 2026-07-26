export const ANNOUNCEMENT_MESSAGE_TYPES = [
  "general_update",
  "training_cancelled",
  "reminder",
  "camp_information",
  "holiday_notice",
] as const;

export type AnnouncementMessageType = (typeof ANNOUNCEMENT_MESSAGE_TYPES)[number];

export const COMMUNICATION_TEMPLATE_IDS = [
  "training_reminder",
  "match_reminder",
  "squad_announcement",
  "match_result",
  "match_report",
  "cancelled_fixture",
  "availability_reminder",
  "training_preparation",
  "attendance_follow_up",
  "report_shared",
  "camp_information",
  "welcome_message",
  "invoice_reminder",
  "payment_received",
  "outstanding_balance",
  "camp_invoice",
  "receipt_confirmation",
  "clip_shared",
] as const;

export type CommunicationTemplateId = (typeof COMMUNICATION_TEMPLATE_IDS)[number];

export type CommunicationTemplate = {
  id: CommunicationTemplateId;
  label: string;
  defaultSubject: string;
  defaultBody: string;
};

export const COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  {
    id: "training_reminder",
    label: "Training reminder",
    defaultSubject: "Reminder: {player_name}'s training session",
    defaultBody:
      "Hi {parent_name},\n\nThis is a friendly reminder that {player_name} has training on {session_date}.\n\nPlease arrive a few minutes early with the correct kit.\n\nSee you soon.",
  },
  {
    id: "match_reminder",
    label: "Match reminder",
    defaultSubject: "Match day reminder for {player_name}",
    defaultBody:
      "Hi {parent_name},\n\n{player_name} is down to play on {session_date}. Please confirm kit, boots, and arrival time with your coach if needed.\n\nGood luck.",
  },
  {
    id: "squad_announcement",
    label: "Squad announcement",
    defaultSubject: "Squad announced for {match_name}",
    defaultBody:
      "Hi {parent_name},\n\nThe squad for {match_name} on {session_date} has been published. Please check arrival time, kit, and let us know if {player_name} cannot make it.\n\nThank you.",
  },
  {
    id: "match_result",
    label: "Match result",
    defaultSubject: "Result: {match_name}",
    defaultBody:
      "Hi {parent_name},\n\nThe final score for {match_name} was {match_score}. Thank you to everyone who supported the team today.\n\nWe will share a fuller match report soon.",
  },
  {
    id: "match_report",
    label: "Match report",
    defaultSubject: "Match report: {match_name}",
    defaultBody:
      "Hi {parent_name},\n\nThe match report for {match_name} is now available in your family portal. We hope it gives a helpful summary of the team's performance.\n\nPlease reply if you have any questions.",
  },
  {
    id: "cancelled_fixture",
    label: "Cancelled fixture",
    defaultSubject: "Fixture update: {match_name}",
    defaultBody:
      "Hi {parent_name},\n\nUnfortunately {match_name} on {session_date} has been cancelled or postponed. We will confirm the rearranged date as soon as possible.\n\nSorry for any inconvenience.",
  },
  {
    id: "availability_reminder",
    label: "Availability reminder",
    defaultSubject: "Please confirm availability for {match_name}",
    defaultBody:
      "Hi {parent_name},\n\nPlease confirm whether {player_name} is available for {match_name} on {session_date}. This helps us plan the squad before kick-off.\n\nThank you.",
  },
  {
    id: "training_preparation",
    label: "Training preparation",
    defaultSubject: "Preparation for {player_name}'s training on {session_date}",
    defaultBody:
      "Hi {parent_name},\n\nHere is a quick preparation note for {player_name}'s upcoming training.\n\nTheme: {session_date}\nEquipment: please bring the correct kit, boots, and a water bottle.\n\nSee you at training.",
  },
  {
    id: "attendance_follow_up",
    label: "Attendance follow-up",
    defaultSubject: "Checking in on {player_name}'s attendance",
    defaultBody:
      "Hi {parent_name},\n\nWe wanted to check in about {player_name}'s recent sessions. {attendance_note}\n\nPlease let us know if there is anything we can support with.",
  },
  {
    id: "report_shared",
    label: "Report shared",
    defaultSubject: "New progress report for {player_name}",
    defaultBody:
      "Hi {parent_name},\n\nA new progress report for {player_name} is ready to view. We hope the feedback is helpful for supporting training at home.\n\nPlease reply if you have any questions.",
  },
  {
    id: "camp_information",
    label: "Camp information",
    defaultSubject: "Camp update: {camp_name}",
    defaultBody:
      "Hi {parent_name},\n\nHere is an update about {camp_name} running {camp_dates}.\n\nPlease check kit lists, drop-off times, and any final details before the camp starts.",
  },
  {
    id: "welcome_message",
    label: "Welcome message",
    defaultBody:
      "Hi {parent_name},\n\nWelcome to the academy. We are delighted that {player_name} is training with us.\n\nYou can book sessions and view updates through your coach's booking page. Please reach out any time with questions.",
    defaultSubject: "Welcome to the academy, {player_name}",
  },
  {
    id: "invoice_reminder",
    label: "Invoice reminder",
    defaultSubject: "Friendly reminder: invoice {invoice_number}",
    defaultBody:
      "Hi {parent_name},\n\nThis is a friendly reminder that invoice {invoice_number} for {player_name} ({invoice_amount}) is due on {due_date}.\n\nYou can settle this through your usual payment method or reply if you need help.\n\nThank you.",
  },
  {
    id: "payment_received",
    label: "Payment received",
    defaultSubject: "Payment received for {player_name}",
    defaultBody:
      "Hi {parent_name},\n\nThank you — we have received your payment of {invoice_amount} for {player_name}.\n\nIf you need a receipt or have any questions, please reply to this email.",
  },
  {
    id: "outstanding_balance",
    label: "Outstanding balance",
    defaultSubject: "Outstanding balance for {player_name}",
    defaultBody:
      "Hi {parent_name},\n\nOur records show an outstanding balance of {invoice_amount} for {player_name}.\n\nPlease arrange payment at your earliest convenience, or reply if something looks incorrect.\n\nThank you for your support.",
  },
  {
    id: "camp_invoice",
    label: "Camp invoice",
    defaultSubject: "Camp invoice: {camp_name}",
    defaultBody:
      "Hi {parent_name},\n\nPlease find details for {player_name}'s place on {camp_name}.\n\nAmount due: {invoice_amount}\nDue date: {due_date}\n\nThank you — we look forward to seeing {player_name} at camp.",
  },
  {
    id: "receipt_confirmation",
    label: "Receipt confirmation",
    defaultSubject: "Receipt for your payment",
    defaultBody:
      "Hi {parent_name},\n\nThis confirms we received your payment of {invoice_amount} for {player_name}.\n\nReference: {invoice_number}\n\nThank you for supporting the academy.",
  },
  {
    id: "clip_shared",
    label: "Clip shared",
    defaultSubject: "New clip shared for {player_name}",
    defaultBody:
      "Hi {parent_name},\n\nWe have shared a short coaching clip for {player_name} in your family portal.\n\nYou can watch it there and read the coach comments. Downloads are not enabled.\n\nThank you for your support.",
  },
];

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementMessageType, string> = {
  general_update: "General update",
  training_cancelled: "Training cancelled",
  reminder: "Reminder",
  camp_information: "Camp information",
  holiday_notice: "Holiday notice",
};

export function getCommunicationTemplate(id: CommunicationTemplateId): CommunicationTemplate {
  return (
    COMMUNICATION_TEMPLATES.find((template) => template.id === id) ??
    COMMUNICATION_TEMPLATES[0]
  );
}

export function renderCommunicationTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = values[key];
    if (value === null || value === undefined || value === "") {
      if (key === "parent_name") return "there";
      return "";
    }
    return String(value);
  });
}
