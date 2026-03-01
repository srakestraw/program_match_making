/**
 * Seed the Data Science and Analytics, M.S.A. program and its traits (Robinson College of Business, GSU).
 * Run: pnpm --filter @pmm/server seed:data-science
 */
import {
  PrismaClient,
  ProgramTraitPriorityBucket,
  TraitCategory,
  TraitQuestionType
} from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

const PROGRAM_NAME = "Data Science and Analytics, M.S.A.";

const PROGRAM_DESCRIPTION = `Connect with a current student to learn about the Robinson experience.

Graduate Admissions
rcbgradadmissions@gsu.edu

Attend virtual office hours with one of our recruiters to get your questions answered.

No matter your background, you can prepare for an exciting career in data science at Robinson.
Whether you are a math or computer science whiz or possess a liberal arts degree, this program will prepare you for a job in the data science, analytics, and generative AI field.

After reviewing your application, the admissions committee will enroll you in a pathway that makes sense based on your background. Both tracks—data scientist and citizen data scientist—are STEM-designated as well as comprehensive, rigorous, and fast-paced. Through both courses of study, you will become comfortable with Python coding, machine learning, deep learning, and generative AI theory and practice. You also will have the option to attend boot camps covering topics like big data Spark, SAS, Amazon Web Services, and Microsoft Azure.

Data Scientist Track - Learn to build solutions with machine learning, deep learning, and generative AI methods across business domains.

Data collection, cleaning, and processing
Feature exploration and engineering
Machine learning, deep learning, and generative AI models
Model selection with different performance metrics and A/B testing
Model interpretability and actionable recommendations
Innovative solution ideation for business executives with generative AI models

Citizen Data Scientist Track - Learn to manage machine learning, deep learning, and generative AI projects to drive business solutions.

Machine learning, deep learning, and generative AI models
Performance evaluation and selection
Ability to bridge the gap between IT professionals and business stakeholders
Expertise in data science tools and terminology
Data visualization, evaluation, and interpretation
Confidence to leverage "data storytelling" to derive innovative solutions

Both tracks also include the option to pursue a concentration in either data science or legal analytics.`;

type TraitSeed = {
  name: string;
  category: TraitCategory;
  definition: string;
  bucket: ProgramTraitPriorityBucket;
  sortOrder: number;
  chatPrompt: string;
  quizPrompt: string;
  quizOptions: string[];
};

const TRAITS: TraitSeed[] = [
  {
    name: "Analytical Thinking",
    category: TraitCategory.PROBLEM_SOLVING,
    definition:
      "Ability to break down complex problems, evaluate evidence, and use logic and metrics to support model selection, A/B testing, and interpretability.",
    bucket: ProgramTraitPriorityBucket.CRITICAL,
    sortOrder: 0,
    chatPrompt:
      "Describe a time when you had to choose between different approaches or models. How did you evaluate the options and decide?",
    quizPrompt: "How would you rate your ability to structure problems and use data to decide?",
    quizOptions: ["Beginner", "Developing", "Proficient", "Advanced"]
  },
  {
    name: "Quantitative Reasoning",
    category: TraitCategory.ACADEMIC,
    definition:
      "Comfort with math, statistics, and quantitative methods; readiness to learn Python, machine learning, and generative AI theory and practice.",
    bucket: ProgramTraitPriorityBucket.CRITICAL,
    sortOrder: 1,
    chatPrompt:
      "Tell us about your experience with math, statistics, or coding. How do you approach learning new technical material?",
    quizPrompt: "How strong is your current quantitative or programming background?",
    quizOptions: ["Little or none", "Some exposure", "Comfortable", "Strong foundation"]
  },
  {
    name: "Data Storytelling",
    category: TraitCategory.INTERPERSONAL,
    definition:
      "Ability to translate technical results into clear, actionable recommendations and to communicate with business executives and stakeholders.",
    bucket: ProgramTraitPriorityBucket.CRITICAL,
    sortOrder: 2,
    chatPrompt:
      "Describe a time when you had to explain a technical or data-driven finding to someone non-technical. How did you make it clear and actionable?",
    quizPrompt: "How confident are you explaining data and models to business stakeholders?",
    quizOptions: ["Not yet", "Somewhat", "Confident", "Very confident"]
  },
  {
    name: "Technical Aptitude",
    category: TraitCategory.EXPERIENCE,
    definition:
      "Readiness to work with data science tools, Python, machine learning, deep learning, and cloud/platforms (e.g., AWS, Azure, Spark).",
    bucket: ProgramTraitPriorityBucket.VERY_IMPORTANT,
    sortOrder: 3,
    chatPrompt:
      "What experience do you have with programming, data tools, or analytics platforms? What would you want to learn first in this program?",
    quizPrompt: "How would you rate your readiness to learn Python and ML tools?",
    quizOptions: ["New to me", "Some basics", "Hands-on experience", "Extensive"]
  },
  {
    name: "Business Acumen",
    category: TraitCategory.EXPERIENCE,
    definition:
      "Understanding of how data science drives business solutions and ability to connect models to real-world decisions and outcomes.",
    bucket: ProgramTraitPriorityBucket.VERY_IMPORTANT,
    sortOrder: 4,
    chatPrompt:
      "Give an example of a business problem that could be improved with data or analytics. What would you want to measure or change?",
    quizPrompt: "How comfortable are you connecting data and models to business outcomes?",
    quizOptions: ["Learning", "Some experience", "Comfortable", "Very comfortable"]
  },
  {
    name: "Initiative & Learning Agility",
    category: TraitCategory.MOTIVATION,
    definition:
      "Self-directed drive to learn in a fast-paced, rigorous environment and to stay current with evolving tools and methods.",
    bucket: ProgramTraitPriorityBucket.VERY_IMPORTANT,
    sortOrder: 5,
    chatPrompt:
      "Describe a situation where you had to learn something new quickly or on your own. How did you approach it?",
    quizPrompt: "How do you rate your ability to learn quickly in a technical, fast-paced setting?",
    quizOptions: ["Prefer guided", "Can self-learn", "Enjoy self-learning", "Thrive in it"]
  },
  {
    name: "Collaboration",
    category: TraitCategory.INTERPERSONAL,
    definition:
      "Ability to work across functions and bridge the gap between technical teams and business stakeholders.",
    bucket: ProgramTraitPriorityBucket.IMPORTANT,
    sortOrder: 6,
    chatPrompt:
      "Tell us about a time you worked with people from different roles or backgrounds to get a project done. What was your role?",
    quizPrompt: "How would you rate your ability to collaborate across technical and non-technical teams?",
    quizOptions: ["Limited", "Some experience", "Strong", "Very strong"]
  },
  {
    name: "Ethical Reasoning",
    category: TraitCategory.LEADERSHIP,
    definition:
      "Awareness of model interpretability, fairness, and responsible use of data and AI in decision-making.",
    bucket: ProgramTraitPriorityBucket.IMPORTANT,
    sortOrder: 7,
    chatPrompt:
      "Why do you think interpretability and responsible use of AI matter in business? Give an example if you can.",
    quizPrompt: "How important do you think ethics and interpretability are in data science?",
    quizOptions: ["Not sure yet", "Somewhat important", "Important", "Essential"]
  }
];

async function run() {
  const program = await prisma.program.upsert({
    where: { name: PROGRAM_NAME },
    create: {
      name: PROGRAM_NAME,
      description: PROGRAM_DESCRIPTION,
      degreeLevel: "M.S.A.",
      department: "Robinson College of Business",
      isActive: true
    },
    update: {
      description: PROGRAM_DESCRIPTION,
      degreeLevel: "M.S.A.",
      department: "Robinson College of Business",
      isActive: true
    }
  });

  console.log(`Seeded program: ${program.name} (id: ${program.id})`);

  const programTraitData: { programId: string; traitId: string; bucket: ProgramTraitPriorityBucket; sortOrder: number }[] = [];

  for (const t of TRAITS) {
    const trait = await prisma.trait.upsert({
      where: { name: t.name },
      create: {
        name: t.name,
        category: t.category,
        definition: t.definition,
        rubricScaleMin: 0,
        rubricScaleMax: 5
      },
      update: {
        category: t.category,
        definition: t.definition
      }
    });

    programTraitData.push({
      programId: program.id,
      traitId: trait.id,
      bucket: t.bucket,
      sortOrder: t.sortOrder
    });

    await prisma.traitQuestion.upsert({
      where: { id: `dsa-chat-${trait.id}` },
      create: {
        id: `dsa-chat-${trait.id}`,
        traitId: trait.id,
        type: TraitQuestionType.CHAT,
        prompt: t.chatPrompt
      },
      update: { prompt: t.chatPrompt }
    });

    await prisma.traitQuestion.upsert({
      where: { id: `dsa-quiz-${trait.id}` },
      create: {
        id: `dsa-quiz-${trait.id}`,
        traitId: trait.id,
        type: TraitQuestionType.QUIZ,
        prompt: t.quizPrompt,
        optionsJson: JSON.stringify(t.quizOptions)
      },
      update: {
        prompt: t.quizPrompt,
        optionsJson: JSON.stringify(t.quizOptions)
      }
    });

    console.log(`  Trait: ${trait.name} (${t.bucket})`);
  }

  await prisma.programTrait.deleteMany({ where: { programId: program.id } });
  await prisma.programTrait.createMany({ data: programTraitData });

  console.log(`Linked ${programTraitData.length} traits to program. Seed complete.`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
