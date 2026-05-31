import PDFDocument from "pdfkit";
import type { EngagementAgreement } from "@workspace/db";

type AgreementWithMeta = EngagementAgreement & {
  vendorName: string;
  vendorContactName?: string | null;
  vendorEmail?: string | null;
  trainerName: string;
  trainerEmail?: string | null;
  requirementTitle: string;
  requirementSkill?: string | null;
};

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return (
    d.toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    }) + " IST"
  );
}

function fmtMoney(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return "To be discussed";
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  return `${currency} ${amount.toLocaleString("en-IN")}`;
}

export async function renderAgreementPdf(
  agreement: AgreementWithMeta,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc
      .fillColor("#0f766e")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Trainers Hive", { align: "left" });
    doc
      .fillColor("#6b7280")
      .fontSize(9)
      .font("Helvetica")
      .text("Engagement Agreement", { align: "left" });
    doc
      .fillColor("#9ca3af")
      .fontSize(8)
      .text(
        `Reference: ${agreement.id}   ·   Generated ${fmtDateTime(new Date())}`,
        { align: "left" },
      );
    doc.moveDown(1);

    // Status badge
    const statusLabel = agreement.status.replace("_", " ").toUpperCase();
    doc
      .fillColor("#0f766e")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(`Status: ${statusLabel}`);
    doc.moveDown(0.5);

    // Parties block
    doc
      .fillColor("#111827")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Parties");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#374151");
    doc.text(`Client / Vendor: ${agreement.vendorName}`);
    if (agreement.vendorContactName) {
      doc.text(`Contact: ${agreement.vendorContactName}`);
    }
    if (agreement.vendorEmail) doc.text(`Email: ${agreement.vendorEmail}`);
    doc.moveDown(0.3);
    doc.text(`Trainer: ${agreement.trainerName}`);
    if (agreement.trainerEmail) doc.text(`Email: ${agreement.trainerEmail}`);
    doc.moveDown(0.8);

    // Engagement
    doc
      .fillColor("#111827")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Engagement");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#374151");
    doc.text(`Requirement: ${agreement.requirementTitle}`);
    if (agreement.requirementSkill) {
      doc.text(`Primary skill: ${agreement.requirementSkill}`);
    }
    doc.text(`Start date: ${fmtDate(agreement.startDate)}`);
    doc.text(`End date: ${fmtDate(agreement.endDate)}`);
    if (agreement.sessionsCount) {
      doc.text(`Sessions / days: ${agreement.sessionsCount}`);
    }
    if (agreement.locationOrMode) {
      doc.text(`Location / mode: ${agreement.locationOrMode}`);
    }
    if (agreement.deliverables) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text("Deliverables:");
      doc.font("Helvetica").text(agreement.deliverables, { align: "justify" });
    }
    doc.moveDown(0.8);

    // Commercials
    doc
      .fillColor("#111827")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Commercial Terms");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#374151");
    doc.text(
      `Agreed professional fee: ${fmtMoney(agreement.agreedFee, agreement.feeCurrency)}`,
    );
    if (agreement.paymentSchedule) {
      doc.text(`Payment schedule: ${agreement.paymentSchedule}`);
    }
    if (agreement.travelBoarding) {
      doc.text(`Travel & boarding: ${agreement.travelBoarding}`);
    }
    if (agreement.cancellationNotice) {
      doc.text(`Cancellation notice: ${agreement.cancellationNotice}`);
    }
    doc.moveDown(0.8);

    // Legal clauses
    doc
      .fillColor("#111827")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Legal");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#374151");
    doc.text(
      `Confidentiality: ${agreement.confidentialityClause ? "Both parties agree to keep all materials, learner data and engagement details strictly confidential." : "Not applicable."}`,
      { align: "justify" },
    );
    if (agreement.ipOwnership) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text("IP Ownership:");
      doc.font("Helvetica").text(agreement.ipOwnership, { align: "justify" });
    }
    doc.moveDown(0.3);
    doc.text(
      `Governing law and jurisdiction: courts of ${agreement.governingLawCity}, India.`,
    );
    if (agreement.specialClauses) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text("Special clauses:");
      doc.font("Helvetica").text(agreement.specialClauses, { align: "justify" });
    }
    doc.moveDown(0.8);

    // Signatures
    doc
      .fillColor("#111827")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Electronic Acceptance");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#374151");
    doc.text("This agreement was accepted electronically by both parties:");
    doc.moveDown(0.4);

    doc.font("Helvetica-Bold").text(`Vendor: ${agreement.vendorName}`);
    doc.font("Helvetica");
    doc.text(`  Accepted at: ${fmtDateTime(agreement.vendorAcceptedAt)}`);
    if (agreement.vendorAcceptedIp) {
      doc.text(`  IP address: ${agreement.vendorAcceptedIp}`);
    }
    if (agreement.vendorUserId) {
      doc.text(`  User ID: ${agreement.vendorUserId}`);
    }
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text(`Trainer: ${agreement.trainerName}`);
    doc.font("Helvetica");
    doc.text(`  Accepted at: ${fmtDateTime(agreement.trainerAcceptedAt)}`);
    if (agreement.trainerAcceptedIp) {
      doc.text(`  IP address: ${agreement.trainerAcceptedIp}`);
    }
    if (agreement.trainerUserId) {
      doc.text(`  User ID: ${agreement.trainerUserId}`);
    }
    doc.moveDown(0.8);

    // Disclaimer / Section 65B-style audit footer
    doc
      .fillColor("#6b7280")
      .fontSize(8)
      .font("Helvetica-Oblique")
      .text(
        "Trainers Hive (the platform) acts solely as a facilitator that connects vendors and trainers. " +
          "Trainers Hive is not a party to this agreement and accepts no liability for the performance, payment or " +
          "non-performance of either party. Both parties confirm that they have read and understood the above terms " +
          "and that their click-wrap acceptance constitutes a valid contract under the Indian Contract Act, 1872 and " +
          "an electronic record under the Information Technology Act, 2000. The audit metadata above (timestamps, IP " +
          "addresses, user identifiers) is generated and retained by the platform's automated systems and is admissible " +
          "as evidence under Section 65B of the Indian Evidence Act, 1872. For high-value engagements both parties are " +
          "advised to obtain independent legal review before acceptance.",
        { align: "justify" },
      );

    doc.end();
  });
}
