export const AUTOMATION_TYPES = [
  "session_reminder",
  "payment_reminder",
  "birthday_email",
  "report_follow_up",
  "attendance_alert",
  "subscription_renewal",
] as const;

export type AutomationType = (typeof AUTOMATION_TYPES)[number];

export type AutomationTemplate = {
  type: AutomationType;
  title: string;
  description: string;
  defaultSubject: string;
  defaultTemplate: string;
  defaultTimingOffset: number;
  offsetLabel: string;
};

export type AutomationRow = {
  id: string;
  coach_id: string;
  type: AutomationType;
  is_enabled: boolean;
  subject: string;
  template: string;
  timing_offset: number;
  created_at: string;
};

export const DEFAULT_AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    type: "session_reminder",
    title: "Session reminder",
    description: "Email parents before an upcoming coaching session.",
    defaultSubject: "Reminder: {player_name}'s session is tomorrow",
    defaultTemplate:
      "Hi {parent_name},\n\nJust a quick reminder that {player_name} has a coaching session coming up on {session_date}.\n\nSee you soon,\nAwarix",
    defaultTimingOffset: 24,
    offsetLabel: "Hours before session",
  },
  {
    type: "payment_reminder",
    title: "Payment reminder",
    description: "Nudge parents before a subscription payment is due.",
    defaultSubject: "Upcoming payment for {player_name}",
    defaultTemplate:
      "Hi {parent_name},\n\nThis is a friendly reminder that the next payment for {player_name} is due on {due_date}.\n\nThanks,\nAwarix",
    defaultTimingOffset: 3,
    offsetLabel: "Days before due date",
  },
  {
    type: "birthday_email",
    title: "Birthday email",
    description: "Send a friendly birthday message to players and parents.",
    defaultSubject: "Happy birthday, {player_name}!",
    defaultTemplate:
      "Hi {parent_name},\n\nEveryone at the academy wishes {player_name} a brilliant birthday. Have a fantastic day!\n\nAwarix",
    defaultTimingOffset: 0,
    offsetLabel: "Days offset",
  },
  {
    type: "report_follow_up",
    title: "Report follow-up",
    description: "Follow up after an AI progress report has been generated.",
    defaultSubject: "Following up on {player_name}'s latest report",
    defaultTemplate:
      "Hi {parent_name},\n\nWe hope {player_name}'s latest progress report was useful. Please reply if you have any questions or goals you would like us to focus on.\n\nAwarix",
    defaultTimingOffset: 2,
    offsetLabel: "Days after report",
  },
  {
    type: "attendance_alert",
    title: "Attendance alert",
    description: "Alert parents after two missed sessions.",
    defaultSubject: "Attendance check-in for {player_name}",
    defaultTemplate:
      "Hi {parent_name},\n\nWe noticed {player_name} has missed the last two sessions. Please let us know if there is anything we can help with.\n\nAwarix",
    defaultTimingOffset: 2,
    offsetLabel: "Missed sessions threshold",
  },
  {
    type: "subscription_renewal",
    title: "Subscription renewal reminder",
    description: "Remind parents before a subscription renews.",
    defaultSubject: "{player_name}'s subscription renews soon",
    defaultTemplate:
      "Hi {parent_name},\n\n{player_name}'s coaching subscription renews on {due_date}. Thanks for being part of the academy.\n\nAwarix",
    defaultTimingOffset: 7,
    offsetLabel: "Days before renewal",
  },
];

export function getAutomationTemplate(type: AutomationType) {
  return DEFAULT_AUTOMATION_TEMPLATES.find((template) => template.type === type);
}

export function renderAutomationText(
  template: string,
  values: Record<string, string | number | null | undefined>,
) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = values[key];
    return value === null || value === undefined || value === "" ? "there" : String(value);
  });
}
