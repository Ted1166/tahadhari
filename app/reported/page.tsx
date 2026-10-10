import { listReported } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reported numbers and links - Tahadhari" };

function display(kind: string, value: string) {
    if (kind === "phone" && value.length >= 10) return value.slice(0, 6) + "***" + value.slice(-2);
    return value;
}

export default async function Reported() {
    let rows: Awaited<ReturnType<typeof listReported>> = [];
    let failed = false;
    try {
        rows = await listReported(2, 100);
    } catch {
        failed = true;
    }

    return (
        <main>
            <h1>Reported</h1>
            <p className="sub">
                Paybills, tills, numbers and links that at least two users have reported. Phone numbers are partly hidden here, but the checker still matches the full number.
            </p>
            <p><a href="/">Check a message</a></p>

            {failed && <p className="error">The list could not be loaded.</p>}
            {!failed && rows.length === 0 && <p className="tag">Nothing has reached two reports yet. Reports come only from real users.</p>}

            <section>
                {rows.map((r) => (
                    <div className="match" key={r.kind + r.value}>
                        <span>
                            {r.kind} {display(r.kind, r.value)}
                        </span>
                        <span className="tag">
                            {r.report_count} reports, last {new Date(r.last_seen).toISOString().slice(0, 10)}
                        </span>
                    </div>
                ))}
            </section>
        </main>
    );
}
