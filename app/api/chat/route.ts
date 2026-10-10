import { NextResponse } from "next/server";
import { chatReply } from "@/lib/anthropic";
import { clientKey, limited } from "@/lib/rateLimit";
import type { Lang } from "@/lib/rules";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
    if (limited("chat:" + clientKey(req), 30, 60_000)) {
        return NextResponse.json({ error: "Too many questions. Wait a minute and try again." }, { status: 429 });
    }
    try {
        const body = await req.json();
        const lang: Lang = ["en", "sw", "sheng"].includes(body.lang) ? body.lang : "en";
        const messages = (Array.isArray(body.messages) ? body.messages : [])
            .slice(-8)
            .filter((m: { role: string; content: unknown }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
            .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, 1000) }));
        if (!messages.length || messages[messages.length - 1].role !== "user") {
            return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
        }
        const c = body.context ?? {};
        const reply = await chatReply({
            messages,
            lang,
            context: {
                verdict: String(c.verdict ?? "unknown").slice(0, 20),
                scamType: String(c.scamType ?? "unknown").slice(0, 80),
                explanation: String(c.explanation ?? "").slice(0, 600),
                redFlags: Array.isArray(c.redFlags) ? c.redFlags.slice(0, 8).map((f: unknown) => String(f).slice(0, 200)) : []
            }
        });
        return NextResponse.json({ reply });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Chat failed" }, { status: 500 });
    }
}
