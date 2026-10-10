import { createClient } from "@supabase/supabase-js";
import type { Entity } from "./extract";

function client() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase environment variables are missing");
    return createClient(url, key, { auth: { persistSession: false } });
}

export type Reported = { kind: string; value: string; report_count: number; last_seen: string };

export async function findReported(entities: Entity[]): Promise<Reported[]> {
    if (entities.length === 0) return [];
    const { data, error } = await client()
        .from("entities")
        .select("kind,value,report_count,last_seen")
        .in("value", entities.map((e) => e.value));
    if (error) throw new Error(error.message);
    return (data ?? []).filter((r) => entities.some((e) => e.kind === r.kind && e.value === r.value));
}

export async function saveReport(e: Entity, scamType: string, note: string) {
    const db = client();
    const ins = await db.from("reports").insert({ kind: e.kind, value: e.value, scam_type: scamType, note });
    if (ins.error) throw new Error("reports insert: " + ins.error.message);

    const cur = await db.from("entities").select("id,report_count").eq("kind", e.kind).eq("value", e.value).maybeSingle();
    if (cur.error) throw new Error("entities lookup: " + cur.error.message);

    if (cur.data) {
        const up = await db
            .from("entities")
            .update({ report_count: cur.data.report_count + 1, last_seen: new Date().toISOString() })
            .eq("id", cur.data.id);
        if (up.error) throw new Error("entities update: " + up.error.message);
    } else {
        const add = await db.from("entities").insert({ kind: e.kind, value: e.value });
        if (add.error) throw new Error("entities insert: " + add.error.message);
    }
}

export async function getChatLang(chatId: number): Promise<"en" | "sw" | "sheng"> {
    const { data } = await client().from("chat_prefs").select("lang").eq("chat_id", chatId).maybeSingle();
    return data && ["en", "sw", "sheng"].includes(data.lang) ? data.lang : "en";
}

export async function setChatLang(chatId: number, lang: string) {
    const { error } = await client().from("chat_prefs").upsert({ chat_id: chatId, lang });
    if (error) throw new Error(error.message);
}

export async function listReported(minReports: number, limit: number): Promise<Reported[]> {
    const { data, error } = await client()
        .from("entities")
        .select("kind,value,report_count,last_seen")
        .gte("report_count", minReports)
        .order("report_count", { ascending: false })
        .order("last_seen", { ascending: false })
        .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
}
