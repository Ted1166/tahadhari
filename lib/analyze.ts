import { classify, type Verdict } from "./anthropic";
import { applyRules, callNote, type Lang } from "./rules";
import { extractEntities, normalizePhone, normalizeUrl, type Entity } from "./extract";
import { findReported, type Reported } from "./db";
import { unsafeHosts } from "./safebrowsing";
import { reportingSteps } from "./reporting";

export type Analysis = {
    verdict: "safe" | "suspicious" | "scam";
    scamType: string;
    redFlags: string[];
    explanation: string;
    nextSteps: string[];
    entities: Entity[];
    community: Reported[];
    limited: boolean;
};

const limitedText: Record<Lang, string> = {
    en: "The AI check was unavailable, so only rules, community reports and link checks ran. This does not prove the message is safe. Verify with your provider before acting.",
    sw: "Ukaguzi wa AI haukupatikana, kwa hiyo ni sheria, ripoti za jamii na ukaguzi wa viungo tu vilivyotumika. Hii haithibitishi kuwa ujumbe ni salama. Thibitisha na mtoa huduma wako kabla ya kuchukua hatua.",
    sheng: "AI check haikuwork, so ni rules, ripoti za wasee na link check tu zimetumika. Hii haimaanishi message iko poa. Thibitisha na mtoa huduma wako kwanza."
};

export async function runAnalysis(input: {
    text: string;
    image?: { mediaType: string; data: string };
    lang: Lang;
}): Promise<Analysis> {
    let ai: Verdict | null = null;
    try {
        ai = await classify(input);
    } catch (e) {
        if (!input.text) throw e;
        console.error("classify failed", e);
    }

    const found = new Map<string, Entity>();
    const put = (e: Entity) => {
        if (e.value) found.set(e.kind + ":" + e.value, e);
    };
    extractEntities(input.text).forEach(put);
    ai?.paybills.forEach((v) => put({ kind: "paybill", value: v.replace(/\D/g, "") }));
    ai?.tills.forEach((v) => put({ kind: "till", value: v.replace(/\D/g, "") }));
    ai?.phones.forEach((v) => {
        const p = normalizePhone(v);
        if (p) put({ kind: "phone", value: p });
    });
    ai?.urls.forEach((v) => {
        const u = normalizeUrl(v);
        if (u) put({ kind: "url", value: u });
    });
    const entities = [...found.values()];

    const [community, unsafe] = await Promise.all([
        findReported(entities),
        unsafeHosts(entities.filter((e) => e.kind === "url").map((e) => e.value))
    ]);

    const ruleFlags = applyRules(input.text, input.lang);
    const redFlags = [...(ai?.red_flags ?? [])];
    ruleFlags.forEach((r) => {
        if (!redFlags.includes(r.flag)) redFlags.push(r.flag);
    });
    if (unsafe.length) redFlags.push("Google Safe Browsing lists these links as dangerous: " + unsafe.join(", "));

    let verdict: Analysis["verdict"] = ai ? ai.verdict : ruleFlags.length ? "suspicious" : "suspicious";
    if (!ai && ruleFlags.length >= 2) verdict = "scam";
    if (verdict === "safe" && (ruleFlags.length || community.length || unsafe.length)) verdict = "suspicious";
    if (verdict !== "scam" && (community.some((c) => c.report_count >= 3) || unsafe.length)) verdict = "scam";

    const base = ai ? ai.next_steps : [];
    const nextSteps = verdict === "safe" ? base : [...base, ...reportingSteps(input.lang)];
    if (/safaricom/i.test(input.text) && verdict !== "safe") nextSteps.push(callNote[input.lang]);

    return {
        verdict,
        scamType: ai ? ai.scam_type : ruleFlags.length ? ruleFlags[0].id : "unknown",
        redFlags,
        explanation: ai ? ai.explanation : limitedText[input.lang],
        nextSteps,
        entities,
        community,
        limited: !ai
    };
}
