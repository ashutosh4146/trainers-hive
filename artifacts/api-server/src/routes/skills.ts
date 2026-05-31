import { Router, type IRouter } from "express";
import { db, requirementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
      subSkills: requirementsTable.subSkills,
    })
    .from(requirementsTable)
    .where(eq(requirementsTable.status, "open"));

  const canonical = new Map<string, string>();
  for (const cat of SKILLS) {
    canonical.set(cat.name.toLowerCase(), cat.name);
    for (const name of cat.skills) {
      canonical.set(name.toLowerCase(), name);
    }
  }

  const counts = new Map<string, number>();
  const labels = new Map<string, string>();
  const collect = (raw: unknown, seen: Set<string>) => {
    if (typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    seen.add(key);
    if (!labels.has(key)) {
      labels.set(key, canonical.get(key) ?? trimmed);
    }
  };

  for (const row of rows) {
    const seen = new Set<string>();
    if (row.skill) collect(row.skill, seen);
    if (Array.isArray(row.subSkills)) {
      for (const s of row.subSkills as string[]) collect(s, seen);
    }
    for (const key of seen) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const demand = Array.from(counts.entries())
    .map(([key, count]) => ({ skill: labels.get(key) ?? key, count }))
    .sort((a, b) => b.count - a.count);

  res.json(demand);
});

export default router;
