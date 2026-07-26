import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Awarix",
  description:
    "How Awarix collects, uses, and protects information for coaches, parents, and children using the platform.",
};

const privacySections = [
  {
    id: "information-we-collect",
    title: "Information we collect",
    paragraphs: [
      "Awarix collects information needed to run coaching businesses online. This includes account details for coaches, parent contact information, child names and session details submitted through booking forms, and payment-related records processed through our payment partners.",
      "We also collect technical information such as device type, browser, and usage data to keep the service secure and reliable.",
    ],
  },
  {
    id: "how-information-is-used",
    title: "How information is used",
    paragraphs: [
      "Information is used to manage coaching sessions, communicate with parents, process bookings and payments, and provide support to coaches and families.",
      "We do not sell personal information. Data is shared only where needed to deliver the service, such as with payment processors, email delivery providers, and infrastructure partners that help us operate Awarix.",
    ],
  },
  {
    id: "childrens-information",
    title: "Children's information",
    paragraphs: [
      "Awarix is used by coaches to manage training for children. Parents provide child information when booking sessions. Coaches are responsible for collecting only what they need to run sessions safely and for communicating with families appropriately.",
      "Child information submitted through booking forms is shared with the relevant coach and academy to manage attendance, safeguarding notes, and session communication.",
    ],
  },
  {
    id: "payments",
    title: "Payments",
    paragraphs: [
      "Session and subscription payments are processed by Stripe. Awarix does not store full card details. Payment status and billing records are kept so coaches and parents can manage bookings and subscriptions.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "If you have questions about how your information is handled, or if you are a parent requesting access to information held about your child, please contact us using the details at the bottom of this page.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      intro="This policy explains how Awarix handles information for coaches, parents, and children who use the platform. It is intended to be clear and practical — it does not replace formal legal advice."
      sections={[...privacySections]}
    />
  );
}
