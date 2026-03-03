'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { signIn } from './actions';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" className="w-full" disabled={pending}>
      {pending ? 'מתחבר…' : 'התחבר'}
    </Button>
  );
}

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
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
          <form action={handleSubmit} className="space-y-5">
            <CardTitle className="mb-4 border-b border-[var(--border)] pb-3">
              Sign in
            </CardTitle>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            <Input
              label="אימייל"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@example.com"
            />
            <Input
              label="סיסמה"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />

            <div className="flex flex-col gap-3 pt-2">
              <SubmitButton />
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
