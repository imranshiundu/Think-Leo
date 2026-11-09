import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Device registry — records which desktops/phones visit Think Leo.
 * POST: log one anonymous hardware snapshot. GET: recent visits.
 */

const DevicePayload = z.object({
  kind: z.enum(["laptop", "mobile"]),
  os: z.string().max(40),
  browser: z.string().max(40),
  formFactor: z.string().max(40),
  platform: z.string().max(60),
  screen: z.string().max(20),
  viewport: z.string().max(20),
  pixelRatio: z.number(),
  cpuCores: z.number().nullable(),
  ramGB: z.number().nullable(),
  touchPoints: z.number(),
  language: z.string().max(20),
  timezone: z.string().max(60),
  online: z.boolean(),
  standalone: z.boolean(),
  gpu: z.string().max(100),
  ua: z.string().max(240),
  at: z.string().max(40),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const d = DevicePayload.safeParse(body);
    if (!d.success) {
      return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
    }
    const row = await db.deviceVisit.create({
      data: {
        kind: d.data.kind,
        os: d.data.os,
        browser: d.data.browser,
        formFactor: d.data.formFactor,
        platform: d.data.platform,
        screen: d.data.screen,
        viewport: d.data.viewport,
        pixelRatio: d.data.pixelRatio,
        cpuCores: d.data.cpuCores,
        ramGB: d.data.ramGB,
        touchPoints: d.data.touchPoints,
        language: d.data.language,
        timezone: d.data.timezone,
        online: d.data.online,
        standalone: d.data.standalone,
        gpu: d.data.gpu,
        ua: d.data.ua,
      },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    console.error("device log failed", err);
    // never break the app over telemetry
    return NextResponse.json({ ok: false, stored: false }, { status: 200 });
  }
}

export async function GET() {
  try {
    const visits = await db.deviceVisit.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ ok: true, visits });
  } catch (err) {
    console.error("device read failed", err);
    return NextResponse.json({ ok: false, visits: [] }, { status: 200 });
  }
}
