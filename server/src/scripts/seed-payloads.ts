/**
 * Seed payload constants for traits, programs, and program–trait assignments.
 * Used by validate-seed-payloads.ts and by future seed scripts.
 */

const BUCKETS = ["CRITICAL", "VERY_IMPORTANT", "IMPORTANT", "NICE_TO_HAVE"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const traitsSeed = [
  { name: "Analytical & Quantitative Reasoning", category: "PROBLEM_SOLVING", definition: "Breaks down complex problems using quantitative logic and evidence." },
  { name: "Statistical Modeling", category: "ACADEMIC", definition: "Builds and interprets statistical models for prediction and inference." },
  { name: "Data Analytics & Visualization", category: "ACADEMIC", definition: "Transforms data into insights and clear decision-ready visual narratives." },
  { name: "Applied AI & Automation", category: "ACADEMIC", definition: "Applies AI/ML and automation tools to improve business outcomes." },
  { name: "Accounting & Financial Reporting", category: "ACADEMIC", definition: "Uses accounting principles and financial reporting standards accurately." },
  { name: "Financial Decision-Making", category: "ACADEMIC", definition: "Evaluates investments, tradeoffs, and resource allocation with financial rigor." },
  { name: "Risk Assessment & Management", category: "PROBLEM_SOLVING", definition: "Identifies, quantifies, and mitigates operational and financial risks." },
  { name: "Regulatory & Ethical Judgment", category: "EXPERIENCE", definition: "Applies regulatory, governance, and ethical principles in decisions." },
  { name: "Healthcare Systems Literacy", category: "ACADEMIC", definition: "Understands healthcare delivery, policy, operations, and reimbursement context." },
  { name: "Legal Reasoning", category: "PROBLEM_SOLVING", definition: "Analyzes legal issues, precedents, and implications with structured argumentation." },
  { name: "Leadership & Team Direction", category: "LEADERSHIP", definition: "Leads teams effectively, aligns stakeholders, and executes through others." },
  { name: "Strategic Business Acumen", category: "LEADERSHIP", definition: "Connects cross-functional choices to long-term competitive advantage." },
  { name: "Stakeholder Communication", category: "INTERPERSONAL", definition: "Communicates clearly across technical, business, legal, and executive audiences." },
  { name: "Technology Systems Thinking", category: "PROBLEM_SOLVING", definition: "Understands enterprise systems, architecture tradeoffs, and digital enablement." },
  { name: "Cybersecurity & Privacy Governance", category: "PROBLEM_SOLVING", definition: "Applies security, privacy, and governance controls in information systems." },
  { name: "Global & Cross-Cultural Agility", category: "INTERPERSONAL", definition: "Works effectively across markets, cultures, and international business contexts." },
  { name: "Operations & Supply Chain Orientation", category: "EXPERIENCE", definition: "Optimizes sourcing, logistics, service levels, and end-to-end operations." },
  { name: "Market & Customer Insight", category: "EXPERIENCE", definition: "Uses market intelligence and customer behavior to guide growth decisions." },
  { name: "Innovation & Entrepreneurial Drive", category: "MOTIVATION", definition: "Initiates new ideas, experiments, and business model improvements." },
  { name: "Real Estate Investment Analysis", category: "EXPERIENCE", definition: "Assesses commercial property value, return, and development feasibility." }
];

export const programsSeed = [
  { name: "Interdisciplinary Studies: Accounting and Data Science Concentration, Master of", description: "Interdisciplinary graduate training combining accounting depth with data-science methods.", degreeLevel: "Master's", department: "J. Mack Robinson College of Business" },
  { name: "Master of Interdisciplinary Studies (Actuarial Science, Artificial Intelligence and Information Systems Concentration)", description: "Cross-disciplinary preparation in actuarial science, AI, and information systems.", degreeLevel: "Master's", department: "J. Mack Robinson College of Business" },
  { name: "Master of Actuarial Science", description: "Advanced preparation in actuarial methods, modeling, and risk applications.", degreeLevel: "M.S.", department: "J. Mack Robinson College of Business" },
  { name: "Commercial Real Estate, M.S.", description: "Graduate preparation in commercial real estate finance, valuation, and development.", degreeLevel: "M.S.", department: "J. Mack Robinson College of Business" },
  { name: "Executive MBA", description: "Executive-focused MBA for experienced professionals driving strategic leadership impact.", degreeLevel: "MBA", department: "J. Mack Robinson College of Business" },
  { name: "Finance, M.S.", description: "Advanced finance curriculum with analytical, quantitative, and market-facing depth.", degreeLevel: "M.S.", department: "J. Mack Robinson College of Business" },
  { name: "Health Administration, M.S.", description: "Graduate preparation for leadership in healthcare delivery and administration.", degreeLevel: "M.S.", department: "J. Mack Robinson College of Business" },
  { name: "Information Systems, M.S.", description: "Technology and analytics-focused graduate program for digital business leadership.", degreeLevel: "M.S.", department: "J. Mack Robinson College of Business" },
  { name: "International Business, Master of", description: "Global business graduate training across markets, strategy, and operations.", degreeLevel: "Master's", department: "J. Mack Robinson College of Business" },
  { name: "J.D. & Master of Science in Health Administration", description: "Dual-degree pathway integrating legal training with healthcare administration.", degreeLevel: "Dual Degree", department: "College of Law + J. Mack Robinson College of Business" },
  { name: "J.D. & Master of Professional Accountancy", description: "Dual-degree pathway integrating legal reasoning with professional accountancy.", degreeLevel: "Dual Degree", department: "College of Law + J. Mack Robinson College of Business" },
  { name: "J.D. & Master of Business Administration & Master of Health Administration", description: "Triple-degree pathway spanning law, business, and healthcare leadership.", degreeLevel: "Dual/Triple Degree", department: "College of Law + J. Mack Robinson College of Business" },
  { name: "J.D. & M.S.A. in Data Science and Analytics", description: "Dual-degree pathway connecting legal practice with analytics and data science.", degreeLevel: "Dual Degree", department: "College of Law + J. Mack Robinson College of Business" },
  { name: "Marketing, M.S.", description: "Advanced marketing program centered on analytics, strategy, and customer insight.", degreeLevel: "M.S.", department: "J. Mack Robinson College of Business" },
  { name: "MBA", description: "General management graduate program for strategic, cross-functional leadership.", degreeLevel: "MBA", department: "J. Mack Robinson College of Business" },
  { name: "MBA/Master of Health Administration", description: "Integrated business and healthcare leadership graduate pathway.", degreeLevel: "Dual Master's", department: "J. Mack Robinson College of Business" },
  { name: "Professional Accountancy, Master of (Cohort)", description: "Cohort-based professional accountancy graduate training.", degreeLevel: "Master's", department: "J. Mack Robinson College of Business" },
  { name: "Quantitative Risk Analysis & Management, M.S.", description: "Quantitative graduate program focused on risk analytics and decision support.", degreeLevel: "M.S.", department: "J. Mack Robinson College of Business" },
  { name: "Supply Chain Management, M.S.", description: "Graduate program in operations, logistics, and supply chain strategy.", degreeLevel: "M.S.", department: "J. Mack Robinson College of Business" },
  { name: "Data Science and Analytics, M.S.A.", description: "STEM-designated analytics program with Data Scientist and Citizen Data Scientist tracks, covering data programming, machine learning, deep learning, generative AI, model evaluation, and data storytelling through applied industry projects.", degreeLevel: "M.S.A.", department: "J. Mack Robinson College of Business" }
];

export type ProgramTraitPlanRow = {
  programName: string;
  traitName: string;
  bucket: Bucket;
  sortOrder: number;
  notes: string | null;
};

export const programTraitPlan: ProgramTraitPlanRow[] = [
  { programName: "Interdisciplinary Studies: Accounting and Data Science Concentration, Master of", traitName: "Accounting & Financial Reporting", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Interdisciplinary Studies: Accounting and Data Science Concentration, Master of", traitName: "Analytical & Quantitative Reasoning", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Interdisciplinary Studies: Accounting and Data Science Concentration, Master of", traitName: "Data Analytics & Visualization", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Interdisciplinary Studies: Accounting and Data Science Concentration, Master of", traitName: "Regulatory & Ethical Judgment", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Interdisciplinary Studies: Accounting and Data Science Concentration, Master of", traitName: "Stakeholder Communication", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Master of Interdisciplinary Studies (Actuarial Science, Artificial Intelligence and Information Systems Concentration)", traitName: "Analytical & Quantitative Reasoning", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Master of Interdisciplinary Studies (Actuarial Science, Artificial Intelligence and Information Systems Concentration)", traitName: "Applied AI & Automation", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Master of Interdisciplinary Studies (Actuarial Science, Artificial Intelligence and Information Systems Concentration)", traitName: "Statistical Modeling", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Master of Interdisciplinary Studies (Actuarial Science, Artificial Intelligence and Information Systems Concentration)", traitName: "Technology Systems Thinking", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Master of Interdisciplinary Studies (Actuarial Science, Artificial Intelligence and Information Systems Concentration)", traitName: "Risk Assessment & Management", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Master of Actuarial Science", traitName: "Statistical Modeling", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Master of Actuarial Science", traitName: "Risk Assessment & Management", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Master of Actuarial Science", traitName: "Analytical & Quantitative Reasoning", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Master of Actuarial Science", traitName: "Financial Decision-Making", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Master of Actuarial Science", traitName: "Regulatory & Ethical Judgment", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Commercial Real Estate, M.S.", traitName: "Real Estate Investment Analysis", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Commercial Real Estate, M.S.", traitName: "Financial Decision-Making", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Commercial Real Estate, M.S.", traitName: "Stakeholder Communication", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Commercial Real Estate, M.S.", traitName: "Strategic Business Acumen", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Commercial Real Estate, M.S.", traitName: "Data Analytics & Visualization", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Executive MBA", traitName: "Leadership & Team Direction", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Executive MBA", traitName: "Strategic Business Acumen", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Executive MBA", traitName: "Stakeholder Communication", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Executive MBA", traitName: "Global & Cross-Cultural Agility", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Executive MBA", traitName: "Innovation & Entrepreneurial Drive", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Finance, M.S.", traitName: "Financial Decision-Making", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Finance, M.S.", traitName: "Analytical & Quantitative Reasoning", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Finance, M.S.", traitName: "Statistical Modeling", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Finance, M.S.", traitName: "Risk Assessment & Management", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Finance, M.S.", traitName: "Applied AI & Automation", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Health Administration, M.S.", traitName: "Healthcare Systems Literacy", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Health Administration, M.S.", traitName: "Leadership & Team Direction", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Health Administration, M.S.", traitName: "Stakeholder Communication", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Health Administration, M.S.", traitName: "Strategic Business Acumen", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Health Administration, M.S.", traitName: "Regulatory & Ethical Judgment", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Information Systems, M.S.", traitName: "Technology Systems Thinking", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Information Systems, M.S.", traitName: "Data Analytics & Visualization", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Information Systems, M.S.", traitName: "Applied AI & Automation", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Information Systems, M.S.", traitName: "Cybersecurity & Privacy Governance", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Information Systems, M.S.", traitName: "Stakeholder Communication", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "International Business, Master of", traitName: "Global & Cross-Cultural Agility", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "International Business, Master of", traitName: "Strategic Business Acumen", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "International Business, Master of", traitName: "Stakeholder Communication", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "International Business, Master of", traitName: "Operations & Supply Chain Orientation", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "International Business, Master of", traitName: "Innovation & Entrepreneurial Drive", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Science in Health Administration", traitName: "Legal Reasoning", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Science in Health Administration", traitName: "Healthcare Systems Literacy", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "J.D. & Master of Science in Health Administration", traitName: "Regulatory & Ethical Judgment", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Science in Health Administration", traitName: "Stakeholder Communication", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Science in Health Administration", traitName: "Leadership & Team Direction", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Professional Accountancy", traitName: "Legal Reasoning", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Professional Accountancy", traitName: "Accounting & Financial Reporting", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "J.D. & Master of Professional Accountancy", traitName: "Regulatory & Ethical Judgment", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Professional Accountancy", traitName: "Financial Decision-Making", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Professional Accountancy", traitName: "Stakeholder Communication", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Business Administration & Master of Health Administration", traitName: "Legal Reasoning", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Business Administration & Master of Health Administration", traitName: "Healthcare Systems Literacy", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "J.D. & Master of Business Administration & Master of Health Administration", traitName: "Strategic Business Acumen", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Business Administration & Master of Health Administration", traitName: "Leadership & Team Direction", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "J.D. & Master of Business Administration & Master of Health Administration", traitName: "Regulatory & Ethical Judgment", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "J.D. & M.S.A. in Data Science and Analytics", traitName: "Legal Reasoning", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "J.D. & M.S.A. in Data Science and Analytics", traitName: "Data Analytics & Visualization", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "J.D. & M.S.A. in Data Science and Analytics", traitName: "Statistical Modeling", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "J.D. & M.S.A. in Data Science and Analytics", traitName: "Applied AI & Automation", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "J.D. & M.S.A. in Data Science and Analytics", traitName: "Regulatory & Ethical Judgment", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Marketing, M.S.", traitName: "Market & Customer Insight", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Marketing, M.S.", traitName: "Stakeholder Communication", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Marketing, M.S.", traitName: "Data Analytics & Visualization", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Marketing, M.S.", traitName: "Strategic Business Acumen", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Marketing, M.S.", traitName: "Applied AI & Automation", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "MBA", traitName: "Leadership & Team Direction", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "MBA", traitName: "Strategic Business Acumen", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "MBA", traitName: "Stakeholder Communication", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "MBA", traitName: "Financial Decision-Making", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "MBA", traitName: "Innovation & Entrepreneurial Drive", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "MBA/Master of Health Administration", traitName: "Healthcare Systems Literacy", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "MBA/Master of Health Administration", traitName: "Strategic Business Acumen", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "MBA/Master of Health Administration", traitName: "Leadership & Team Direction", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "MBA/Master of Health Administration", traitName: "Stakeholder Communication", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "MBA/Master of Health Administration", traitName: "Regulatory & Ethical Judgment", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Professional Accountancy, Master of (Cohort)", traitName: "Accounting & Financial Reporting", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Professional Accountancy, Master of (Cohort)", traitName: "Regulatory & Ethical Judgment", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Professional Accountancy, Master of (Cohort)", traitName: "Financial Decision-Making", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Professional Accountancy, Master of (Cohort)", traitName: "Stakeholder Communication", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Professional Accountancy, Master of (Cohort)", traitName: "Data Analytics & Visualization", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Quantitative Risk Analysis & Management, M.S.", traitName: "Statistical Modeling", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Quantitative Risk Analysis & Management, M.S.", traitName: "Risk Assessment & Management", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Quantitative Risk Analysis & Management, M.S.", traitName: "Analytical & Quantitative Reasoning", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Quantitative Risk Analysis & Management, M.S.", traitName: "Financial Decision-Making", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Quantitative Risk Analysis & Management, M.S.", traitName: "Applied AI & Automation", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Supply Chain Management, M.S.", traitName: "Operations & Supply Chain Orientation", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Supply Chain Management, M.S.", traitName: "Analytical & Quantitative Reasoning", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Supply Chain Management, M.S.", traitName: "Technology Systems Thinking", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Supply Chain Management, M.S.", traitName: "Stakeholder Communication", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Supply Chain Management, M.S.", traitName: "Strategic Business Acumen", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null },
  { programName: "Data Science and Analytics, M.S.A.", traitName: "Data Analytics & Visualization", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "Data Science and Analytics, M.S.A.", traitName: "Applied AI & Automation", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "Data Science and Analytics, M.S.A.", traitName: "Statistical Modeling", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Data Science and Analytics, M.S.A.", traitName: "Technology Systems Thinking", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "Data Science and Analytics, M.S.A.", traitName: "Stakeholder Communication", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null }
];

/** QUIZ options per doc: exactly ["Beginner","Developing","Proficient","Advanced"] */
export const QUIZ_OPTIONS_JSON = '["Beginner","Developing","Proficient","Advanced"]';

export type TraitQuestionSeedRow = {
  traitName: string;
  type: "CHAT" | "QUIZ";
  prompt: string;
  optionsJson?: string;
};

/** Build traitQuestionsSeed: 2 CHAT + 1 QUIZ per trait with required optionsJson for QUIZ. */
export function buildTraitQuestionsSeed(): TraitQuestionSeedRow[] {
  const rows: TraitQuestionSeedRow[] = [];
  for (const t of traitsSeed) {
    rows.push(
      {
        traitName: t.name,
        type: "CHAT",
        prompt: `Describe a situation that demonstrates your ability in ${t.name}.`
      },
      {
        traitName: t.name,
        type: "CHAT",
        prompt: `Give an example of how you have applied ${t.definition}.`
      },
      {
        traitName: t.name,
        type: "QUIZ",
        prompt: `How would you rate your current level in this area?`,
        optionsJson: QUIZ_OPTIONS_JSON
      }
    );
  }
  return rows;
}

/** Default rubric lines (3 positive, 3 negative, 2 follow-ups) derived from definition for completeness. */
export function defaultRubricForTrait(definition: string): {
  rubricPositiveSignals: string;
  rubricNegativeSignals: string;
  rubricFollowUps: string;
} {
  return {
    rubricPositiveSignals: [
      `Demonstrates or applies: ${definition}`,
      "Provides clear evidence or examples.",
      "Shows consistency with the competency."
    ].join("\n"),
    rubricNegativeSignals: [
      "Little or no relevant evidence provided.",
      "Examples are vague or off-topic.",
      "Does not align with the competency."
    ].join("\n"),
    rubricFollowUps: [
      "Ask for a concrete example if none given.",
      "Probe for depth if answer is superficial."
    ].join("\n")
  };
}
