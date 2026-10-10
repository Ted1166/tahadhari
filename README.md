# Tahadhari

Tahadhari means "caution" in Swahili. It checks a suspicious SMS or WhatsApp message, or a screenshot of one, for mobile money fraud in Kenya and answers in English, Swahili or Sheng.

## What it does

- Verdict (safe, suspicious, scam) with the red flags it found.
- Next steps, including forwarding scam SMS to 333 (Safaricom's fraud reporting channel).
- Community check: paybills, tills, phone numbers and links reported by other users are flagged. A link also goes through Google Safe Browsing.

## How it works

1. Claude reads the text or screenshot and returns a structured verdict.
2. A rules layer adds hard signals the model should not be left to guess, such as PIN requests and reversal pleas.
3. Extracted paybills, tills, phones and links are looked up in the community table in Supabase.
4. The verdict is raised when rules, community reports or Safe Browsing disagree with a "safe" answer.

The community table starts empty and fills only from real user reports.

## Setup

1. `npm install`
2. Copy `.env` to `.env.local` and fill in the values.
3. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor.
4. `npm run dev`, then open http://localhost:3000

## Deploy

Import the repository into Vercel and add the same environment variables.

## Honest limits

- It is advice, not proof. Verify with your provider before acting.
- Sheng output is model-generated and may be uneven.
- Reporting steps cover Safaricom and the police. Other providers are not yet covered.
- The concept of community reports is inspired by the author's earlier project GuardDog. This is a new codebase built during the hackathon window.

## License

MIT
