import type { FootballEmptySceneId } from "@/lib/football-identity";
import { cn } from "@/lib/utils";

type FootballSceneProps = {
  scene: FootballEmptySceneId;
  className?: string;
};

/** Premium line-art coaching scenes — subtle, not cartoon or game-like. */
export function FootballScene({ scene, className }: FootballSceneProps) {
  return (
    <svg
      viewBox="0 0 160 120"
      role="img"
      aria-hidden
      className={cn("h-[5.5rem] w-[7.5rem] text-accent/90", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <PitchBase />
      {scene === "squad" ? <SquadScene /> : null}
      {scene === "pitch" ? <PitchWaitingScene /> : null}
      {scene === "reports" ? <ReportsScene /> : null}
      {scene === "teams" ? <TeamsScene /> : null}
      {scene === "bookings" ? <BookingsScene /> : null}
      {scene === "analytics" ? <AnalyticsScene /> : null}
      {scene === "enquiries" ? <EnquiriesScene /> : null}
      {scene === "camps" ? <CampsScene /> : null}
      {scene === "matches" ? <MatchesScene /> : null}
      {scene === "welcome" ? <WelcomeScene /> : null}
      {scene === "payments" ? <PaymentsScene /> : null}
      {scene === "news" ? <NewsScene /> : null}
    </svg>
  );
}

function PitchBase() {
  return (
    <>
      <rect
        x="8"
        y="28"
        width="144"
        height="84"
        rx="6"
        className="fill-accent/[0.06] stroke-accent/25"
        strokeWidth="1"
      />
      <line x1="80" y1="28" x2="80" y2="112" className="stroke-accent/20" strokeWidth="0.75" />
      <circle cx="80" cy="70" r="14" className="stroke-accent/20" strokeWidth="0.75" />
    </>
  );
}

/** Coach figure + training cones */
function SquadScene() {
  return (
    <>
      <circle cx="48" cy="52" r="5" className="fill-foreground/70" />
      <path
        d="M48 57v16M48 65h-8M48 65h8M48 73v8"
        className="stroke-foreground/60"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M100 88 L100 72 L96 76 Z" className="fill-accent/50 stroke-accent" strokeWidth="0.75" />
      <path d="M118 88 L118 74 L114 78 Z" className="fill-accent/40 stroke-accent/80" strokeWidth="0.75" />
      <path d="M136 88 L136 70 L132 74 Z" className="fill-accent/30 stroke-accent/60" strokeWidth="0.75" />
    </>
  );
}

function PitchWaitingScene() {
  return (
    <>
      <rect x="62" y="94" width="36" height="10" rx="2" className="fill-accent/15 stroke-accent/30" strokeWidth="0.75" />
      <path d="M72 94v-8M88 94v-8" className="stroke-accent/40" strokeWidth="1" strokeLinecap="round" />
      <circle cx="80" cy="70" r="2" className="fill-accent/60" />
    </>
  );
}

function ReportsScene() {
  return (
    <>
      <rect x="52" y="44" width="56" height="48" rx="4" className="fill-background stroke-foreground/25" strokeWidth="1" />
      <line x1="58" y1="54" x2="102" y2="54" className="stroke-muted/60" strokeWidth="1" />
      <line x1="58" y1="62" x2="96" y2="62" className="stroke-muted/40" strokeWidth="1" />
      <line x1="58" y1="70" x2="90" y2="70" className="stroke-muted/40" strokeWidth="1" />
      <circle cx="118" cy="50" r="5" className="fill-foreground/60" />
      <path d="M118 55v14M118 62h-6M118 62h6" className="stroke-foreground/50" strokeWidth="1.25" strokeLinecap="round" />
    </>
  );
}

function TeamsScene() {
  return (
    <>
      <path
        d="M58 58 L58 78 L68 84 L78 78 L78 58 Q68 52 58 58Z"
        className="fill-accent/20 stroke-accent/50"
        strokeWidth="0.75"
      />
      <path
        d="M82 58 L82 78 L92 84 L102 78 L102 58 Q92 52 82 58Z"
        className="fill-accent/15 stroke-accent/40"
        strokeWidth="0.75"
      />
    </>
  );
}

function BookingsScene() {
  return (
    <>
      <rect x="64" y="48" width="32" height="24" rx="2" className="stroke-foreground/30" strokeWidth="1" />
      <line x1="64" y1="56" x2="96" y2="56" className="stroke-foreground/20" strokeWidth="0.75" />
      <circle cx="72" cy="52" r="1.5" className="fill-accent" />
      <path d="M118 88 L118 68 L110 76 Z" className="fill-accent/35 stroke-accent/70" strokeWidth="0.75" />
    </>
  );
}

function AnalyticsScene() {
  return (
    <>
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <circle
            key={`${row}-${col}`}
            cx={52 + col * 14}
            cy={48 + row * 12}
            r={col === 2 && row === 1 ? 2.5 : 1.25}
            className={col === 2 && row === 1 ? "fill-accent" : "fill-accent/25"}
          />
        )),
      )}
      <path d="M52 88 L68 76 L84 80 L100 64 L116 68" className="stroke-accent/70" strokeWidth="1.25" strokeLinecap="round" />
    </>
  );
}

function EnquiriesScene() {
  return (
    <>
      <rect x="58" y="46" width="44" height="32" rx="4" className="fill-background stroke-foreground/25" strokeWidth="1" />
      <path d="M58 52h44" className="stroke-foreground/15" strokeWidth="0.75" />
      <path d="M66 62h28M66 70h20" className="stroke-muted/50" strokeWidth="1" strokeLinecap="round" />
    </>
  );
}

function CampsScene() {
  return (
    <>
      <path d="M68 88 L80 58 L92 88Z" className="fill-accent/15 stroke-accent/45" strokeWidth="0.75" />
      <line x1="80" y1="58" x2="80" y2="88" className="stroke-accent/30" strokeWidth="0.75" />
      <path d="M118 88 L118 64 L114 68 Z" className="fill-accent/35 stroke-accent/60" strokeWidth="0.75" />
    </>
  );
}

function MatchesScene() {
  return (
    <>
      <path
        d="M72 52 L76 64 L88 64 L78 72 L82 84 L72 76 L62 84 L66 72 L56 64 L68 64 Z"
        className="fill-accent/20 stroke-accent/55"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
    </>
  );
}

function WelcomeScene() {
  return (
    <>
      <circle cx="80" cy="70" r="3" className="fill-accent/80" />
      <path d="M40 88h80" className="stroke-accent/35" strokeWidth="1" strokeDasharray="4 3" />
      <path d="M100 88 L100 72 L96 76 Z" className="fill-accent/40 stroke-accent/70" strokeWidth="0.75" />
      <path d="M120 88 L120 74 L116 78 Z" className="fill-accent/30 stroke-accent/55" strokeWidth="0.75" />
    </>
  );
}

function PaymentsScene() {
  return (
    <>
      <rect x="60" y="50" width="40" height="28" rx="4" className="fill-background stroke-foreground/25" strokeWidth="1" />
      <line x1="66" y1="62" x2="94" y2="62" className="stroke-accent/50" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="66" y1="70" x2="82" y2="70" className="stroke-muted/40" strokeWidth="1" strokeLinecap="round" />
    </>
  );
}

function NewsScene() {
  return (
    <>
      <rect x="54" y="44" width="52" height="40" rx="3" className="fill-background stroke-foreground/25" strokeWidth="1" />
      <line x1="60" y1="54" x2="100" y2="54" className="stroke-foreground/30" strokeWidth="1.25" />
      <line x1="60" y1="62" x2="96" y2="62" className="stroke-muted/40" strokeWidth="1" />
      <line x1="60" y1="70" x2="88" y2="70" className="stroke-muted/35" strokeWidth="1" />
    </>
  );
}
