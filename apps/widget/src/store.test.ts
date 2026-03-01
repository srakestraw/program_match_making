import { describe, expect, it } from "vitest";
import { useWidgetStore } from "./store";

describe("widget store language", () => {
  it("updates language tag and label", () => {
    useWidgetStore.getState().clear();
    useWidgetStore.getState().setSessionLanguage("es", "Spanish");
    const state = useWidgetStore.getState();
    expect(state.sessionLanguageTag).toBe("es");
    expect(state.sessionLanguageLabel).toBe("Spanish");
  });
});
