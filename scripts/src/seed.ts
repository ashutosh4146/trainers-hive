import {
  db,
  usersTable,
  vendorsTable,
  trainersTable,
  requirementsTable,
  applicationsTable,
  reviewsTable,
  activityTable,
  sessionStateTable,
} from "@workspace/db";

async function clear() {
  await db.delete(activityTable);
  await db.delete(reviewsTable);
  await db.delete(applicationsTable);
  await db.delete(requirementsTable);
  await db.delete(trainersTable);
  await db.delete(vendorsTable);
  await db.delete(usersTable);
  await db.delete(sessionStateTable);
}

function daysFromNow(d: number): Date {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x;
}
function daysAgo(d: number): Date {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x;
}

async function seed() {
  await clear();

  const vendors = [
    {
      id: "ven-northwind",
      companyName: "Northwind Corp",
      industry: "Manufacturing",
      location: "Bengaluru, IN",
      contactName: "Aarav Mehta",
      contactDesignation: "Head of Learning & Development",
      email: "ld@northwind.example",
      about:
        "A global manufacturing leader investing in continuous learning across 12,000 employees. We partner with trainers who can scale curricula across plants in India, SE Asia, and Eastern Europe.",
      logoUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Northwind&backgroundColor=1f2a44",
      websiteUrl: "https://northwind.example",
      verified: true,
    },
    {
      id: "ven-helix",
      companyName: "Helix Biotech",
      industry: "Pharmaceuticals",
      location: "Hyderabad, IN",
      contactName: "Dr. Meera Iyer",
      contactDesignation: "VP People & Culture",
      email: "people@helix.example",
      about:
        "FDA-regulated biotech building next-gen therapeutics. Looking for trainers who understand GxP, statistical methods, and modern engineering practice.",
      logoUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Helix&backgroundColor=0f766e",
      websiteUrl: "https://helix.example",
      verified: true,
    },
    {
      id: "ven-svgi",
      companyName: "Sri Venkateswara Group of Institutions",
      industry: "Higher Education",
      location: "Tirupati, IN",
      contactName: "Prof. Krishnan Rao",
      contactDesignation: "Dean of Industry Relations",
      email: "industry@svgi.example",
      about:
        "Engineering and management institute placing 1,200 students annually. We engage trainers for industry-readiness bootcamps every semester.",
      logoUrl: "https://api.dicebear.com/7.x/initials/svg?seed=SVGI&backgroundColor=7c2d12",
      websiteUrl: "https://svgi.example",
      verified: true,
    },
    {
      id: "ven-arcus",
      companyName: "Arcus Capital",
      industry: "Financial Services",
      location: "Mumbai, IN",
      contactName: "Riya Kapoor",
      contactDesignation: "Director, Talent Development",
      email: "talent@arcus.example",
      about:
        "Boutique investment bank serving mid-market clients. We invest heavily in our analyst class — modeling, valuation, communication, and ethics training.",
      logoUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Arcus&backgroundColor=4c1d95",
      websiteUrl: "https://arcus.example",
      verified: false,
    },
    {
      id: "ven-bluereef",
      companyName: "BlueReef Learning",
      industry: "EdTech",
      location: "Gurugram, IN",
      contactName: "Saanvi Nair",
      contactDesignation: "Head of Curriculum",
      email: "curriculum@bluereef.example",
      about:
        "Career-launchpad EdTech with 80,000+ learners. We partner with senior trainers to build flagship cohort programs in data and engineering.",
      logoUrl: "https://api.dicebear.com/7.x/initials/svg?seed=BlueReef&backgroundColor=1e3a8a",
      websiteUrl: "https://bluereef.example",
      verified: true,
    },
  ];
  await db.insert(vendorsTable).values(vendors);

  const trainers = [
    {
      id: "tr-priya",
      name: "Priya Sharma",
      headline: "LLM systems engineer turned trainer — production AI for engineers",
      mainSkill: "LLM Engineering",
      subSkills: ["Python", "Machine Learning", "AWS", "DevOps"],
      experienceYears: 11,
      location: "Bengaluru, IN",
      remote: true,
      rating: "4.92",
      reviewCount: 24,
      hourlyRate: 9500,
      verified: true,
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Priya",
      availability: "Weekdays from May, 6 hour blocks",
      bio: "Eleven years building production ML systems at scale. I now run focused 3-day workshops for engineering teams adopting LLMs — retrieval, evaluation, fine-tuning, and the operational side most courses skip.",
      certifications: [{ name: "AWS ML Specialty" }, { name: "Stanford CS329S" }, { name: "MLOps Specialization" }],
      languages: ["English", "Hindi", "Kannada"],
      completedTrainings: 47,
      portfolioUrl: "https://example.com/priya",
    },
    {
      id: "tr-arjun",
      name: "Arjun Banerjee",
      headline: "Executive coach for first-time managers in deep-tech",
      mainSkill: "First-Time Manager",
      subSkills: ["Leadership & Management", "Communication", "Conflict Resolution", "Decision Making"],
      experienceYears: 18,
      location: "Pune, IN",
      remote: true,
      rating: "4.88",
      reviewCount: 41,
      hourlyRate: 12000,
      verified: true,
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Arjun",
      availability: "Tue/Wed/Thu, monthly cohorts",
      bio: "Former engineering director at two unicorns. I coach the moment a strong individual contributor steps into leading people — the hardest professional transition most engineers ever make.",
      certifications: [{ name: "ICF PCC" }, { name: "Hogan Assessment Certified" }],
      languages: ["English", "Bengali", "Hindi"],
      completedTrainings: 96,
    },
    {
      id: "tr-fatima",
      name: "Fatima Khan",
      headline: "Cybersecurity trainer — practical defense for product teams",
      mainSkill: "Cybersecurity",
      subSkills: ["AWS", "DevOps", "Kubernetes", "ISO 27001"],
      experienceYears: 14,
      location: "Hyderabad, IN",
      remote: true,
      rating: "4.85",
      reviewCount: 18,
      hourlyRate: 8800,
      verified: true,
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Fatima",
      availability: "Bi-weekly cohorts",
      bio: "I teach engineers to ship secure software without slowing down. Live attack/defense labs, no PowerPoint security theatre.",
      certifications: [{ name: "OSCP" }, { name: "CISSP" }, { name: "AWS Security Specialty" }],
      languages: ["English", "Urdu", "Hindi"],
      completedTrainings: 38,
    },
    {
      id: "tr-rohan",
      name: "Rohan D'Souza",
      headline: "Financial modeling for analysts — from Excel to insight",
      mainSkill: "Financial Modeling",
      subSkills: ["Investment Analysis", "Corporate Finance", "Risk Management", "Statistics"],
      experienceYears: 16,
      location: "Mumbai, IN",
      remote: false,
      rating: "4.78",
      reviewCount: 31,
      hourlyRate: 7500,
      verified: true,
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Rohan",
      availability: "Weekday evenings; full days on request",
      bio: "12 years in M&A and PE. I run intensive bootcamps for analyst classes at investment banks and consulting firms — three-statement modeling, LBOs, valuation done right.",
      certifications: [{ name: "CFA" }, { name: "Wharton WMP" }],
      languages: ["English", "Marathi", "Hindi"],
      completedTrainings: 64,
    },
    {
      id: "tr-aisha",
      name: "Aisha Verma",
      headline: "Data storytelling and Power BI for business teams",
      mainSkill: "Power BI",
      subSkills: ["SQL", "Business Analytics", "Storytelling", "Communication"],
      experienceYears: 9,
      location: "Delhi NCR, IN",
      remote: true,
      rating: "4.81",
      reviewCount: 27,
      hourlyRate: 5500,
      verified: true,
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Aisha",
      availability: "Mon-Wed, half-day sessions",
      bio: "I help non-technical teams stop building dashboards no one reads. Practical data storytelling, dashboard design, and Power BI taught the way analysts actually use it.",
      certifications: [{ name: "Microsoft Data Analyst Associate" }],
      languages: ["English", "Hindi", "Punjabi"],
      completedTrainings: 52,
    },
    {
      id: "tr-vikram",
      name: "Vikram Iyer",
      headline: "Public speaking coach for executives and rising leaders",
      mainSkill: "Public Speaking",
      subSkills: ["Communication", "Storytelling", "Negotiation", "Emotional Intelligence"],
      experienceYears: 22,
      location: "Bengaluru, IN",
      remote: true,
      rating: "4.95",
      reviewCount: 58,
      hourlyRate: 14000,
      verified: true,
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Vikram",
      availability: "Custom executive engagements",
      bio: "Former TEDx curator. I work 1:1 and with leadership teams on the talks that matter — board reviews, all-hands, conference keynotes, investor pitches.",
      certifications: [{ name: "Toastmasters DTM" }, { name: "Heroic Public Speaking" }],
      languages: ["English", "Tamil", "Hindi"],
      completedTrainings: 211,
    },
    {
      id: "tr-neha",
      name: "Neha Pillai",
      headline: "Kubernetes and platform engineering — workshops that build muscle",
      mainSkill: "Kubernetes",
      subSkills: ["DevOps", "AWS", "Cybersecurity", "Python"],
      experienceYears: 12,
      location: "Chennai, IN",
      remote: true,
      rating: "4.74",
      reviewCount: 19,
      hourlyRate: 8200,
      verified: false,
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Neha",
      availability: "Quarterly cohorts",
      bio: "Hands-on platform engineer. My workshops are 80% terminal, 20% slides. Teams leave able to ship to production, not just pass an exam.",
      certifications: [{ name: "CKA" }, { name: "CKAD" }, { name: "AWS DevOps Pro" }],
      languages: ["English", "Tamil", "Malayalam"],
      completedTrainings: 29,
    },
    {
      id: "tr-isaac",
      name: "Isaac Thomas",
      headline: "B2B sales coach — pipeline discipline for technical founders",
      mainSkill: "B2B Selling",
      subSkills: ["Account Management", "Negotiation", "Communication", "Storytelling"],
      experienceYears: 17,
      location: "Kochi, IN",
      remote: true,
      rating: "4.69",
      reviewCount: 22,
      hourlyRate: 9000,
      verified: true,
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Isaac",
      availability: "Bi-weekly",
      bio: "Took two SaaS companies from $0 to $10M ARR. I coach founders and AEs on the unglamorous fundamentals: discovery, MEDDIC, multi-threading, and forecast hygiene.",
      certifications: [{ name: "MEDDIC Academy" }, { name: "Sandler Trained" }],
      languages: ["English", "Malayalam", "Hindi"],
      completedTrainings: 34,
    },
  ];
  await db.insert(trainersTable).values(trainers);

  // Demo users
  const users = [
    {
      id: "user-vendor",
      role: "vendor",
      name: "Aarav Mehta",
      email: "ld@northwind.example",
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Aarav",
      vendorId: "ven-northwind",
      trainerId: null,
    },
    {
      id: "user-trainer",
      role: "trainer",
      name: "Priya Sharma",
      email: "priya@example.com",
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Priya",
      vendorId: null,
      trainerId: "tr-priya",
    },
    {
      id: "user-admin",
      role: "admin",
      name: "Trainers Hive Admin",
      email: "admin@trainershive.example",
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Admin",
      vendorId: null,
      trainerId: null,
    },
  ];
  await db.insert(usersTable).values(users);
  await db.insert(sessionStateTable).values({
    id: "default",
    activeUserId: "user-vendor",
  });

  const requirements = [
    {
      id: "req-llm-northwind",
      vendorId: "ven-northwind",
      title: "Production LLM workshop for senior platform engineers",
      skill: "LLM Engineering",
      subSkills: ["Python", "AWS", "Machine Learning"],
      durationDays: 3,
      budget: 350000,
      feeType: "negotiable",
      location: "Bengaluru, IN",
      remote: false,
      deadline: daysFromNow(18),
      status: "open",
      description:
        "We are rolling out internal copilots across 6 product teams in Q3. We need a 3-day, intensive, on-site workshop for ~20 senior engineers covering retrieval design, evaluation harnesses, guardrails, observability, and the practical economics of inference. Past trainers welcome to skip generic LLM 101 — our team is already shipping.",
      createdAt: daysAgo(2),
    },
    {
      id: "req-leadership-northwind",
      vendorId: "ven-northwind",
      title: "First-time manager cohort for promoted IC engineers",
      skill: "First-Time Manager",
      subSkills: ["Leadership & Management", "Communication", "Conflict Resolution"],
      durationDays: 6,
      budget: 480000,
      feeType: "fixed",
      location: "Bengaluru, IN",
      remote: true,
      deadline: daysFromNow(34),
      status: "open",
      description:
        "Cohort of 14 newly promoted engineering managers. We want a six-week, half-day-per-week format with assignments between sessions. Focus areas: 1:1 mechanics, performance conversations, hiring decisions, navigating ambiguity. Would love a coach who can also run optional 1:1 follow-ups.",
      createdAt: daysAgo(5),
    },
    {
      id: "req-helix-stats",
      vendorId: "ven-helix",
      title: "Statistical methods for clinical data scientists",
      skill: "Statistics",
      subSkills: ["Python", "Data Science", "Business Analytics"],
      durationDays: 5,
      budget: 425000,
      feeType: "negotiable",
      location: "Hyderabad, IN",
      remote: false,
      deadline: daysFromNow(28),
      status: "open",
      description:
        "Our clinical data team has grown from 4 to 16 in the past year — many from non-statistics backgrounds. We need a senior trainer who can run a focused 5-day intensive on the statistics that actually matter for clinical trial analysis. GxP awareness preferred.",
      createdAt: daysAgo(3),
    },
    {
      id: "req-svgi-bootcamp",
      vendorId: "ven-svgi",
      title: "Industry-readiness bootcamp for final-year engineering students",
      skill: "Communication",
      subSkills: ["Public Speaking", "Storytelling", "Storytelling"],
      durationDays: 10,
      budget: 280000,
      feeType: "fixed",
      location: "Tirupati, IN",
      remote: false,
      deadline: daysFromNow(45),
      status: "open",
      description:
        "Annual placement-prep bootcamp for ~120 final-year students across CS, EEE, and ME branches. Two weeks, full-day. Need a trainer who can hold a large room and balance hard skills (interview prep, problem framing) with soft skills (communication, professional presence).",
      createdAt: daysAgo(1),
    },
    {
      id: "req-arcus-modeling",
      vendorId: "ven-arcus",
      title: "Analyst class: financial modeling intensive",
      skill: "Financial Modeling",
      subSkills: ["Investment Analysis", "Corporate Finance"],
      durationDays: 8,
      budget: 600000,
      feeType: "fixed",
      location: "Mumbai, IN",
      remote: false,
      deadline: daysFromNow(22),
      status: "open",
      description:
        "On-site 8-day intensive for our incoming analyst class of 18. Three-statement modeling, LBO, DCF, M&A modeling. Must include daily case work and end-of-program model defense. Looking for someone with real deal experience, not pure academic.",
      createdAt: daysAgo(7),
    },
    {
      id: "req-bluereef-curriculum",
      vendorId: "ven-bluereef",
      title: "Lead trainer for cohort-based data engineering program",
      skill: "Data Engineering",
      subSkills: ["Python", "SQL", "AWS"],
      durationDays: 60,
      budget: 1800000,
      feeType: "negotiable",
      location: "Remote",
      remote: true,
      deadline: daysFromNow(40),
      status: "open",
      description:
        "We're launching a flagship 12-week cohort program in August. Looking for a senior trainer to lead live sessions twice weekly, mentor a TA pool, and co-design the capstone. This is a long-term partnership, not a one-off engagement.",
      createdAt: daysAgo(4),
    },
    {
      id: "req-bluereef-instructor",
      vendorId: "ven-bluereef",
      title: "Power BI instructor for evening upskilling cohort",
      skill: "Power BI",
      subSkills: ["SQL", "Business Analytics", "Storytelling"],
      durationDays: 24,
      budget: 380000,
      feeType: "fixed",
      location: "Remote",
      remote: true,
      deadline: daysFromNow(12),
      status: "open",
      description:
        "Evening cohort, 8 weeks, 3 sessions per week. Mid-career professionals, ~30 per cohort. Need someone hands-on who can stay an extra 30 minutes for clinic time most sessions.",
      createdAt: daysAgo(6),
    },
    {
      id: "req-helix-security",
      vendorId: "ven-helix",
      title: "Application security workshop for backend engineers",
      skill: "Cybersecurity",
      subSkills: ["AWS", "DevOps", "ISO 27001"],
      durationDays: 4,
      budget: 320000,
      feeType: "negotiable",
      location: "Hyderabad, IN",
      remote: false,
      deadline: daysFromNow(26),
      status: "open",
      description:
        "Hands-on 4-day workshop on application and cloud security for ~25 backend engineers. Live exercises strongly preferred. Should cover modern threats — supply chain, secrets management, IAM least-privilege, SSRF/SQLi modern variants.",
      createdAt: daysAgo(8),
    },
    {
      id: "req-northwind-public-speaking",
      vendorId: "ven-northwind",
      title: "Executive presence and public speaking — director cohort",
      skill: "Public Speaking",
      subSkills: ["Communication", "Storytelling", "Emotional Intelligence"],
      durationDays: 5,
      budget: 550000,
      feeType: "fixed",
      location: "Bengaluru, IN",
      remote: false,
      deadline: daysFromNow(50),
      status: "vacant",
      description:
        "Premium engagement for our director-level talent. 5 sessions across 8 weeks, with individual coaching slots between. We previously ran this with a coach who is no longer available; would love a strong replacement.",
      createdAt: daysAgo(11),
    },
    {
      id: "req-arcus-comms-closed",
      vendorId: "ven-arcus",
      title: "Client communication and pitch coaching — VP cohort",
      skill: "Communication",
      subSkills: ["Public Speaking", "Storytelling", "Negotiation"],
      durationDays: 4,
      budget: 410000,
      feeType: "fixed",
      location: "Mumbai, IN",
      remote: false,
      deadline: daysAgo(2),
      status: "closed",
      description:
        "Engagement complete — leaving here as historical reference for the marketplace.",
      createdAt: daysAgo(40),
    },
  ];
  await db.insert(requirementsTable).values(requirements);

  const applications = [
    {
      id: "app-1",
      requirementId: "req-llm-northwind",
      trainerId: "tr-priya",
      status: "shortlisted",
      message:
        "I have run this exact format four times in the last year — most recently for a 30-engineer team at a fintech in Bengaluru. Happy to share the syllabus and references.",
      proposedRate: 320000,
      createdAt: daysAgo(1),
    },
    {
      id: "app-2",
      requirementId: "req-llm-northwind",
      trainerId: "tr-fatima",
      status: "submitted",
      message:
        "I can co-deliver the security and observability portions if you want a deeper guardrails focus. Available the proposed week.",
      proposedRate: 280000,
      createdAt: daysAgo(0),
    },
    {
      id: "app-3",
      requirementId: "req-leadership-northwind",
      trainerId: "tr-arjun",
      status: "submitted",
      message:
        "I have run this six-week format for two engineering orgs already. The optional 1:1 follow-ups dramatically change retention — happy to scope those in.",
      proposedRate: 460000,
      createdAt: daysAgo(2),
    },
    {
      id: "app-4",
      requirementId: "req-arcus-modeling",
      trainerId: "tr-rohan",
      status: "hired",
      message:
        "Have delivered this exact program at two boutique IBs and one PE shop in the last 18 months. References on request.",
      proposedRate: 580000,
      createdAt: daysAgo(5),
    },
    {
      id: "app-5",
      requirementId: "req-bluereef-instructor",
      trainerId: "tr-aisha",
      status: "shortlisted",
      message:
        "Evening slot works perfectly. I already run a similar weekly clinic format and would happily extend it to your cohort.",
      proposedRate: 360000,
      createdAt: daysAgo(3),
    },
    {
      id: "app-6",
      requirementId: "req-helix-security",
      trainerId: "tr-fatima",
      status: "submitted",
      message:
        "Strong fit. Can structure days 1-2 around offensive labs, days 3-4 around defense and platform hardening for AWS workloads.",
      proposedRate: 300000,
      createdAt: daysAgo(4),
    },
    {
      id: "app-7",
      requirementId: "req-northwind-public-speaking",
      trainerId: "tr-vikram",
      status: "shortlisted",
      message:
        "I have worked with director-level cohorts at three large enterprises. Happy to keep the format from your previous coach if helpful.",
      proposedRate: 540000,
      createdAt: daysAgo(8),
    },
    {
      id: "app-8",
      requirementId: "req-svgi-bootcamp",
      trainerId: "tr-vikram",
      status: "submitted",
      message:
        "I have run large-room placement bootcamps before — the hardest part is keeping engagement across 120 students. I have a format that works.",
      proposedRate: 260000,
      createdAt: daysAgo(0),
    },
    {
      id: "app-9",
      requirementId: "req-bluereef-curriculum",
      trainerId: "tr-neha",
      status: "submitted",
      message:
        "Interested. I can lead the platform engineering modules and co-design the capstone with your team.",
      proposedRate: 1700000,
      createdAt: daysAgo(2),
    },
    {
      id: "app-10",
      requirementId: "req-helix-stats",
      trainerId: "tr-priya",
      status: "submitted",
      message:
        "Strong overlap with my background. I can bring two case studies from clinical-adjacent ML projects to anchor the content.",
      proposedRate: 410000,
      createdAt: daysAgo(1),
    },
  ];
  await db.insert(applicationsTable).values(applications);

  const reviews = [
    {
      id: "rev-1",
      trainerId: "tr-priya",
      vendorId: "ven-bluereef",
      rating: 5,
      comment:
        "Priya delivered our flagship LLM cohort. Clear, deeply technical, and pragmatic about what works in production. Already booked her for our next cohort.",
      engagementTitle: "LLM cohort program",
      createdAt: daysAgo(45),
    },
    {
      id: "rev-2",
      trainerId: "tr-priya",
      vendorId: "ven-helix",
      rating: 5,
      comment:
        "Best workshop our engineering team has done in years. Hands-on from minute one.",
      engagementTitle: "AI for clinical engineering",
      createdAt: daysAgo(82),
    },
    {
      id: "rev-3",
      trainerId: "tr-arjun",
      vendorId: "ven-northwind",
      rating: 5,
      comment:
        "Arjun has the rare ability to coach engineers without sounding like a management consultant. Our new managers actually use what he taught.",
      engagementTitle: "First-time manager cohort",
      createdAt: daysAgo(60),
    },
    {
      id: "rev-4",
      trainerId: "tr-rohan",
      vendorId: "ven-arcus",
      rating: 5,
      comment:
        "Our analyst class came out of Rohan's bootcamp able to defend their own DCFs in client meetings. Money well spent.",
      engagementTitle: "Analyst onboarding modeling",
      createdAt: daysAgo(120),
    },
    {
      id: "rev-5",
      trainerId: "tr-vikram",
      vendorId: "ven-arcus",
      rating: 5,
      comment:
        "Vikram coached our VPs through pitch prep for our largest mandate of the year. We won the deal.",
      engagementTitle: "VP pitch coaching",
      createdAt: daysAgo(30),
    },
    {
      id: "rev-6",
      trainerId: "tr-aisha",
      vendorId: "ven-bluereef",
      rating: 4,
      comment:
        "Practical and warm. Cohort feedback was overwhelmingly positive. A few sessions ran a bit short on advanced material — would extend the program slightly next time.",
      engagementTitle: "Power BI evening cohort",
      createdAt: daysAgo(70),
    },
    {
      id: "rev-7",
      trainerId: "tr-fatima",
      vendorId: "ven-helix",
      rating: 5,
      comment:
        "Genuine practitioner energy. The live attack labs were a wake-up call for the team in the best way.",
      engagementTitle: "AppSec workshop",
      createdAt: daysAgo(95),
    },
  ];
  await db.insert(reviewsTable).values(reviews);

  // Activity feed
  const activity = [
    {
      id: "act-1",
      type: "requirement",
      title: "Northwind Corp posted a new requirement",
      subtitle: "Production LLM workshop for senior platform engineers",
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Northwind&backgroundColor=1f2a44",
      createdAt: daysAgo(2),
    },
    {
      id: "act-2",
      type: "application",
      title: "Priya Sharma applied to a requirement",
      subtitle: "Production LLM workshop for senior platform engineers",
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Priya",
      createdAt: daysAgo(1),
    },
    {
      id: "act-3",
      type: "hire",
      title: "Rohan D'Souza was hired by Arcus Capital",
      subtitle: "Analyst class: financial modeling intensive",
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Rohan",
      createdAt: daysAgo(5),
    },
    {
      id: "act-4",
      type: "review",
      title: "Helix Biotech reviewed Fatima Khan",
      subtitle: "5/5 stars — AppSec workshop",
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Helix&backgroundColor=0f766e",
      createdAt: daysAgo(95),
    },
    {
      id: "act-5",
      type: "application",
      title: "Vikram Iyer was shortlisted",
      subtitle: "Executive presence — director cohort",
      avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Vikram",
      createdAt: daysAgo(7),
    },
    {
      id: "act-6",
      type: "requirement",
      title: "BlueReef Learning posted a new requirement",
      subtitle: "Lead trainer for cohort-based data engineering program",
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=BlueReef&backgroundColor=1e3a8a",
      createdAt: daysAgo(4),
    },
    {
      id: "act-7",
      type: "review",
      title: "BlueReef reviewed Priya Sharma",
      subtitle: "5/5 stars — LLM cohort program",
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=BlueReef&backgroundColor=1e3a8a",
      createdAt: daysAgo(45),
    },
  ];
  await db.insert(activityTable).values(activity);

  console.log("Seed complete");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
