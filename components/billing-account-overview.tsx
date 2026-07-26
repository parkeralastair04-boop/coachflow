import type { ReactNode } from "react";
import Link from "next/link";
import { ManageBillingButton } from "@/components/manage-billing-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableEmpty,
} from "@/components/ui/table";
import type { BillingAccountDetails } from "@/lib/billing-account-details";
import { formatUkLongDate } from "@/lib/trial";

function StatusBadge({ label }: { label: string }) {
  const trial = label.toLowerCase().includes("trial");
  const active = label === "Active" || label === "Complimentary";
  const warning = label === "Past due";

  return (
    <span
      className={
        trial
          ? "bg-accent/15 text-accent ring-accent/30 inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1"
          : active
            ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300 inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1"
            : warning
              ? "bg-amber-500/12 text-amber-800 ring-amber-500/25 dark:text-amber-200 inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1"
              : "bg-black/[0.04] text-muted ring-black/[0.06] dark:bg-white/[0.06] dark:ring-white/[0.08] inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1"
      }
    >
      {label}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted text-xs font-medium uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function BillingAccountOverview({
  details,
}: {
  details: BillingAccountDetails;
}) {
  const {
    hasComplimentaryAccess,
    planName,
    statusLabel,
    isTrial,
    trialEndsAt,
    daysRemaining,
    renewalDate,
    monthlyPounds,
    paymentMethod,
    invoices,
    canManageInPortal,
  } = details;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>Current plan</CardTitle>
            <StatusBadge label={statusLabel} />
          </div>
          <CardDescription>
            Your Awarix subscription and trial status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasComplimentaryAccess ? (
            <div className="space-y-2">
              <p className="text-base font-semibold">Academy · Complimentary</p>
              <p className="text-muted text-sm leading-relaxed">
                Your account includes complimentary Academy access. No Stripe
                subscription is required.
              </p>
            </div>
          ) : planName ? (
            <div className="space-y-4">
              <p className="text-base font-semibold">{planName}</p>
              {isTrial && trialEndsAt ? (
                <p className="text-muted text-sm leading-relaxed">
                  {daysRemaining === 1
                    ? "1 day left in your free trial."
                    : `${daysRemaining ?? 0} days left in your free trial.`}{" "}
                  Billing starts on {formatUkLongDate(trialEndsAt)} unless you
                  cancel in the Stripe portal.
                </p>
              ) : (
                <p className="text-muted text-sm leading-relaxed">
                  {monthlyPounds != null
                    ? `£${monthlyPounds}/month.`
                    : "Active subscription."}{" "}
                  Update payment details or cancel anytime in the Stripe billing
                  portal.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-base font-semibold">No paid subscription yet</p>
              <p className="text-muted text-sm leading-relaxed">
                Start a 7-day free trial from pricing — no payment today.
              </p>
              <Link
                href="/pricing"
                className="text-accent inline-flex text-sm font-medium underline-offset-4 hover:underline"
              >
                View plans & start free trial
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {!hasComplimentaryAccess && planName ? (
        <Card>
          <CardHeader>
            <CardTitle>Subscription details</CardTitle>
            <CardDescription>
              Renewal and payment information from Stripe when available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailRow label="Trial" value={isTrial ? "Active" : "Not on trial"} />
              {isTrial && trialEndsAt ? (
                <DetailRow
                  label="Trial ends"
                  value={formatUkLongDate(trialEndsAt)}
                />
              ) : null}
              {renewalDate ? (
                <DetailRow
                  label={isTrial ? "First renewal" : "Renewal date"}
                  value={formatUkLongDate(renewalDate)}
                />
              ) : (
                <DetailRow label="Renewal date" value="—" />
              )}
              {monthlyPounds != null ? (
                <DetailRow label="Amount" value={`£${monthlyPounds}/month`} />
              ) : null}
              <DetailRow
                label="Payment method"
                value={
                  paymentMethod
                    ? `${paymentMethod.brand} ···· ${paymentMethod.last4} (exp ${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear})`
                    : "Not on file — add one in the billing portal"
                }
              />
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {canManageInPortal ? (
        <Card variant="interactive">
          <CardHeader>
            <CardTitle>Manage subscription</CardTitle>
            <CardDescription>
              Open the secure Stripe billing portal to update your payment method,
              view invoices, change plan, or cancel before your trial ends.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <ManageBillingButton
              label="Manage plan"
              size="lg"
              variant="accent"
              className="w-full sm:w-auto"
            />
            <p className="text-muted text-xs leading-relaxed sm:max-w-md">
              Cancellation and card changes are handled by Stripe. You will return
              here after making changes.
            </p>
          </CardFooter>
        </Card>
      ) : null}

      {canManageInPortal ? (
        <Card>
          <CardHeader>
            <CardTitle>Invoice history</CardTitle>
            <CardDescription>
              Recent Awarix subscription invoices from Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.length > 0 ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Invoice</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.number ?? invoice.id.slice(-8)}</TableCell>
                      <TableCell>{formatUkLongDate(invoice.date)}</TableCell>
                      <TableCell>{invoice.amountLabel}</TableCell>
                      <TableCell className="capitalize">
                        {invoice.status?.replaceAll("_", " ") ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.hostedUrl ? (
                          <a
                            href={invoice.hostedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent text-sm font-medium underline-offset-4 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableBody>
                  <TableEmpty colSpan={5}>
                    No invoices yet. They will appear here after your first billing
                    cycle.
                  </TableEmpty>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!hasComplimentaryAccess ? (
        <Card variant="muted">
          <CardHeader>
            <CardTitle>Need a plan change?</CardTitle>
            <CardDescription>
              Compare plans or start checkout from pricing. Existing subscribers
              manage changes in the Stripe portal.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-0">
            <Link
              href="/pricing"
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity"
            >
              View pricing
            </Link>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}
