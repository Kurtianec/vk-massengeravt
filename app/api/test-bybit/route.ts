
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(
      "https://api.bybit.com/v5/market/time",
      {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );

    const body = await response.text();

    return NextResponse.json({
      service: "VORTEX AI",
      httpStatus: response.status,
      bybitResponse: body.slice(0, 500),
    });
  } catch (error) {
    return NextResponse.json({
      service: "VORTEX AI",
      connected: false,
      error: String(error),
    });
  }
}
