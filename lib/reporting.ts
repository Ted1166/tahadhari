import type { Lang } from "./rules";

export function reportingSteps(lang: Lang): string[] {
    if (lang === "sw") {
        return [
            "Tuma ujumbe huu kwa 333 (Safaricom, bila malipo) ili kuripoti ulaghai.",
            "Usitume pesa wala kutoa PIN. Ukipoteza pesa, wasiliana na Safaricom mara moja.",
            "Ripoti kwa polisi kupitia 999 au 112 ikiwa umetishiwa au umepoteza pesa."
        ];
    }
    if (lang === "sheng") {
        return [
            "Forward huu msee kwa 333 (Safaricom, ni free) uripoti.",
            "Usitume pesa na usipee mtu PIN. Ukipoteza doo, piga Safaricom haraka.",
            "Ripoti kwa polisi 999 ama 112 kama umetishiwa ama umepoteza pesa."
        ];
    }
    return [
        "Forward this message to 333 (Safaricom fraud reporting, free) to report it.",
        "Do not send money or share your PIN. If you already lost money, contact Safaricom immediately.",
        "Report to the police on 999 or 112 if you were threatened or lost money."
    ];
}
