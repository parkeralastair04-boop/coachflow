import { DemoFeatureDiscovery } from "@/components/demo-feature-discovery";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_BOOKINGS } from "@/lib/demo/data";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export default function DemoBookingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className={TYPE.pageTitle}>Parent Bookings</h1>
        <p className={cn(TYPE.description, "mt-1")}>
          Upcoming, completed, cancelled, and waitlist examples.
        </p>
      </div>
      <DemoFeatureDiscovery page="bookings" />
      <div className="space-y-3">
        {DEMO_BOOKINGS.map((booking) => (
          <Card key={booking.id}>
            <CardHeader className="mb-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">{booking.childName}</CardTitle>
                <CardDescription>{booking.session}</CardDescription>
              </div>
              <p className="text-sm font-medium capitalize">
                {booking.status} · {booking.when}
              </p>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
