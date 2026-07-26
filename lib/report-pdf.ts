import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { getPositionSummary, type PlayerPositionOption, type PreferredFootOption } from "@/lib/player-profile";
import {
  parseReportContent,
  REPORT_SECTIONS,
  type StructuredProgressReport,
} from "@/lib/structured-report";

type ReportPdfInput = {
  playerName: string;
  preferredFoot?: PreferredFootOption;
  primaryPosition?: PlayerPositionOption | null;
  secondaryPositions?: PlayerPositionOption[];
  teamNames?: string[];
  report: string;
  academyName?: string;
  date?: Date;
};

const A4 = {
  width: 595.28,
  height: 841.89,
};

const margin = 56;
const pageBottom = 82;

function slugifyFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function wrapLine(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) lines.push(currentLine);

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      currentLine = word;
      continue;
    }

    let fragment = "";
    for (const char of word) {
      const candidateFragment = `${fragment}${char}`;
      if (font.widthOfTextAtSize(candidateFragment, fontSize) <= maxWidth) {
        fragment = candidateFragment;
      } else {
        if (fragment) lines.push(fragment);
        fragment = char;
      }
    }
    currentLine = fragment;
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  return text
    .split(/\n/)
    .flatMap((line) =>
      line.trim() ? wrapLine(line.trim(), font, fontSize, maxWidth) : [""],
    );
}

async function loadLogoBytes(): Promise<ArrayBuffer> {
  if (typeof window !== "undefined") {
    const logoResponse = await fetch("/logo.png");
    if (!logoResponse.ok) {
      throw new Error("Could not load Awarix logo for PDF export.");
    }
    return logoResponse.arrayBuffer();
  }

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const buffer = await fs.readFile(path.join(process.cwd(), "public", "logo.png"));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function drawFooter(
  page: PDFPage,
  font: PDFFont,
  pageNumber: number,
  academyName: string,
) {
  page.drawLine({
    start: { x: margin, y: 54 },
    end: { x: A4.width - margin, y: 54 },
    thickness: 0.5,
    color: rgb(0.86, 0.88, 0.91),
  });
  page.drawText(`Prepared by ${academyName}`, {
    x: margin,
    y: 38,
    size: 8.5,
    font,
    color: rgb(0.38, 0.43, 0.5),
  });
  page.drawText("Powered by Awarix", {
    x: margin,
    y: 26,
    size: 8.5,
    font,
    color: rgb(0.38, 0.43, 0.5),
  });
  page.drawText(String(pageNumber), {
    x: A4.width - margin - 10,
    y: 34,
    size: 8.5,
    font,
    color: rgb(0.38, 0.43, 0.5),
  });
}

type PdfDrawContext = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  regularFont: PDFFont;
  boldFont: PDFFont;
  maxTextWidth: number;
};

function ensureSpace(
  context: PdfDrawContext,
  requiredHeight: number,
): PdfDrawContext {
  if (context.y >= pageBottom + requiredHeight) {
    return context;
  }

  const page = context.pdf.addPage([A4.width, A4.height]);
  return {
    ...context,
    page,
    y: A4.height - margin,
  };
}

function drawParagraph(
  context: PdfDrawContext,
  text: string,
  options?: { fontSize?: number; bold?: boolean; gapAfter?: number },
): PdfDrawContext {
  const fontSize = options?.fontSize ?? 11.5;
  const font = options?.bold ? context.boldFont : context.regularFont;
  const lineHeight = fontSize + 5.5;
  const lines = wrapText(text, font, fontSize, context.maxTextWidth);

  let next = context;
  for (const line of lines) {
    next = ensureSpace(next, lineHeight);
    if (line) {
      next.page.drawText(line, {
        x: margin,
        y: next.y,
        size: fontSize,
        font,
        color: rgb(0.12, 0.16, 0.22),
      });
      next = { ...next, y: next.y - lineHeight };
    } else {
      next = { ...next, y: next.y - lineHeight * 0.75 };
    }
  }

  return {
    ...next,
    y: next.y - (options?.gapAfter ?? 14),
  };
}

function drawStructuredReport(
  context: PdfDrawContext,
  sections: StructuredProgressReport,
): PdfDrawContext {
  let next = context;

  for (const { key, heading } of REPORT_SECTIONS) {
    const value = sections[key].trim();
    if (!value) continue;

    next = ensureSpace(next, 42);
    next = drawParagraph(next, heading, { fontSize: 13, bold: true, gapAfter: 8 });
    next = drawParagraph(next, value, { gapAfter: 18 });
  }

  return next;
}

export function getReportPdfFilename(playerName: string, date = new Date()) {
  const safePlayerName = slugifyFilename(playerName) || "player";
  return `awarix-report-${safePlayerName}-${formatIsoDate(date)}.pdf`;
}

export async function generateReportPdf({
  playerName,
  preferredFoot = "Unknown",
  primaryPosition = null,
  secondaryPositions = [],
  teamNames = [],
  report,
  academyName = "Awarix",
  date = new Date(),
}: ReportPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const logoImage = await pdf.embedPng(await loadLogoBytes());
  const logoDims = logoImage.scale(0.18);

  let page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - margin;

  page.drawImage(logoImage, {
    x: margin,
    y: y - logoDims.height,
    width: logoDims.width,
    height: logoDims.height,
  });

  y -= logoDims.height + 34;

  page.drawText("Progress Report", {
    x: margin,
    y,
    size: 28,
    font: boldFont,
    color: rgb(0.04, 0.1, 0.23),
  });

  y -= 32;
  page.drawText(`Player: ${playerName}`, {
    x: margin,
    y,
    size: 12.5,
    font: boldFont,
    color: rgb(0.04, 0.1, 0.23),
  });

  y -= 20;
  page.drawText(`Date: ${formatDisplayDate(date)}`, {
    x: margin,
    y,
    size: 10.5,
    font: regularFont,
    color: rgb(0.38, 0.43, 0.5),
  });

  y -= 18;
  page.drawText(
    `Position: ${getPositionSummary({
      primary_position: primaryPosition,
      secondary_positions: secondaryPositions,
    })} · ${preferredFoot} foot`,
    {
      x: margin,
      y,
      size: 10.5,
      font: regularFont,
      color: rgb(0.38, 0.43, 0.5),
    },
  );

  if (teamNames.length > 0) {
    y -= 18;
    page.drawText(`Team: ${teamNames.join(", ")}`, {
      x: margin,
      y,
      size: 10.5,
      font: regularFont,
      color: rgb(0.38, 0.43, 0.5),
    });
  }

  y -= 28;
  page.drawLine({
    start: { x: margin, y },
    end: { x: A4.width - margin, y },
    thickness: 1,
    color: rgb(0.06, 0.73, 0.51),
  });

  y -= 28;

  const context = drawStructuredReport(
    {
      pdf,
      page,
      y,
      regularFont,
      boldFont,
      maxTextWidth: A4.width - margin * 2,
    },
    parseReportContent(report),
  );

  page = context.page;
  y = context.y;

  if (y < pageBottom + 40) {
    page = pdf.addPage([A4.width, A4.height]);
    y = A4.height - margin;
  }

  for (let index = 0; index < pdf.getPageCount(); index += 1) {
    drawFooter(pdf.getPages()[index], regularFont, index + 1, academyName);
  }

  return pdf.save();
}
