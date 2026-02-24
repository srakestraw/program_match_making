import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { beforeEach, describe, expect, it, vi } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const programFindUniqueMock = vi.fn();
const traitCountMock = vi.fn();
const deleteManyMock = vi.fn();
const createManyMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    program: {
      findUnique: programFindUniqueMock
    },
    trait: {
      count: traitCountMock
    },
    programTrait: {
      findMany: findManyMock
    },
    $transaction: async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        programTrait: {
          deleteMany: deleteManyMock,
          createMany: createManyMock
        }
      })
  }
}));

describe("PUT /api/admin/programs/:id/traits", () => {
  beforeEach(() => {
    programFindUniqueMock.mockReset();
    traitCountMock.mockReset();
    deleteManyMock.mockReset();
    createManyMock.mockReset();
    findManyMock.mockReset();
  });

  it("persists only remaining trait associations from the board payload", async () => {
    programFindUniqueMock.mockResolvedValue({ id: "program-1", name: "Program" });
    traitCountMock.mockResolvedValue(1);
    deleteManyMock.mockResolvedValue({ count: 2 });
    createManyMock.mockResolvedValue({ count: 1 });
    findManyMock.mockResolvedValue([
      {
        id: "pt-2",
        programId: "program-1",
        traitId: "trait-2",
        bucket: "IMPORTANT",
        sortOrder: 0,
        notes: null
      }
    ]);

    const { adminRouter } = await import("../src/routes/admin.js");
    const putRoute = adminRouter.stack.find(
      (layer: any) => layer.route?.path === "/programs/:id/traits" && layer.route?.methods?.put
    )?.route;
    const putHandler = putRoute?.stack?.[0]?.handle as
      | ((req: any, res: any) => Promise<void>)
      | undefined;

    expect(putHandler).toBeTruthy();

    const res = {
      statusCode: 200,
      body: undefined as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      }
    };

    await putHandler!(
      {
        params: { id: "program-1" },
        body: {
          items: [{ traitId: "trait-2", bucket: "IMPORTANT", sortOrder: 0 }]
        }
      },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { programId: "program-1" } });
    expect(createManyMock).toHaveBeenCalledWith({
      data: [
        {
          programId: "program-1",
          traitId: "trait-2",
          bucket: "IMPORTANT",
          sortOrder: 0,
          notes: null
        }
      ]
    });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]?.traitId).toBe("trait-2");
  });
});
