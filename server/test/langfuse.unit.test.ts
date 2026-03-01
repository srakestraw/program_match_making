import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { afterEach, describe, expect, it, vi } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

describe("Langfuse setup", () => {
  const envKeys = [
    "LANGFUSE_PUBLIC_KEY",
    "LANGFUSE_SECRET_KEY",
    "LANGFUSE_HOST",
    "LANGFUSE_ENABLED"
  ] as const;
  const saved: Partial<Record<(typeof envKeys)[number], string>> = {};

  afterEach(() => {
    envKeys.forEach((k) => {
      if (k in saved) {
        if (saved[k] !== undefined) process.env[k] = saved[k];
        else delete process.env[k];
      }
    });
  });

  function saveEnv() {
    envKeys.forEach((k) => {
      saved[k] = process.env[k];
    });
  }

  it("is disabled when LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are missing", async () => {
    saveEnv();
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    process.env.LANGFUSE_HOST = "https://cloud.langfuse.com";

    const { isLangfuseEnabled, createLangfuseTrace, startLangfuseSpan, endLangfuseSpan } =
      await import("../src/lib/langfuse.js");

    expect(isLangfuseEnabled()).toBe(false);
    expect(() => createLangfuseTrace({ traceId: "t1", name: "test" })).not.toThrow();
    const span = startLangfuseSpan({ traceId: "t1", name: "span1" });
    expect(span).toBeNull();
    expect(() => endLangfuseSpan(span)).not.toThrow();
  });

  it("is disabled when LANGFUSE_ENABLED is 0", async () => {
    saveEnv();
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
    process.env.LANGFUSE_ENABLED = "0";

    const { isLangfuseEnabled } = await import("../src/lib/langfuse.js");
    expect(isLangfuseEnabled()).toBe(false);
  });

  it("is enabled when public and secret keys are set", async () => {
    saveEnv();
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";

    const { isLangfuseEnabled } = await import("../src/lib/langfuse.js");
    expect(isLangfuseEnabled()).toBe(true);
  });

  it("when configured, creates trace and span without throwing", async () => {
    saveEnv();
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    if (!publicKey || !secretKey) {
      vi.skip("LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY required for integration check");
      return;
    }

    const {
      isLangfuseEnabled,
      createLangfuseTrace,
      startLangfuseSpan,
      endLangfuseSpan,
      shutdownLangfuse
    } = await import("../src/lib/langfuse.js");

    expect(isLangfuseEnabled()).toBe(true);

    const traceId = `test-trace-${Date.now()}`;
    createLangfuseTrace({
      traceId,
      name: "langfuse-setup-verification",
      metadata: { test: true }
    });
    const span = startLangfuseSpan({
      traceId,
      name: "verify-span",
      input: { step: "test" }
    });
    expect(span).not.toBeNull();
    endLangfuseSpan(span!, { output: { ok: true } });

    await shutdownLangfuse();
  });
});
