'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const email = (formData.get('email') as string)?.trim();
  const password = (formData.get('password') as string) ?? '';

  if (!email || !password) {
    return { error: 'נא להזין אימייל וסיסמה' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect('/admin');
}
