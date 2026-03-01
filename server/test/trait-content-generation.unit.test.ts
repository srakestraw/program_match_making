import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateTraitSignals,
  generateTraitQuestions,
  generateTraitExperienceDraft,
  type GenerateTraitSignalsInput,
  type GenerateTraitQuestionsInput,
  type GenerateTraitExperienceDraftInput
} from "../src/lib/traitContentGeneration.js";

const fetchOpenAiWithRetryMock = vi.fn();

vi.mock("../src/lib/openai.js", () => ({
  fetchOpenAiWithRetry: (url: string, options: { body?: string }) => {
    return fetchOpenAiWithRetryMock(url, options);
  }
}));

describe("traitContentGeneration", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    fetchOpenAiWithRetryMock.mockReset();
  });

  describe("generateTraitSignals", () => {
    it("throws when OPENAI_API_KEY is not set", async () => {
      vi.stubEnv("OPENAI_API_KEY", "");
      await expect(
        generateTraitSignals({
          name: "Leadership",
          definition: "Leads teams.",
          category: "LEADERSHIP"
        })
      ).rejects.toThrow("OPENAI_API_KEY is not configured");
    });

    it("sends trait name, definition, and category in the request", async () => {
      fetchOpenAiWithRetryMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    positiveSignals: ["Provides concrete examples of leading teams."],
                    negativeSignals: ["Cannot give specific examples."],
                    followUps: ["Tell me more about a time you had to resolve conflict."]
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

      const input: GenerateTraitSignalsInput = {
        name: "Leadership & Team Direction",
        definition: "Leads teams effectively.",
        category: "LEADERSHIP"
      };
      await generateTraitSignals(input);

      expect(fetchOpenAiWithRetryMock).toHaveBeenCalledOnce();
      const [url, opts] = fetchOpenAiWithRetryMock.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(opts.body as string);
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.messages).toHaveLength(2);
      const userContent = body.messages[1].content;
      expect(userContent).toContain("Leadership & Team Direction");
      expect(userContent).toContain("Leads teams effectively.");
      expect(userContent).toContain("leadership");
    });

    it("parses and returns positiveSignals, negativeSignals, followUps", async () => {
      fetchOpenAiWithRetryMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    positiveSignals: ["Clear example of leading a team.", "Describes outcomes."],
                    negativeSignals: ["Vague answers.", "No specific situation."],
                    followUps: ["Can you give another example?"]
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

      const result = await generateTraitSignals({
        name: "Leadership",
        definition: null,
        category: "LEADERSHIP"
      });

      expect(result.positiveSignals).toEqual(["Clear example of leading a team.", "Describes outcomes."]);
      expect(result.negativeSignals).toEqual(["Vague answers.", "No specific situation."]);
      expect(result.followUps).toEqual(["Can you give another example?"]);
    });

    it("throws on OpenAI error response", async () => {
      fetchOpenAiWithRetryMock.mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "Rate limit exceeded" } }),
          { status: 429 }
        )
      );

      await expect(
        generateTraitSignals({ name: "X", definition: null, category: "ACADEMIC" })
      ).rejects.toThrow("OPENAI_UPSTREAM");
    });

    it("normalizes non-array or non-string values in response", async () => {
      fetchOpenAiWithRetryMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    positiveSignals: ["One", 2, null, "Three"],
                    negativeSignals: "single string",
                    followUps: []
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

      const result = await generateTraitSignals({
        name: "T",
        definition: null,
        category: "EXPERIENCE"
      });

      expect(result.positiveSignals).toEqual(["One", "Three"]);
      expect(result.negativeSignals).toEqual([]);
      expect(result.followUps).toEqual([]);
    });
  });

  describe("generateTraitQuestions", () => {
    it("throws when OPENAI_API_KEY is not set", async () => {
      vi.stubEnv("OPENAI_API_KEY", "");
      await expect(
        generateTraitQuestions({
          name: "Analytical",
          definition: null,
          category: "PROBLEM_SOLVING"
        })
      ).rejects.toThrow("OPENAI_API_KEY is not configured");
    });

    it("sends trait context in the request", async () => {
      fetchOpenAiWithRetryMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    chatPrompt: "Describe a time you analyzed a complex problem.",
                    quizPrompt: "Which response best demonstrates analytical thinking?",
                    quizOptions: ["A", "B", "C", "D"]
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

      await generateTraitQuestions({
        name: "Analytical Thinking",
        definition: "Breaks down complex problems.",
        category: "PROBLEM_SOLVING"
      });

      expect(fetchOpenAiWithRetryMock).toHaveBeenCalledOnce();
      const [, opts] = fetchOpenAiWithRetryMock.mock.calls[0];
      const body = JSON.parse(opts.body as string);
      const userContent = body.messages[1].content;
      expect(userContent).toContain("Analytical Thinking");
      expect(userContent).toContain("Breaks down complex problems.");
      expect(userContent).toContain("problem solving");
    });

    it("parses and returns chatPrompt, quizPrompt, quizOptions", async () => {
      fetchOpenAiWithRetryMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    chatPrompt: "Tell us about a time you led a project.",
                    quizPrompt: "Which best shows leadership?",
                    quizOptions: ["Option 1", "Option 2", "Option 3", "Option 4"]
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

      const result = await generateTraitQuestions({
        name: "Leadership",
        definition: null,
        category: "LEADERSHIP"
      });

      expect(result.chatPrompt).toBe("Tell us about a time you led a project.");
      expect(result.quizPrompt).toBe("Which best shows leadership?");
      expect(result.quizOptions).toEqual(["Option 1", "Option 2", "Option 3", "Option 4"]);
    });

    it("caps quizOptions at 4", async () => {
      fetchOpenAiWithRetryMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    chatPrompt: "Chat?",
                    quizPrompt: "Quiz?",
                    quizOptions: ["A", "B", "C", "D", "E"]
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

      const result = await generateTraitQuestions({
        name: "T",
        definition: null,
        category: "ACADEMIC"
      });

      expect(result.quizOptions).toHaveLength(4);
      expect(result.quizOptions).toEqual(["A", "B", "C", "D"]);
    });
  });

  describe("generateTraitExperienceDraft", () => {
    it("parses response when JSON is returned in output_text", async () => {
      fetchOpenAiWithRetryMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              publicLabel: "Strategic Builder",
              oneLineHook: "Turn ideas into plans and results.",
              archetypeTag: "BUILDER",
              displayIcon: "compass",
              visualMood: "ASPIRATIONAL"
            })
          }),
          { status: 200 }
        )
      );

      const input: GenerateTraitExperienceDraftInput = {
        action: "generate",
        name: "Strategic Execution",
        definition: "Drives plans from concept to delivery.",
        category: "LEADERSHIP"
      };

      const result = await generateTraitExperienceDraft(input);

      expect(result).toEqual({
        publicLabel: "Strategic Builder",
        oneLineHook: "Turn ideas into plans and results.",
        archetypeTag: "BUILDER",
        displayIcon: "compass",
        visualMood: "ASPIRATIONAL"
      });
    });

    it("parses response when JSON is returned in output message content", async () => {
      fetchOpenAiWithRetryMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      publicLabel: "Systems Thinker",
                      oneLineHook: "Connect patterns and make decisions with confidence.",
                      archetypeTag: "ANALYST",
                      displayIcon: "graph",
                      visualMood: "BOLD"
                    })
                  }
                ]
              }
            ]
          }),
          { status: 200 }
        )
      );

      const result = await generateTraitExperienceDraft({
        action: "simplify",
        name: "Analytical Thinking",
        definition: null,
        category: "PROBLEM_SOLVING"
      });

      expect(result).toEqual({
        publicLabel: "Systems Thinker",
        oneLineHook: "Connect patterns and make decisions with confidence.",
        archetypeTag: "ANALYST",
        displayIcon: "graph",
        visualMood: "BOLD"
      });
    });
  });
});
