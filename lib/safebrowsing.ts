export async function unsafeHosts(hosts: string[]): Promise<string[]> {
    const key = process.env.SAFE_BROWSING_API_KEY;
    if (!key || hosts.length === 0) return [];
    const res = await fetch("https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client: { clientId: "tahadhari", clientVersion: "0.1.0" },
            threatInfo: {
                threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
                platformTypes: ["ANY_PLATFORM"],
                threatEntryTypes: ["URL"],
                threatEntries: hosts.map((h) => ({ url: "http://" + h + "/" }))
            }
        })
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { matches?: { threat: { url: string } }[] };
    return (json.matches ?? []).map((m) => m.threat.url.replace(/^https?:\/\//, "").replace(/\/$/, ""));
}
