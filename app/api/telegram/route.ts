import { NextResponse } from "next/server";
import { runAnalysis, type Analysis } from "@/lib/analyze";
import { getChatLang, saveReport, setChatLang } from "@/lib/db";
import { limited } from "@/lib/rateLimit";
import type { Lang } from "@/lib/rules";

export const runtime = "nodejs";
export const maxDuration = 60;

const token = () => process.env.TELEGRAM_BOT_TOKEN || "";

async function tg(method: string, body: unknown) {
    return fetch("https://api.telegram.org/bot" + token() + "/" + method, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

const verdictLabel: Record<Lang, Record<Analysis["verdict"], string>> = {
    en: { safe: "Looks safe", suspicious: "Suspicious", scam: "SCAM" },
    sw: { safe: "Inaonekana salama", suspicious: "Ina shaka", scam: "ULAGHAI" },
    sheng: { safe: "Iko poa", suspicious: "Ina shaka", scam: "NI UWIZI" }
};

const headings: Record<Lang, { flags: string; steps: string; known: string; times: string }> = {
    en: { flags: "Red flags", steps: "What to do now", known: "Reported by others", times: "reports" },
    sw: { flags: "Dalili za hatari", steps: "Cha kufanya sasa", known: "Imeripotiwa na wengine", times: "ripoti" },
    sheng: { flags: "Red flags", steps: "Fanya hivi sasa", known: "Imeripotiwa na wasee", times: "ripoti" }
};

const intro =
    "Tahadhari checks suspicious SMS and WhatsApp messages for mobile money fraud.\n\nForward or paste a message, or send a screenshot.\nChange language: /en  /sw  /sheng";

function format(r: Analysis, lang: Lang): string {
    const h = headings[lang];
    const parts = [verdictLabel[lang][r.verdict], "", r.explanation];
    if (r.redFlags.length) parts.push("", h.flags + ":", ...r.redFlags.map((f) => "- " + f));
    if (r.nextSteps.length) parts.push("", h.steps + ":", ...r.nextSteps.map((s, i) => i + 1 + ". " + s));
    if (r.community.length) {
        parts.push("", h.known + ":", ...r.community.map((c) => "- " + c.kind + " " + c.value + " (" + c.report_count + " " + h.times + ")"));
    }
    return parts.join("\n").slice(0, 4000);
}

async function downloadPhoto(fileId: string) {
    const info = await (await tg("getFile", { file_id: fileId })).json();
    const path = info?.result?.file_path as string | undefined;
    if (!path) throw new Error("Could not fetch the image");
    const buf = Buffer.from(await (await fetch("https://api.telegram.org/file/bot" + token() + "/" + path)).arrayBuffer());
    return { mediaType: "image/jpeg", data: buf.toString("base64") };
}

type Msg = { chat: { id: number }; text?: string; caption?: string; photo?: { file_id: string }[] };

async function onMessage(m: Msg) {
    const chatId = m.chat.id;
    const text = (m.text ?? m.caption ?? "").trim();
    const cmd = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, "");

    if (cmd === "/start" || cmd === "/help") return void (await tg("sendMessage", { chat_id: chatId, text: intro }));
    if (cmd === "/en" || cmd === "/sw" || cmd === "/sheng") {
        await setChatLang(chatId, cmd.slice(1));
        return void (await tg("sendMessage", { chat_id: chatId, text: "OK" }));
    }
    if (!text && !m.photo) return void (await tg("sendMessage", { chat_id: chatId, text: intro }));
    if (limited("tg:" + chatId, 15, 60_000)) {
        return void (await tg("sendMessage", { chat_id: chatId, text: "Too many checks. Wait a minute and try again." }));
    }

    const lang = await getChatLang(chatId);
    await tg("sendChatAction", { chat_id: chatId, action: "typing" });
    try {
        const image = m.photo?.length ? await downloadPhoto(m.photo[m.photo.length - 1].file_id) : undefined;
        const r = await runAnalysis({ text, image, lang });
        const buttons = r.verdict === "safe"
            ? []
            : r.entities
                .map((e) => ({ text: "Report " + e.kind + " " + e.value.slice(0, 30), callback_data: "r:" + e.kind + ":" + e.value }))
                .filter((b) => b.callback_data.length <= 64)
                .slice(0, 4)
                .map((b) => [b]);
        await tg("sendMessage", {
            chat_id: chatId,
            text: format(r, lang),
            reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined
        });
    } catch (e) {
        console.error(e);
        await tg("sendMessage", { chat_id: chatId, text: "The check failed. Try again in a moment." });
    }
}

async function onCallback(q: { id: string; data?: string }) {
    const [tag, kind, ...rest] = (q.data ?? "").split(":");
    const value = rest.join(":");
    if (tag === "r" && ["paybill", "till", "phone", "url"].includes(kind) && value) {
        await saveReport({ kind: kind as "paybill" | "till" | "phone" | "url", value }, "telegram", "");
        await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Reported. Thank you." });
    } else {
        await tg("answerCallbackQuery", { callback_query_id: q.id });
    }
}

export async function POST(req: Request) {
    if (!token() || req.headers.get("x-telegram-bot-api-secret-token") !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const update = await req.json();
        if (update.callback_query) await onCallback(update.callback_query);
        else if (update.message) await onMessage(update.message);
    } catch (e) {
        console.error(e);
    }
    return NextResponse.json({ ok: true });
}
