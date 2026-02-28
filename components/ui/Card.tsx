type CardProps = {
  children: React.ReactNode;
  className?: string;
};

/** Glassmorphism card: translucent bg, border, backdrop blur */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-lg font-semibold text-[var(--text)] ${className}`}>
      {children}
    </h3>
  );
}
