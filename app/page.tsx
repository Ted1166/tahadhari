"use client";

import { useState } from "react";

type Entity = { kind: string; value: string };
type Reported = { kind: string; value: string; report_count: number };
type Result = {
  verdict: "safe" | "suspicious" | "scam";
  scamType: string;
  redFlags: string[];
  explanation: string;
  nextSteps: string[];
  entities: Entity[];
  community: Reported[];
  limited?: boolean;
};

const labels = {
  en: { safe: "Looks safe", suspicious: "Suspicious", scam: "Scam", flags: "Red flags found", steps: "What to do now", community: "Reported by other users", found: "Numbers and links in this message", times: "reports" },
  sw: { safe: "Inaonekana salama", suspicious: "Ina shaka", scam: "Ulaghai", flags: "Dalili za hatari", steps: "Cha kufanya sasa", community: "Imeripotiwa na watumiaji", found: "Nambari na viungo kwenye ujumbe huu", times: "ripoti" },
  sheng: { safe: "Iko poa", suspicious: "Ina shaka", scam: "Ni uwizi", flags: "Red flags zilizopatikana", steps: "Fanya hivi sasa", community: "Imeripotiwa na wasee", found: "Namba na links kwenye message hii", times: "ripoti" }
} as const;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("Could not read the image"));
    r.readAsDataURL(file);
  });
}

export default function Home() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<"en" | "sw" | "sheng">("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [reported, setReported] = useState<string[]>([]);
  const [chat, setChat] = useState<{ role: string; content: string }[]>([]);
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const t = labels[lang];

  async function check() {
    setBusy(true);
    setError("");
    setResult(null);
    setReported([]);
    setChat([]);
    try {
      const image = file ? { mediaType: file.type, data: await toBase64(file) } : undefined;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, image, lang })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Check failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  async function report(e: Entity) {
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...e, scamType: result?.scamType })
    });
    if (res.ok) setReported((r) => [...r, e.kind + ":" + e.value]);
    else setError((await res.json().catch(() => null))?.error || "Could not save the report. Try again.");
  }

  async function ask() {
    if (!q.trim() || !result) return;
    const next = [...chat, { role: "user", content: q.trim() }];
    setChat(next);
    setQ("");
    setAsking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          lang,
          context: { verdict: result.verdict, scamType: result.scamType, explanation: result.explanation, redFlags: result.redFlags }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Chat failed");
      setChat([...next, { role: "assistant", content: json.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setAsking(false);
    }
  }

  const isReported = (e: Entity) => result?.community.find((c) => c.kind === e.kind && c.value === e.value);

  return (
    <main>
      <h1>Tahadhari</h1>
      <p className="sub">Paste a suspicious SMS or WhatsApp message, or upload a screenshot. Get a verdict, the red flags and what to do next.</p>
      <p><a href="/reported">See reported numbers and links</a></p>

      <label htmlFor="msg" className="tag">Message</label>
      <textarea id="msg" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the message here" />

      <div className="row">
        <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
          <option value="en">English</option>
          <option value="sw">Kiswahili</option>
          <option value="sheng">Sheng</option>
        </select>
        <input className="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Screenshot" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={check} disabled={busy || (!text.trim() && !file)}>{busy ? "Checking" : "Check message"}</button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <section className={"result " + result.verdict} aria-live="polite">
          <p className="verdict">{t[result.verdict]}</p>
          <p>{result.explanation}</p>
          {result.limited && <p className="tag">Limited check: the AI was unavailable.</p>}

          {result.redFlags.length > 0 && (
            <>
              <h2>{t.flags}</h2>
              <ul>{result.redFlags.map((f) => <li key={f}>{f}</li>)}</ul>
            </>
          )}

          <h2>{t.steps}</h2>
          <ol>{result.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>

          {result.entities.length > 0 && (
            <>
              <h2>{result.community.length ? t.community : t.found}</h2>
              {result.entities.map((e) => {
                const hit = isReported(e);
                const key = e.kind + ":" + e.value;
                return (
                  <div className="match" key={key}>
                    <span>
                      {e.kind} {e.value}
                      <span className="tag">{hit ? " - " + hit.report_count + " " + t.times : ""}</span>
                    </span>
                    {result.verdict !== "safe" && (
                      <button className="ghost" disabled={reported.includes(key)} onClick={() => report(e)}>
                        {reported.includes(key) ? "Reported" : "Report this"}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <h2>Ask a follow-up</h2>
          {chat.map((m, i) => <p key={i} className={"bubble " + m.role}>{m.content}</p>)}
          <div className="row">
            <input
              className="file ask"
              aria-label="Follow-up question"
              placeholder="For example: I already sent money, what now?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
            />
            <button onClick={ask} disabled={asking || !q.trim()}>{asking ? "Thinking" : "Ask"}</button>
          </div>
        </section>
      )}
    </main>
  );
}
