import { Database } from "lucide-react";

type SetupRequiredPanelProps = {
  title?: string;
  description: string;
  tables?: string[];
};

export function SetupRequiredPanel({
  title = "Database setup required",
  description,
  tables = [],
}: SetupRequiredPanelProps) {
  return (
    <div className="glass-panel rounded-2xl p-8 text-center sm:p-10">
      <Database className="text-accent mx-auto size-10" aria-hidden />
      <h2 className="mt-4 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted mx-auto mt-2 max-w-xl text-sm leading-relaxed">{description}</p>
      {tables.length > 0 ? (
        <p className="text-muted mx-auto mt-4 max-w-xl text-xs">
          Tables:{" "}
          {tables.map((table, index) => (
            <span key={table}>
              {index > 0 ? ", " : null}
              <code className="text-foreground">{table}</code>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
