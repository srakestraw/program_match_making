import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { LanguagePills } from "./LanguagePills";
import { LanguagePickerModal } from "./LanguagePickerModal";
import { EXTRA_LANGUAGE_OPTIONS, PRIMARY_LANGUAGE_OPTIONS } from "../constants/languages";

const SelectorHarness = () => {
  const [tag, setTag] = useState("en");
  const [label, setLabel] = useState("English");
  const [open, setOpen] = useState(false);
  const custom = PRIMARY_LANGUAGE_OPTIONS.find((item) => item.tag === tag) ? null : { tag, label };

  return (
    <>
      <LanguagePills
        valueTag={tag}
        customLanguage={custom}
        options={PRIMARY_LANGUAGE_OPTIONS}
        onChangeTag={(nextTag, nextLabel) => {
          setTag(nextTag);
          setLabel(nextLabel);
        }}
        onOpenOther={() => setOpen(true)}
      />
      <LanguagePickerModal
        open={open}
        options={EXTRA_LANGUAGE_OPTIONS}
        onClose={() => setOpen(false)}
        onSelect={(nextTag, nextLabel) => {
          setTag(nextTag);
          setLabel(nextLabel);
          setOpen(false);
        }}
      />
    </>
  );
};

describe("Language selector", () => {
  it("opens Other modal and replaces Other pill with selected custom language", () => {
    render(<SelectorHarness />);
    fireEvent.click(screen.getByTestId("language-pill-other"));
    expect(screen.getByPlaceholderText("Type a language")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Type a language"), { target: { value: "portuguese" } });
    fireEvent.click(screen.getByText("Portuguese (Brazil)"));
    expect(screen.getByText("Portuguese (Brazil)")).toBeInTheDocument();
  });
});
