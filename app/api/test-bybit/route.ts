
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const endpoints = [
    {
      name: "Bybit Server Time",
      url: "https://api.bybit.com/v5/market/time",
    },
    {
      name: "Bybit Instruments",
      url: "https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1",
    },
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });

      const body = await response.text();
      let retCode = null;

      try {
        retCode = JSON.parse(body).retCode ?? null;
      } catch {}

      results.push({
        name: endpoint.name,
        httpStatus: response.status,
        retCode,
        responsePreview: body.slice(0, 150),
      });
    } catch (error) {
      results.push({
        name: endpoint.name,
        error: String(error),
      });
    }
  }

  return NextResponse.json({
    service: "VORTEX AI",
    diagnostics: results,
  });
}
