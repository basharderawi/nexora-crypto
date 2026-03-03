'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

// Routes: BUY = /order (customer buy USDT page), SELL = /sell (customer sell USDT page)
const NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/', label: 'דף הבית' },
  { href: '/order', label: 'קניית USDT' },
  { href: '/sell', label: 'מכירת USDT' },
];

const ADMIN_HREF = '/admin/login';
const ADMIN_LABEL = 'כניסת מנהל';

function NavLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`text-sm transition hover:text-[var(--primary)] ${
        isActive
          ? 'font-medium text-[var(--primary)] underline decoration-[var(--primary)] decoration-2 underline-offset-4'
          : 'text-[var(--muted)]'
      }`}
    >
      {label}
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg1)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary2)] text-sm font-bold text-[var(--bg0)]">
            N
          </span>
          <span className="text-lg font-semibold text-[var(--text)]">Nexora Crypto</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="ניווט ראשי">
          {NAV_ITEMS.map(({ href, label }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              isActive={pathname === href || (href !== '/' && pathname.startsWith(href))}
            />
          ))}
          <span className="h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />
          <NavLink
            href={ADMIN_HREF}
            label={ADMIN_LABEL}
            isActive={pathname.startsWith('/admin')}
          />
        </nav>

        {/* Mobile: hamburger + dropdown */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/50 hover:text-[var(--text)] transition"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'סגור תפריט' : 'פתח תפריט'}
          >
            {mobileOpen ? (
              <span className="text-lg leading-none">×</span>
            ) : (
              <span className="flex flex-col gap-1">
                <span className="block h-0.5 w-5 rounded bg-current" />
                <span className="block h-0.5 w-5 rounded bg-current" />
                <span className="block h-0.5 w-5 rounded bg-current" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="absolute left-0 right-0 top-14 border-b border-[var(--border)] bg-[var(--bg1)] shadow-lg md:hidden"
          role="dialog"
          aria-label="תפריט ניווט"
        >
          <nav className="flex flex-col gap-1 px-4 py-3" aria-label="ניווט ראשי">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className={`rounded-lg px-3 py-2.5 text-sm transition ${
                  pathname === href || (href !== '/' && pathname.startsWith(href))
                    ? 'font-medium text-[var(--primary)] bg-[var(--primary)]/10'
                    : 'text-[var(--muted)] hover:bg-[var(--border)]/30 hover:text-[var(--text)]'
                }`}
              >
                {label}
              </Link>
            ))}
            <span className="my-1 h-px bg-[var(--border)]" aria-hidden />
            <Link
              href={ADMIN_HREF}
              onClick={closeMobile}
              className={`rounded-lg px-3 py-2.5 text-sm transition ${
                pathname.startsWith('/admin')
                  ? 'font-medium text-[var(--primary)] bg-[var(--primary)]/10'
                  : 'text-[var(--muted)] hover:bg-[var(--border)]/30 hover:text-[var(--text)]'
              }`}
            >
              {ADMIN_LABEL}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
