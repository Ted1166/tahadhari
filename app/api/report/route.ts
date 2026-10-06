import { NextResponse } from "next/server";
import { saveReport } from "@/lib/db";

export const runtime = "nodejs";

const kinds = ["paybill", "till", "phone", "url"];

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!kinds.includes(body.kind) || typeof body.value !== "string" || !body.value.trim()) {
            return NextResponse.json({ error: "Invalid report." }, { status: 400 });
        }
        await saveReport(
            { kind: body.kind, value: body.value.trim().slice(0, 200) },
            String(body.scamType ?? "").slice(0, 80),
            String(body.note ?? "").slice(0, 300)
        );
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Report failed" }, { status: 500 });
    }
}
