import { NextResponse } from "next/server";
import { classify } from "@/lib/anthropic";
import { applyRules, callNote, type Lang } from "@/lib/rules";
import { extractEntities, normalizePhone, normalizeUrl, type Entity } from "@/lib/extract";
import { findReported } from "@/lib/db";
import { unsafeHosts } from "@/lib/safebrowsing";
import { reportingSteps } from "@/lib/reporting";

export const runtime = "nodejs";
export const maxDuration = 60;

const langs: Lang[] = ["en", "sw", "sheng"];
const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const text: string = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
        const lang: Lang = langs.includes(body.lang) ? body.lang : "en";
        const image =
            body.image && imageTypes.includes(body.image.mediaType) && typeof body.image.data === "string" && body.image.data.length < 7_000_000
                ? { mediaType: body.image.mediaType as string, data: body.image.data as string }
                : undefined;
        if (!text && !image) return NextResponse.json({ error: "Paste a message or upload a screenshot." }, { status: 400 });

        const verdict = await classify({ text, image, lang });

        const entities = new Map<string, Entity>();
        const put = (e: Entity) => entities.set(e.kind + ":" + e.value, e);
        extractEntities(text).forEach(put);
        verdict.paybills.forEach((v) => put({ kind: "paybill", value: v.replace(/\D/g, "") }));
        verdict.tills.forEach((v) => put({ kind: "till", value: v.replace(/\D/g, "") }));
        verdict.phones.forEach((v) => {
            const p = normalizePhone(v);
            if (p) put({ kind: "phone", value: p });
        });
        verdict.urls.forEach((v) => {
            const u = normalizeUrl(v);
            if (u) put({ kind: "url", value: u });
        });
        const list = [...entities.values()].filter((e) => e.value);

        const [community, unsafe] = await Promise.all([
            findReported(list),
            unsafeHosts(list.filter((e) => e.kind === "url").map((e) => e.value))
        ]);

        const ruleFlags = applyRules(text, lang);
        const flags = [...verdict.red_flags];
        ruleFlags.forEach((r) => {
            if (!flags.includes(r.flag)) flags.push(r.flag);
        });
        if (unsafe.length) flags.push("Google Safe Browsing lists these links as dangerous: " + unsafe.join(", "));

        let level = verdict.verdict;
        if (level === "safe" && (ruleFlags.length || community.length || unsafe.length)) level = "suspicious";
        if (level !== "scam" && (community.some((c) => c.report_count >= 3) || unsafe.length)) level = "scam";

        const steps = level === "safe" ? verdict.next_steps : [...verdict.next_steps, ...reportingSteps(lang)];
        if (/safaricom/i.test(text) && level !== "safe") steps.push(callNote[lang]);

        return NextResponse.json({
            verdict: level,
            scamType: verdict.scam_type,
            redFlags: flags,
            explanation: verdict.explanation,
            nextSteps: steps,
            entities: list,
            community
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "Analysis failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
