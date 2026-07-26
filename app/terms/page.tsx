import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";

export const metadata: Metadata = {
  title: "Terms of Service | Awarix",
  description:
    "Terms governing use of Awarix by coaches, academies, and parents booking football training sessions.",
};

const termsSections = [
  {
    id: "accounts",
    title: "Accounts",
    paragraphs: [
      "Coaches and academy staff must provide accurate account information and keep login details secure. You are responsible for activity under your account.",
      "Parents do not need an Awarix account to book sessions through a coach's public booking page.",
    ],
  },
  {
    id: "bookings",
    title: "Bookings",
    paragraphs: [
      "Public booking pages allow parents to reserve places on sessions published by coaches. Availability, pricing, and session details are set by the coach or academy operating the booking page.",
      "A booking is confirmed according to the status shown at checkout or in confirmation communications. Waitlist places do not guarantee a session place until confirmed by the coach.",
    ],
  },
  {
    id: "payments",
    title: "Payments",
    paragraphs: [
      "Paid sessions and subscriptions are processed through Stripe. Coaches set prices for their sessions and packages. Refunds and payment disputes are handled according to the coach's policies and applicable payment provider rules.",
    ],
  },
  {
    id: "subscriptions",
    title: "Subscriptions",
    paragraphs: [
      "Some coaches offer weekly training packages with recurring parent payments. Subscription terms, including price and schedule, are shown before checkout. Parents should contact their coach with questions about changes, cancellations, or billing.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    paragraphs: [
      "You agree to use Awarix lawfully and respectfully. Do not misuse the platform, attempt unauthorised access, submit false information, or use the service in a way that harms coaches, parents, children, or other users.",
      "We may suspend or restrict access where use violates these terms or creates risk to the service or its users.",
    ],
  },
  {
    id: "limitation-of-liability",
    title: "Limitation of liability",
    paragraphs: [
      "Awarix provides software tools for coaches to manage sessions, bookings, and payments. Coaches remain responsible for their coaching services, safeguarding practices, and communications with parents.",
      "To the extent permitted by law, Awarix is not liable for indirect losses arising from use of the platform. Nothing in these terms limits rights that cannot be excluded under applicable law.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "For questions about these terms, please contact us using the details at the bottom of this page.",
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <LegalDocumentPage
      title="Terms of Service"
      intro="These terms govern use of Awarix by coaches, academies, and parents. By creating an account or using the service, you agree to these terms."
      sections={[...termsSections]}
    />
  );
}
