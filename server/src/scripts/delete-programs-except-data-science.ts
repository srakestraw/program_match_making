/**
 * Deletes all programs except "Data Science and Analytics, M.S.A."
 * Run: pnpm --filter @pmm/server delete-programs-except-data-science
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

const KEEP_NAME = "Data Science and Analytics, M.S.A.";

async function run() {
  const result = await prisma.program.deleteMany({
    where: {
      name: { not: KEEP_NAME },
    },
  });
  console.log(`Deleted ${result.count} program(s). Kept: "${KEEP_NAME}".`);
}

run()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
