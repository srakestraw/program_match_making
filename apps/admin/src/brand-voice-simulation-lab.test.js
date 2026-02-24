import { jsx as _jsx } from "react/jsx-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimulationLab } from "./components/brand-voice/SimulationLab";
describe("SimulationLab", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it("renders Simulation Lab and starts a simulation with first assistant response", async () => {
        const createdAt = "2026-02-24T00:00:00.000Z";
        const requestMock = vi.fn(async (path, init) => {
            const method = init?.method ?? "GET";
            if (path === "/api/admin/simulation-scenarios" && method === "GET") {
                return {
                    data: [
                        {
                            id: "scenario-1",
                            title: "First inquiry",
                            stage: "AWARENESS",
                            persona: null,
                            seedPrompt: "Tell me about this program.",
                            isPreset: true,
                            createdAt,
                            updatedAt: createdAt
                        }
                    ]
                };
            }
            if (path === "/api/admin/brand-voices/voice-1/simulations" && method === "POST") {
                return {
                    simulation: {
                        id: "simulation-1",
                        brandVoiceId: "voice-1",
                        scenarioId: "scenario-1",
                        persona: "STUDENT",
                        customScenario: null,
                        stabilityScore: null,
                        createdAt
                    },
                    turns: [
                        {
                            id: "turn-1",
                            simulationId: "simulation-1",
                            role: "USER",
                            content: "Tell me about this program.",
                            order: 0,
                            createdAt
                        }
                    ]
                };
            }
            if (path === "/api/admin/simulations/simulation-1/turns" && method === "POST") {
                return {
                    assistantTurn: {
                        id: "turn-2",
                        simulationId: "simulation-1",
                        role: "ASSISTANT",
                        content: "Here is the direct answer: Tell me about this program.",
                        order: 1,
                        createdAt
                    },
                    stabilityScore: 100,
                    avoidHits: []
                };
            }
            throw new Error(`Unexpected request: ${method} ${path}`);
        });
        const user = userEvent.setup();
        render(_jsx(SimulationLab, { brandVoiceId: "voice-1", request: requestMock }));
        await screen.findByRole("heading", { name: "Transcript" });
        await user.click(screen.getByRole("button", { name: "Start simulation" }));
        await waitFor(() => {
            expect(screen.getByText("Here is the direct answer: Tell me about this program.")).toBeTruthy();
        });
    });
});
