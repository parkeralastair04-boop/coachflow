"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, Loader2, Users } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

type ServiceType = "1-to-1" | "group" | "camp";

type Service = {
  id: ServiceType;
  name: string;
  price: string;
  availability: string;
  description: string;
};

type BookingResponse = {
  bookingId?: string | null;
  checkoutUrl?: string | null;
  error?: string;
};

const services: Service[] = [
  {
    id: "1-to-1",
    name: "1-to-1 Coaching",
    price: "£45 / session",
    availability: "4 weekly spaces",
    description: "Personal technical coaching with individual feedback and next steps.",
  },
  {
    id: "group",
    name: "Group Sessions",
    price: "£15 / session",
    availability: "12 weekly spaces",
    description: "High-energy development sessions for players grouped by age and level.",
  },
  {
    id: "camp",
    name: "Holiday Camps",
    price: "From £120",
    availability: "Limited camp places",
    description: "Multi-day football camps with skills, games, and confidence-building.",
  },
];

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An unexpected error occurred.";
}

export function BookingPortal() {
  const [selectedService, setSelectedService] = useState<ServiceType>("1-to-1");
  const [childName, setChildName] = useState("");
  const [childDateOfBirth, setChildDateOfBirth] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [redirectToCheckout, setRedirectToCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeService = useMemo(
    () => services.find((service) => service.id === selectedService) ?? services[0],
    [selectedService],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName,
          childDateOfBirth,
          parentName,
          parentEmail,
          parentPhone,
          serviceType: selectedService,
          notes,
          redirectToCheckout,
        }),
      });
      const payload = (await response.json()) as BookingResponse;
      if (!response.ok) {
        setError(payload.error ?? "Could not submit booking.");
        return;
      }

      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      setSuccess("Booking request sent. Please check your email for confirmation.");
      setChildName("");
      setChildDateOfBirth("");
      setParentName("");
      setParentEmail("");
      setParentPhone("");
      setNotes("");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/[0.06] px-4 py-5 dark:border-white/[0.08] sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <BrandLogo className="h-16" priority />
          <a
            href="#booking-form"
            className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
          >
            Book now
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="mesh-gradient border-b border-black/[0.06] px-4 py-16 dark:border-white/[0.08] sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-accent mb-4 text-sm font-medium tracking-wide uppercase">
                CoachFlow Booking Portal
              </p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Book football coaching that fits your child.
              </h1>
              <p className="text-muted mt-6 max-w-xl text-lg leading-relaxed">
                Choose 1-to-1 coaching, group sessions, or holiday camps. Submit your
                child and parent details, then receive confirmation by email.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#services"
                  className="border-border hover:bg-black/[0.03] inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
                >
                  View services
                </a>
                <a
                  href="#booking-form"
                  className="bg-accent text-white hover:opacity-90 inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-medium transition-opacity"
                >
                  Start booking
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </a>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <CalendarCheck className="text-accent size-10" aria-hidden />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                Simple parent booking
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                Your request is saved as a pending booking. The coaching team can
                review the player record, confirm availability, and follow up with
                payments from CoachFlow.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                  <dt className="text-muted">Services</dt>
                  <dd className="mt-1 text-xl font-semibold">3</dd>
                </div>
                <div className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                  <dt className="text-muted">Confirmation</dt>
                  <dd className="mt-1 text-xl font-semibold">Email</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section id="services" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Coaching services
              </h2>
              <p className="text-muted mt-3 text-base leading-relaxed">
                Select the best fit now. We will confirm exact availability before
                anything is final.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {services.map((service) => (
                <article
                  key={service.id}
                  className={cn(
                    "glass-panel flex flex-col rounded-2xl p-6 transition-colors",
                    selectedService === service.id && "ring-accent/30 ring-2",
                  )}
                >
                  <Users className="text-accent size-7" aria-hidden />
                  <h3 className="mt-4 text-lg font-semibold">{service.name}</h3>
                  <p className="text-muted mt-2 flex-1 text-sm leading-relaxed">
                    {service.description}
                  </p>
                  <div className="mt-5 space-y-1 text-sm">
                    <p className="font-medium">{service.price}</p>
                    <p className="text-muted">{service.availability}</p>
                  </div>
                  <a
                    href="#booking-form"
                    onClick={() => setSelectedService(service.id)}
                    className="bg-foreground text-background hover:opacity-90 mt-6 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
                  >
                    Book {service.name}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="booking-form" className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="glass-panel mx-auto max-w-3xl rounded-3xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              Request a booking
            </h2>
            <p className="text-muted mt-2 text-sm">
              Current selection:{" "}
              <span className="text-foreground font-medium">{activeService.name}</span>{" "}
              ({activeService.price})
            </p>

            <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="service">
                  Service
                </label>
                <select
                  id="service"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value as ServiceType)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="childName">
                  Child name
                </label>
                <input
                  id="childName"
                  required
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="dob">
                  Child date of birth
                </label>
                <input
                  id="dob"
                  type="date"
                  value={childDateOfBirth}
                  onChange={(e) => setChildDateOfBirth(e.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="parentName">
                  Parent name
                </label>
                <input
                  id="parentName"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="parentEmail">
                  Parent email
                </label>
                <input
                  id="parentEmail"
                  type="email"
                  required
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="parentPhone">
                  Parent phone
                </label>
                <input
                  id="parentPhone"
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
                  placeholder="Goals, availability, medical notes, or preferred dates..."
                />
              </div>

              <label className="sm:col-span-2 flex items-start gap-3 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                <input
                  type="checkbox"
                  checked={redirectToCheckout}
                  onChange={(e) => setRedirectToCheckout(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Redirect to Stripe Checkout after submission if online payment is
                  available.
                </span>
              </label>

              {error ? (
                <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="sm:col-span-2 text-sm text-accent">{success}</p>
              ) : null}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-accent text-white hover:opacity-90 inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Submitting...
                    </>
                  ) : (
                    "Submit booking request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
