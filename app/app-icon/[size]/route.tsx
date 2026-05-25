import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { BrandAppIcon } from "@/components/brand-mark";

const ALLOWED_SIZES = new Set([32, 48, 72, 96, 128, 180, 192, 256, 512]);

type AppIconRouteContext = {
  params: Promise<{ size: string }>;
};

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: AppIconRouteContext,
) {
  const { size } = await context.params;
  const resolvedSize = Number.parseInt(size, 10);

  if (!ALLOWED_SIZES.has(resolvedSize)) {
    return NextResponse.json({ error: "Unsupported icon size." }, { status: 404 });
  }

  return new ImageResponse(<BrandAppIcon />, {
    width: resolvedSize,
    height: resolvedSize,
  });
}
