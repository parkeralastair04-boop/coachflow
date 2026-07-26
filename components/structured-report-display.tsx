import {
  parseReportContent,
  REPORT_SECTIONS,
  type StructuredProgressReport,
} from "@/lib/structured-report";

type StructuredReportDisplayProps = {
  report: string | StructuredProgressReport;
  className?: string;
};

export function StructuredReportDisplay({
  report,
  className,
}: StructuredReportDisplayProps) {
  const sections =
    typeof report === "string" ? parseReportContent(report) : report;

  return (
    <div className={className}>
      {REPORT_SECTIONS.map(({ key, heading }) => {
        const value = sections[key].trim();
        if (!value) return null;

        return (
          <section key={key} className="not-first:mt-5">
            <h2 className="text-base font-semibold tracking-tight">{heading}</h2>
            <p className="text-muted mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {value}
            </p>
          </section>
        );
      })}
    </div>
  );
}
