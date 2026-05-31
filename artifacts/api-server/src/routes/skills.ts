import { Router, type IRouter } from "express";
import { db, requirementsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

const SKILLS = [
  {
    id: "leadership",
    name: "Leadership & Management",
    skills: [
      "Executive Coaching",
      "First-Time Manager",
      "Strategic Thinking",
      "Change Management",
      "Conflict Resolution",
      "Decision Making",
    ],
  },
  {
    id: "tech",
    name: "Technology",
    skills: [
      "Python",
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "AWS",
      "Kubernetes",
      "DevOps",
      "Cybersecurity",
      "Data Engineering",
      "Machine Learning",
      "LLM Engineering",
    ],
  },
  {
    id: "data",
    name: "Data & Analytics",
    skills: [
      "Data Science",
      "Power BI",
      "Tableau",
      "SQL",
      "Statistics",
      "Business Analytics",
    ],
  },
  {
    id: "soft-skills",
    name: "Soft Skills",
    skills: [
      "Communication",
      "Public Speaking",
      "Negotiation",
      "Emotional Intelligence",
      "Time Management",
      "Storytelling",
    ],
  },
  {
    id: "sales",
    name: "Sales & Marketing",
    skills: [
      "B2B Selling",
      "Account Management",
      "Brand Strategy",
      "Digital Marketing",
      "Performance Marketing",
      "Content Strategy",
    ],
  },
  {
    id: "compliance",
    name: "Compliance & HR",
    skills: [
      "POSH",
      "Diversity & Inclusion",
      "GDPR",
      "ISO 27001",
      "Workplace Safety",
      "HR Analytics",
    ],
  },
  {
    id: "finance",
    name: "Finance",
    skills: [
      "Financial Modeling",
      "Investment Analysis",
      "Corporate Finance",
      "Risk Management",
      "Accounting",
    ],
  },
];

router.get("/skills", (_req, res) => {
  res.json(SKILLS);
});

router.get("/skills/demand", async (_req, res) => {
  const rows = await db
    .select({
      skill: requirementsTable.skill,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(requirementsTable)
    .where(eq(requirementsTable.status, "open"))
    .groupBy(requirementsTable.skill)
    .orderBy(desc(sql`COUNT(*)`));
  res.json(rows);
});

export default router;
