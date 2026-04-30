import React from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

const LAST_UPDATED = "1 April 2025";

const SECTIONS = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: `By accessing or using the Trainers Hive platform ("Platform"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you must not use the Platform.

These Terms apply to all users of the Platform, including trainers, vendors, colleges, companies, and visitors ("Users").`,
  },
  {
    id: "eligibility",
    title: "2. Eligibility",
    content: `You must be at least 18 years of age to create an account. By registering, you confirm that the information you provide is accurate, complete, and up to date.

Trainers Hive reserves the right to suspend or terminate accounts that provide false, misleading, or incomplete information.`,
  },
  {
    id: "accounts",
    title: "3. User Accounts",
    content: `You are responsible for maintaining the confidentiality of your account credentials. You must not share your login details with any other person.

You are responsible for all activity that occurs under your account. Trainers Hive will not be liable for any loss or damage arising from unauthorised access to your account.

You must notify us immediately at support@trainershive.com if you suspect any unauthorised use of your account.`,
  },
  {
    id: "platform-use",
    title: "4. Platform Use",
    content: `Trainers Hive provides a marketplace to connect training professionals ("Trainers") with organisations seeking training services ("Vendors"). We do not directly deliver training services.

Trainers may create and maintain a public profile listing their skills, experience, certifications, and availability.

Vendors may post training requirements and invite or contact trainers listed on the Platform.

Any engagement, contract, or financial arrangement entered into between a Trainer and a Vendor is solely between those parties. Trainers Hive is not a party to such arrangements unless expressly stated otherwise.`,
  },
  {
    id: "prohibited",
    title: "5. Prohibited Conduct",
    content: `You must not:

• Post false, misleading, defamatory, or harmful content.
• Impersonate any person or entity.
• Use the Platform to send unsolicited communications (spam).
• Scrape, crawl, or extract data from the Platform without written permission.
• Attempt to interfere with the Platform's infrastructure, security, or integrity.
• Use the Platform for any unlawful purpose or in violation of any applicable law.

Violation of these prohibitions may result in immediate account suspension and legal action.`,
  },
  {
    id: "content",
    title: "6. User Content",
    content: `You retain ownership of content you submit to the Platform (such as your trainer profile, certifications, and uploaded materials). By submitting content, you grant Trainers Hive a non-exclusive, royalty-free, worldwide licence to display, reproduce, and distribute that content as part of the Platform's operations.

You represent that you own or have the necessary rights to all content you submit and that such content does not infringe any third-party intellectual property rights.

Trainers Hive reserves the right to remove any content that violates these Terms or is otherwise objectionable, at our sole discretion.`,
  },
  {
    id: "intellectual-property",
    title: "7. Intellectual Property",
    content: `The Trainers Hive name, logo, brand, design, software, and all content created by Trainers Hive are the intellectual property of Trainers Hive and its licensors. You must not use, copy, or reproduce any of these without prior written consent.`,
  },
  {
    id: "privacy",
    title: "8. Privacy",
    content: `Your use of the Platform is also governed by our Privacy Policy, which describes how we collect, use, and share your personal information. By using the Platform, you consent to the data practices described in that policy.

We do not sell your personal data to third parties.`,
  },
  {
    id: "disclaimers",
    title: "9. Disclaimers",
    content: `The Platform is provided on an "as is" and "as available" basis. Trainers Hive makes no warranties, express or implied, regarding the availability, accuracy, or reliability of the Platform.

We do not guarantee that any Trainer listed is licensed, certified, or qualified for any specific engagement, and we strongly recommend that Vendors independently verify credentials before engaging any Trainer.

We are not responsible for any disputes, losses, or damages arising from engagements arranged through the Platform.`,
  },
  {
    id: "limitation",
    title: "10. Limitation of Liability",
    content: `To the fullest extent permitted by applicable law, Trainers Hive and its officers, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform.

Our aggregate liability to you for any claim arising out of these Terms shall not exceed the amount you paid to Trainers Hive in the twelve months preceding the claim, or ₹5,000, whichever is greater.`,
  },
  {
    id: "termination",
    title: "11. Termination",
    content: `Trainers Hive may suspend or terminate your access to the Platform at any time, with or without notice, for conduct that we determine violates these Terms, is harmful to other users, or is otherwise inappropriate.

You may close your account at any time by contacting us at support@trainershive.com. Upon termination, your profile and associated data will be removed in accordance with our data retention policy.`,
  },
  {
    id: "changes",
    title: "12. Changes to These Terms",
    content: `We may update these Terms from time to time. When we make material changes, we will notify you via email or a prominent notice on the Platform.

Your continued use of the Platform after changes are posted constitutes your acceptance of the updated Terms. If you do not agree with the revised Terms, you must stop using the Platform.`,
  },
  {
    id: "governing-law",
    title: "13. Governing Law",
    content: `These Terms are governed by the laws of India. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of Delhi, India.`,
  },
  {
    id: "contact",
    title: "14. Contact Us",
    content: `If you have any questions about these Terms, please contact us:

Email: support@trainershive.com
Address: Trainers Hive, New Delhi, India`,
  },
];

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
          <div className="flex flex-col items-center text-center gap-4">
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Legal
            </Badge>
            <div className="flex items-center gap-3">
              <ScrollText className="h-8 w-8 text-primary" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Terms &amp; Conditions</h1>
            </div>
            <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          <aside className="hidden md:block md:col-span-1">
            <nav className="sticky top-24 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sections</p>
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-xs text-muted-foreground hover:text-primary transition-colors py-0.5"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="md:col-span-3 space-y-10">
            <div className="rounded-lg border bg-muted/30 px-5 py-4 text-sm text-muted-foreground leading-relaxed">
              Please read these Terms and Conditions carefully before using the Trainers Hive platform. By creating an account or using our services, you agree to be legally bound by these terms.
            </div>

            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-lg font-semibold mb-3">{s.title}</h2>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {s.content}
                </div>
              </section>
            ))}

            <div className="border-t pt-8 text-xs text-muted-foreground">
              <p>These Terms were last updated on {LAST_UPDATED}. For questions, contact us at <a href="mailto:support@trainershive.com" className="text-primary hover:underline underline-offset-2">support@trainershive.com</a>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
