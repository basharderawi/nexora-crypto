import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { Navbar } from '@/components/Navbar';
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
        <Navbar />

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
