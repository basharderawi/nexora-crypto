import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

function FeatureCard({ icon, title, body }: FeatureCardProps) {
  return (
    <Card className="border-[var(--border)]/80 shadow-[0_0_20px_rgba(6,182,212,0.08)] transition-shadow hover:shadow-[0_0_24px_var(--glow)]/30">
      <div className="flex flex-col items-center text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--primary)]/10 text-2xl">
          {icon}
        </span>
        <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
      </div>
    </Card>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero with subtle radial glow */}
      <section className="relative flex flex-col items-center gap-5 py-20 text-center md:py-28">
        <div
          className="pointer-events-none absolute inset-0 top-1/2 h-64 -translate-y-1/2 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,var(--glow)_0%,transparent_70%)] opacity-30"
          aria-hidden
        />
        <h1 className="relative text-4xl font-bold tracking-tight text-[var(--text)] md:text-5xl lg:text-6xl">
          <span className="text-glow bg-gradient-to-r from-[var(--primary)] to-[var(--primary2)] bg-clip-text text-transparent">
            Nexora Crypto
          </span>
        </h1>
        <p className="relative max-w-lg text-lg text-[var(--muted)] md:text-xl">
          מהירות · אמינות · שירות מקצועי
        </p>
        <div className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
          <ButtonLink
            href="/order"
            variant="primary"
            className="min-w-[200px] px-8 py-3.5 text-base font-semibold focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg0)]"
          >
            יצירת הזמנה
          </ButtonLink>
          <ButtonLink
            href="/admin/login"
            variant="ghost"
            className="min-w-[140px] px-5 py-2.5 text-sm text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg0)]"
          >
            Admin Login
          </ButtonLink>
        </div>
      </section>

      {/* 3 feature cards */}
      <section className="mt-16 w-full max-w-4xl md:mt-24">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon="⚡"
            title="מהירות"
            body="תהליך מהיר ומדויק ללא עיכובים."
          />
          <FeatureCard
            icon="🔒"
            title="אמינות"
            body="ביטחון מלא בכל עסקה."
          />
          <FeatureCard
            icon="📈"
            title="שירות מקצועי"
            body="ליווי אישי ושירות ברמה גבוהה."
          />
        </div>
      </section>
    </div>
  );
}
