"use client";

import { useCallback, useRef, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import {
  PITCH_ELEMENT_LABELS,
  PITCH_ELEMENT_TYPES,
  type PitchElement,
  type PitchElementType,
  type PitchLayout,
} from "@/lib/training-types";
import { generatePitchPdf, getPitchPdfFilename } from "@/lib/training-pdf";

type TrainingPitchBuilderProps = {
  title: string;
  layout: PitchLayout;
  onChange: (layout: PitchLayout) => void;
};

export function TrainingPitchBuilder({ title, layout, onChange }: TrainingPitchBuilderProps) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [selectedType, setSelectedType] = useState<PitchElementType>("player");
  const [exporting, setExporting] = useState(false);

  const addElement = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = pitchRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      const element: PitchElement = {
        id: crypto.randomUUID(),
        type: selectedType,
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        label: PITCH_ELEMENT_LABELS[selectedType].slice(0, 2),
      };
      onChange({
        elements: [...layout.elements, element],
        updatedAt: new Date().toISOString(),
      });
    },
    [layout.elements, onChange, selectedType],
  );

  function removeElement(id: string) {
    onChange({
      elements: layout.elements.filter((element) => element.id !== id),
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      const bytes = await generatePitchPdf({ title, layout });
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getPitchPdfFilename(title);
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Pitch element tools">
        {PITCH_ELEMENT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={selectedType === type}
            onClick={() => setSelectedType(type)}
            className={`focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              selectedType === type
                ? "bg-accent text-accent-foreground"
                : "border-border border hover:bg-surface-hover"
            }`}
          >
            {PITCH_ELEMENT_LABELS[type]}
          </button>
        ))}
        <button
          type="button"
          disabled={exporting}
          onClick={() => void handleExportPdf()}
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Download className="size-4" aria-hidden />
          Export PDF
        </button>
      </div>

      <div
        ref={pitchRef}
        role="application"
        aria-label="Interactive training pitch. Click to place the selected element."
        onClick={addElement}
        className="relative aspect-[68/105] w-full max-w-xl cursor-crosshair overflow-hidden rounded-2xl border-2 border-emerald-700/40 bg-emerald-50 dark:bg-emerald-950/20"
      >
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-emerald-700/30" aria-hidden />
        {layout.elements.map((element) => (
          <button
            key={element.id}
            type="button"
            aria-label={`${PITCH_ELEMENT_LABELS[element.type]} at ${Math.round(element.x)}%, ${Math.round(element.y)}%`}
            style={{ left: `${element.x}%`, top: `${element.y}%` }}
            className={`focus-visible:ring-accent/40 absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full text-xs font-semibold text-white outline-none focus-visible:ring-2 ${
              element.type === "player"
                ? "bg-blue-600"
                : element.type === "cone"
                  ? "bg-orange-500"
                  : element.type === "zone"
                    ? "size-16 rounded-lg bg-emerald-600/20 ring-2 ring-emerald-700/40"
                    : element.type === "arrow"
                      ? "size-8 rounded-none bg-transparent text-black"
                      : "bg-zinc-700"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              removeElement(element.id);
            }}
          >
            {element.type === "arrow" ? "→" : (element.label ?? PITCH_ELEMENT_LABELS[element.type].slice(0, 1))}
          </button>
        ))}
      </div>

      <p className="text-muted text-sm" role="status">
        Select an element, then click the pitch to place it. Click a placed element to remove it.
      </p>

      {layout.elements.length === 0 ? (
        <p className="text-muted flex items-center gap-2 text-sm">
          <Plus className="size-4" aria-hidden />
          No pitch elements yet.
        </p>
      ) : (
        <ul className="space-y-2" role="list" aria-label="Placed pitch elements">
          {layout.elements.map((element) => (
            <li
              key={element.id}
              className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
              role="listitem"
            >
              <span>
                {PITCH_ELEMENT_LABELS[element.type]} · {Math.round(element.x)}%, {Math.round(element.y)}%
              </span>
              <button
                type="button"
                aria-label={`Remove ${PITCH_ELEMENT_LABELS[element.type]}`}
                onClick={() => removeElement(element.id)}
                className="focus-visible:ring-accent/40 inline-flex size-11 items-center justify-center rounded-xl outline-none focus-visible:ring-2"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
