'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('התחברת בהצלחה');
      router.push('/admin');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'התחברות נכשלה';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center">
      <div className="w-full">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[var(--text)]">
            <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary2)] bg-clip-text text-transparent">
              Admin Login
            </span>
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            התחבר כדי לגשת ל-Dashboard
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <CardTitle className="mb-4 border-b border-[var(--border)] pb-3">
              Sign in
            </CardTitle>

            <Input
              label="אימייל"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
            <Input
              label="סיסמה"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                {loading ? 'מתחבר…' : 'Sign in'}
              </Button>
              <Link
                href="/"
                className="text-center text-sm text-[var(--muted)] hover:text-[var(--primary)]"
              >
                חזרה לדף הבית
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
