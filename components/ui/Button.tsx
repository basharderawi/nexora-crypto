import Link from 'next/link';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  variant?: ButtonVariant;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
};

type LinkButtonProps = ButtonProps & {
  href: string;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-[var(--primary)] to-[var(--primary2)] text-[var(--bg0)] font-medium shadow-glow-sm hover:shadow-glow hover:opacity-95 transition-all duration-200',
  secondary:
    'border border-[var(--border)] bg-[var(--card)]/80 text-[var(--text)] backdrop-blur-sm hover:border-[var(--primary)]/50 hover:bg-[var(--card)] transition-colors',
  ghost:
    'text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--card)]/50 transition-colors',
};

const baseStyles =
  'inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg0)] disabled:opacity-50 disabled:pointer-events-none';

export function Button({
  variant = 'primary',
  children,
  className = '',
  type = 'button',
  disabled,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  href,
  children,
  className = '',
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
