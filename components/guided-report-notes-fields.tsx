"use client";

import {
  EMPTY_GUIDED_REPORT_NOTES,
  GUIDED_REPORT_NOTE_LABELS,
  type GuidedReportNotes,
} from "@/lib/guided-report-notes";

type GuidedReportNotesFieldsProps = {
  value: GuidedReportNotes;
  onChange: (value: GuidedReportNotes) => void;
  disabled?: boolean;
};

export function GuidedReportNotesFields({
  value,
  onChange,
  disabled = false,
}: GuidedReportNotesFieldsProps) {
  return (
    <div className="space-y-4">
      {GUIDED_REPORT_NOTE_LABELS.map(({ key, label }) => (
        <div key={key}>
          <label className="mb-2 block text-sm font-medium" htmlFor={`guided-note-${key}`}>
            {label}
          </label>
          <textarea
            id={`guided-note-${key}`}
            value={value[key]}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...value,
                [key]: event.target.value,
              })
            }
            rows={3}
            className="border-border bg-background text-foreground focus-visible:ring-accent/40 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 disabled:opacity-60"
            placeholder={`${label} observations...`}
          />
        </div>
      ))}
    </div>
  );
}

export { EMPTY_GUIDED_REPORT_NOTES };
