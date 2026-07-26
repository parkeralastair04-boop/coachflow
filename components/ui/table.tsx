import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="border-border w-full overflow-x-auto rounded-xl border">
      <table
        className={cn("w-full min-w-[32rem] border-collapse text-left", className)}
        {...props}
      />
    </div>
  );
}

export function TableHead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-border bg-surface-subtle border-b", className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-border divide-y", className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "hover:bg-surface-hover/60 transition-colors duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(TYPE.tableHeader, "px-3 py-3 sm:px-4", className)}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn(TYPE.tableCell, "px-3 py-3 sm:px-4", className)} {...props} />
  );
}

export function TableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="text-muted px-4 py-10 text-center text-sm"
      >
        {children}
      </td>
    </tr>
  );
}

export function TableSkeleton({
  columns = 4,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="border-border w-full overflow-hidden rounded-xl border" role="status" aria-label="Loading table">
      <div className="bg-surface-subtle border-border grid gap-3 border-b px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="skeleton-pulse h-3 rounded-full" />
        ))}
      </div>
      <div className="divide-border divide-y">
        {Array.from({ length: rows }).map((_, row) => (
          <div
            key={row}
            className="grid gap-3 px-4 py-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, col) => (
              <div key={col} className="skeleton-pulse h-3 rounded-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
