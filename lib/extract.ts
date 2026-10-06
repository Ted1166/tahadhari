export type Kind = "paybill" | "till" | "phone" | "url";
export type Entity = { kind: Kind; value: string };

export function normalizePhone(raw: string): string | null {
    const d = raw.replace(/\D/g, "");
    if (d.length === 10 && (d.startsWith("07") || d.startsWith("01"))) return "254" + d.slice(1);
    if (d.length === 12 && d.startsWith("254")) return d;
    return null;
}

export function normalizeUrl(raw: string): string | null {
    try {
        const u = new URL(/^https?:\/\//i.test(raw) ? raw : "http://" + raw);
        return u.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return null;
    }
}

export function extractEntities(text: string): Entity[] {
    const out = new Map<string, Entity>();
    const add = (kind: Kind, value: string | null) => {
        if (value) out.set(kind + ":" + value, { kind, value });
    };
    for (const m of text.matchAll(/pay\s*bill(?:\s*(?:no|number|namba)\.?)?\D{0,12}(\d{5,7})/gi)) add("paybill", m[1]);
    for (const m of text.matchAll(/(?:till|buy\s*goods)(?:\s*(?:no|number|namba)\.?)?\D{0,12}(\d{5,7})/gi)) add("till", m[1]);
    for (const m of text.matchAll(/(?:\+?254|0)[17]\d{8}/g)) add("phone", normalizePhone(m[0]));
    for (const m of text.matchAll(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi)) {
        if (/^[\d.]+$/.test(m[0])) continue;
        add("url", normalizeUrl(m[0]));
    }
    return [...out.values()];
}
