import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Lang } from "./rules";

export const verdictSchema = z.object({
    verdict: z.enum(["safe", "suspicious", "scam"]),
    scam_type: z.string().default("none"),
    red_flags: z.array(z.string()).default([]),
    explanation: z.string(),
    next_steps: z.array(z.string()).default([]),
    paybills: z.array(z.string()).default([]),
    tills: z.array(z.string()).default([]),
    phones: z.array(z.string()).default([]),
    urls: z.array(z.string()).default([])
});

export type Verdict = z.infer<typeof verdictSchema>;

const languageName: Record<Lang, string> = {
    en: "English",
    sw: "Swahili",
    sheng: "Sheng (Nairobi street slang mixing Swahili and English, natural and not exaggerated)"
};

function systemPrompt(lang: Lang) {
    return `You check messages for mobile money fraud in Kenya (M-Pesa, Airtel Money, bank and loan apps). The user pastes an SMS or WhatsApp message or a screenshot of one.

Scam patterns to look for: fake reversal requests; wrong-number or mistaken-transfer pleas; fake loan, job or scholarship offers that need a fee; impersonated Safaricom staff or M-Pesa agents; fake prize or promotion links; fake Fuliza or limit messages; requests for PIN, OTP or passwords; SIM-registration threats; lookalike links.

Facts you can rely on: Safaricom only calls from 0722 000 000. Genuine M-Pesa confirmations arrive from the sender name MPESA, not from a personal number, and include a transaction code and balance. No provider asks for a PIN.

Rules: base the verdict only on the message. If the message is ambiguous, answer "suspicious" and say what to verify. Never invent facts about senders. Do not give reporting phone numbers in next_steps, the app adds them. Keep each red flag under 20 words and cite the exact wording from the message when possible.

Write explanation, red_flags and next_steps in ${languageName[lang]}.

Reply with one JSON object only, no markdown, with keys: verdict ("safe" | "suspicious" | "scam"), scam_type (short label or "none"), red_flags (array of strings), explanation (2 to 3 sentences), next_steps (array of 2 to 4 short actions), paybills, tills, phones, urls (arrays of the values found in the message, including inside a screenshot).`;
}

export async function classify(input: {
    text?: string;
    image?: { mediaType: string; data: string };
    lang: Lang;
}): Promise<Verdict> {
    const client = new Anthropic();
    const content: Anthropic.ContentBlockParam[] = [];
    if (input.image) {
        content.push({
            type: "image",
            source: {
                type: "base64",
                media_type: input.image.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
                data: input.image.data
            }
        });
    }
    content.push({
        type: "text",
        text: input.text ? "Message to check:\n" + input.text : "Check the message shown in the screenshot."
    });
    const res = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 1200,
        system: systemPrompt(input.lang),
        messages: [{ role: "user", content }]
    });
    const raw = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("Model returned no JSON");
    return verdictSchema.parse(JSON.parse(raw.slice(start, end + 1)));
}
