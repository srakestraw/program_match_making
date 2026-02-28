/**
 * Validate seed payloads (traitsSeed, programsSeed, programTraitPlan) and print report.
 * Run: pnpm --filter @pmm/server seed:validate
 */
import { programTraitPlan, programsSeed, traitsSeed } from "./seed-payloads.js";

const BUCKETS = ["CRITICAL", "VERY_IMPORTANT", "IMPORTANT", "NICE_TO_HAVE"] as const;

function runValidation(): { pass: boolean; report: string[] } {
  const report: string[] = [];
  let pass = true;

  report.push("=== Seed Payload Validation Report ===\n");

  // 1) Bucket rules per program
  report.push("1) Bucket rules per program");
  report.push("   Rule: CRITICAL <= 2, exactly one VERY_IMPORTANT, one IMPORTANT, one NICE_TO_HAVE.");
  const byProgram = new Map<string, Record<string, number>>();
  for (const row of programTraitPlan) {
    if (!byProgram.has(row.programName)) {
      byProgram.set(row.programName, { CRITICAL: 0, VERY_IMPORTANT: 0, IMPORTANT: 0, NICE_TO_HAVE: 0 });
    }
    const counts = byProgram.get(row.programName)!;
    counts[row.bucket] = (counts[row.bucket] ?? 0) + 1;
  }
  const bucketOk =
    [...byProgram.values()].every(
      (c) =>
        (c.CRITICAL ?? 0) <= 2 &&
        (c.VERY_IMPORTANT ?? 0) === 1 &&
        (c.IMPORTANT ?? 0) === 1 &&
        (c.NICE_TO_HAVE ?? 0) === 1
    );
  if (bucketOk) {
    report.push("   Result: PASS.");
  } else {
    report.push("   Result: FAIL.");
    pass = false;
    for (const [prog, c] of byProgram) {
      if (
        (c.CRITICAL ?? 0) > 2 ||
        (c.VERY_IMPORTANT ?? 0) !== 1 ||
        (c.IMPORTANT ?? 0) !== 1 ||
        (c.NICE_TO_HAVE ?? 0) !== 1
      ) {
        report.push(`   - ${prog}: CRITICAL=${c.CRITICAL ?? 0} VERY_IMPORTANT=${c.VERY_IMPORTANT ?? 0} IMPORTANT=${c.IMPORTANT ?? 0} NICE_TO_HAVE=${c.NICE_TO_HAVE ?? 0}`);
      }
    }
  }
  report.push("");

  // 2) No duplicate (programName, traitName)
  report.push("2) Duplicate (programName, traitName)");
  report.push("   Rule: No duplicate (programName, traitName).");
  const pairs = new Set<string>();
  let duplicateOk = true;
  for (const row of programTraitPlan) {
    const key = `${row.programName}\t${row.traitName}`;
    if (pairs.has(key)) {
      duplicateOk = false;
      break;
    }
    pairs.add(key);
  }
  report.push(`   Result: ${duplicateOk ? "PASS." : "FAIL."}`);
  if (!duplicateOk) pass = false;
  report.push("");

  // 3) No trait name contains program words (program-name-like trait)
  report.push("3) Program-name traits");
  report.push("   Rule: No trait name may be program-name-like (traits are shared).");
  const programNamesNorm = programsSeed.map((p) => p.name.trim().toLowerCase());
  const traitNames = traitsSeed.map((t) => t.name);
  let programNameTraitOk = true;
  for (const traitName of traitNames) {
    const t = traitName.trim().toLowerCase();
    for (const prog of programNamesNorm) {
      if (t === prog || prog.includes(t) || t.includes(prog)) {
        programNameTraitOk = false;
        report.push(`   - Trait "${traitName}" is program-name-like (program: "${prog}").`);
      }
    }
  }
  if (programNameTraitOk) report.push("   Result: PASS.");
  else {
    report.push("   Result: FAIL.");
    pass = false;
  }
  report.push("");

  // 4) Trait usage frequency; flag single-use
  report.push("4) Trait usage frequency");
  report.push("   Rule: Flag any trait used by only one program.");
  const traitCount = new Map<string, number>();
  for (const row of programTraitPlan) {
    traitCount.set(row.traitName, (traitCount.get(row.traitName) ?? 0) + 1);
  }
  const sortedTraits = [...traitCount.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  report.push("   | Trait                                 | Program count | Flag           |");
  report.push("   | ------------------------------------- | ------------- | -------------- |");
  const singleUse: string[] = [];
  for (const [name, count] of sortedTraits) {
    const flag = count === 1 ? "**Single-use**" : "—";
    if (count === 1) singleUse.push(name);
    const padded = name.padEnd(38).slice(0, 38);
    report.push(`   | ${padded} | ${String(count).padStart(13)} | ${flag.padEnd(14)} |`);
  }
  if (singleUse.length > 0) {
    report.push("   Flagged (used by only one program): " + singleUse.join(", "));
  }
  report.push("");

  // 5) Final PASS/FAIL
  report.push("5) Final result");
  report.push(pass ? "   PASS" : "   FAIL");
  if (singleUse.length > 0 && pass) {
    report.push("   (Single-use traits flagged for optional follow-up.)");
  }

  return { pass, report };
}

const { pass, report } = runValidation();
console.log(report.join("\n"));
process.exit(pass ? 0 : 1);
