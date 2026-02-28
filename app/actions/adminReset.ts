'use server';

const CONFIRM_TEXT = 'DELETE_ALL_DATA_FOREVER';

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function triggerAdminReset(confirmText: string): Promise<{ success: boolean; error?: string }> {
  if (confirmText !== CONFIRM_TEXT) {
    return { success: false, error: 'Invalid confirmation' };
  }
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return { success: false, error: 'Server misconfiguration' };
  }
  try {
    const res = await fetch(`${getBaseUrl()}/api/admin/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': secret,
      },
      body: JSON.stringify({ confirm: CONFIRM_TEXT }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: (data?.error as string) ?? 'Reset failed' };
    }
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Reset failed';
    console.error('[adminReset] error:', e);
    return { success: false, error: message };
  }
}
