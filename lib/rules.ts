export type Lang = "en" | "sw" | "sheng";

type Rule = { id: string; test: (t: string) => boolean; en: string; sw: string };

const claimsSafaricom = (t: string) => /safaricom|m-?pesa customer|customer care/i.test(t);

const rules: Rule[] = [
    {
        id: "pin_request",
        test: (t) => /(share|send|give|tuma|nipe|weka|enter|confirm).{0,40}(pin|password|nambari ya siri)|(pin|nambari ya siri).{0,30}(verify|confirm|thibitisha)/i.test(t),
        en: "Asks for your PIN or password. No genuine provider ever does.",
        sw: "Inaomba PIN au nambari yako ya siri. Watoa huduma halisi hawaombi hivyo kamwe."
    },
    {
        id: "wrong_number",
        test: (t) => /(wrong(ly)?\s*(number|sent)|by mistake|nimetuma.{0,20}(kimakosa|makosa)|tuma (tena|back|rudisha)|return (the )?(money|cash|funds))/i.test(t),
        en: "Wrong-number or mistaken-transfer plea asking you to send money back.",
        sw: "Madai ya kutuma pesa kimakosa na kuomba urudishe."
    },
    {
        id: "reversal",
        test: (t) => /revers(e|al)|rudisha pesa|cancel(l)?ed transaction/i.test(t),
        en: "Reversal request. Real reversals go through Safaricom, never through a stranger.",
        sw: "Ombi la kurudisha muamala. Kurudisha pesa hufanywa na Safaricom, si mtu asiyejulikana."
    },
    {
        id: "advance_fee",
        test: (t) => /(loan|mkopo|job|kazi|vacancy|scholarship).{0,80}(fee|processing|registration|ada|tuma|send|pay)/i.test(t),
        en: "Loan or job offer that asks you to pay a fee first.",
        sw: "Mkopo au kazi inayotaka ulipe ada kwanza."
    },
    {
        id: "prize",
        test: (t) => /(won|ushindi|umeshinda|congratulations|hongera).{0,80}(prize|zawadi|promo|claim|click|link)/i.test(t),
        en: "Prize or promotion claim that pushes you to click or pay.",
        sw: "Zawadi au promosheni inayokusukuma kubonyeza kiungo au kulipa."
    },
    {
        id: "dial_code",
        test: (t) => claimsSafaricom(t) && /\*\d{2,4}[*#]\d*/.test(t),
        en: "Tells you to dial a code while claiming to be from Safaricom.",
        sw: "Inakuambia upige msimbo ukidai kuwa Safaricom."
    }
];

export function applyRules(text: string, lang: Lang): { id: string; flag: string }[] {
    if (!text) return [];
    return rules.filter((r) => r.test(text)).map((r) => ({ id: r.id, flag: lang === "en" ? r.en : r.sw }));
}

export const callNote: Record<Lang, string> = {
    en: "Safaricom only calls from 0722 000 000. A call from any other number claiming to be Safaricom is fake.",
    sw: "Safaricom hupiga simu kutoka 0722 000 000 pekee. Simu kutoka nambari nyingine ikidai kuwa Safaricom ni ya kitapeli.",
    sheng: "Safaricom hupiga tu kutoka 0722 000 000. Ukipigiwa na number ingine ikisema ni Safaricom, ni mwizi."
};
