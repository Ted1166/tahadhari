import { NextResponse } from "next/server";
import { extractEntities } from "@/lib/extract";
import { findReported } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const entities = extractEntities(String(body.query ?? "").slice(0, 500));
        return NextResponse.json({ entities, community: await findReported(entities) });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Lookup failed" }, { status: 500 });
    }
}
