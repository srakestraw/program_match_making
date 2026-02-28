import { describe, expect, it } from "vitest";
import { createLanguageUtterance, localeForLanguageTag } from "./browserTts";
describe("createLanguageUtterance", () => {
    if (!globalThis.SpeechSynthesisUtterance) {
        globalThis.SpeechSynthesisUtterance = class {
            text;
            lang = "";
            voice;
            constructor(text) {
                this.text = text;
            }
        };
    }
    it("sets en-US for english", () => {
        const utterance = createLanguageUtterance("hello", "en");
        expect(utterance.lang).toBe("en-US");
    });
    it("chooses language-matching voice when available", () => {
        const voices = [
            { lang: "es-ES", name: "Spanish Voice" },
            { lang: "en-GB", name: "English Voice" }
        ];
        const utterance = createLanguageUtterance("hello", "en", voices);
        expect(utterance.voice?.name).toBe("English Voice");
        expect(utterance.lang.toLowerCase().startsWith("en")).toBe(true);
    });
    it("maps top language tags to preferred locales", () => {
        expect(localeForLanguageTag("es")).toBe("es-ES");
        expect(localeForLanguageTag("fr")).toBe("fr-FR");
    });
});
