import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analyze";
import { clientKey, limited } from "@/lib/rateLimit";
import type { Lang } from "@/lib/rules";

export const runtime = "nodejs";
export const maxDuration = 60;

const langs: Lang[] = ["en", "sw", "sheng"];
const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: Request) {
    if (limited("analyze:" + clientKey(req), 20, 60_000)) {
        return NextResponse.json({ error: "Too many checks. Wait a minute and try again." }, { status: 429 });
    }
    try {
        const body = await req.json();
        const text: string = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
        const lang: Lang = langs.includes(body.lang) ? body.lang : "en";
        const image =
            body.image && imageTypes.includes(body.image.mediaType) && typeof body.image.data === "string" && body.image.data.length < 7_000_000
                ? { mediaType: body.image.mediaType as string, data: body.image.data as string }
                : undefined;
        if (!text && !image) return NextResponse.json({ error: "Paste a message or upload a screenshot." }, { status: 400 });
        return NextResponse.json(await runAnalysis({ text, image, lang }));
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Analysis failed" }, { status: 500 });
    }
}
