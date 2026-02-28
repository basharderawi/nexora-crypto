import type { Metadata } from 'next';
import Link from 'next/link';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexora Crypto',
  description: 'Nexora Crypto Exchange',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <body className="min-h-screen">
        {/* Top navbar */}
        <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg1)]/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-3">
              {/* Logo: add /public/nexora-logo.png for production */}
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary2)] text-sm font-bold text-[var(--bg0)]">
                N
              </span>
              <span className="text-lg font-semibold text-[var(--text)]">
                Nexora Crypto
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link
                href="/"
                className="text-[var(--muted)] transition hover:text-[var(--primary)]"
              >
                דף הבית
              </Link>
              <Link
                href="/order"
                className="text-[var(--muted)] transition hover:text-[var(--primary)]"
              >
                יצירת הזמנה
              </Link>
              <Link
                href="/admin/login"
                className="text-[var(--muted)] transition hover:text-[var(--primary)]"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>

        {/* Centered main content */}
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <Toaster position="top-center" richColors closeButton />

        {/* Footer */}
        <footer className="mt-auto border-t border-[var(--border)] py-4">
          <div className="mx-auto max-w-5xl px-4 text-center text-xs text-[var(--muted)]">
            Nexora Crypto
          </div>
        </footer>
      </body>
    </html>
  );
}
