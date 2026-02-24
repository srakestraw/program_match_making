import { describe, expect, it, vi } from "vitest";
import { getCandidateLookupOrder, upsertCandidate } from "../src/lib/candidates.js";

describe("candidate upsert lookup precedence", () => {
  it("prefers email before phone", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: "candidate-1", email: "person@example.com", phone: null, firstName: null, lastName: null, preferredChannel: null });
    const update = vi.fn().mockResolvedValue({ id: "candidate-1" });
    const create = vi.fn();

    await upsertCandidate(
      {
        candidate: {
          findFirst,
          update,
          create
        }
      } as any,
      {
        firstName: "Pat",
        email: "Person@Example.com",
        phone: "555-1111"
      }
    );

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({ where: { email: "person@example.com" } });
    expect(update).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("falls back to phone when email does not match", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "candidate-2", email: null, phone: "555-2222", firstName: null, lastName: null, preferredChannel: null });
    const update = vi.fn().mockResolvedValue({ id: "candidate-2" });

    await upsertCandidate(
      {
        candidate: {
          findFirst,
          update,
          create: vi.fn()
        }
      } as any,
      {
        email: "nomatch@example.com",
        phone: "555-2222"
      }
    );

    expect(findFirst).toHaveBeenNthCalledWith(1, { where: { email: "nomatch@example.com" } });
    expect(findFirst).toHaveBeenNthCalledWith(2, { where: { phone: "555-2222" } });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("returns email then phone in lookup order helper", () => {
    expect(getCandidateLookupOrder({ email: "A@B.com", phone: "123" })).toEqual([
      { field: "email", value: "a@b.com" },
      { field: "phone", value: "123" }
    ]);
  });
});
