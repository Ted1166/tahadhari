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
    const { error } = await client().rpc("report_entity", {
        p_kind: e.kind,
        p_value: e.value,
        p_scam: scamType,
        p_note: note
    });
    if (error) throw new Error(error.message);
}
