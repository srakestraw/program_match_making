import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();
// DATABASE_URL must be set (e.g. in .env) - RDS PostgreSQL

const prisma = new PrismaClient();

async function run() {
  const traitResult = await prisma.trait.deleteMany({
    where: {
      OR: [
        { name: { startsWith: "Failure Trait " } },
        { name: { startsWith: "Integration Trait " } }
      ]
    }
  });

  const programResult = await prisma.program.deleteMany({
    where: {
      OR: [
        { name: { startsWith: "Failure Program " } },
        { name: { startsWith: "Integration Program " } }
      ]
    }
  });

  console.log(`Deleted ${traitResult.count} test traits and ${programResult.count} test programs.`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
