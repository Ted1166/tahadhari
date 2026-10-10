const hits = new Map<string, { count: number; reset: number }>();

export function limited(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
        hits.set(key, { count: 1, reset: now + windowMs });
        return false;
    }
    entry.count += 1;
    return entry.count > max;
}

export function clientKey(req: Request): string {
    return (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
}
