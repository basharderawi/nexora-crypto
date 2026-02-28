'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';

const BUSINESS_WHATSAPP_PHONE = '972542146657';
const WHATSAPP_PHONE = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? '' : '';

function shortOrderId(id: string): string {
  return id.length >= 6 ? '…' + id.slice(-6) : id;
}

const PAYMENT_OPTIONS = [
  { value: 'BIT', label: 'BIT' },
  { value: 'CASH_WITHOUT_CARD', label: 'משיכת מזומן ללא כרטיס' },
] as const;

const PHONE_ERROR = 'נא להזין מספר טלפון תקין';

const orderSchema = z.object({
  full_name: z.string().min(1, 'שם מלא חובה'),
  city: z.string().min(1, 'עיר חובה'),
  phone: z
    .string()
    .min(1, PHONE_ERROR)
    .refine((v) => v.replace(/\D/g, '').length >= 9, PHONE_ERROR),
  amount_usdt: z.coerce.number().positive('הסכום חייב להיות גדול מ-0'),
  payment_method: z.enum(['BIT', 'CASH_WITHOUT_CARD'], {
    required_error: 'אמצעי תשלום חובה',
  }),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

export default function OrderPage() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      payment_method: 'BIT',
    },
  });

  const [submittedData, setSubmittedData] = useState<OrderFormData | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState<number | null>(null);

  const amountUsdt = watch('amount_usdt');

  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: settingsRow } = await supabase.from('app_settings').select('sell_price_ils_per_usdt').eq('id', 1).single();
        const val = (settingsRow as { sell_price_ils_per_usdt?: number } | null)?.sell_price_ils_per_usdt;
        setSellPrice(typeof val === 'number' ? val : val != null ? parseFloat(String(val)) : null);
      } catch {
        setSellPrice(null);
      }
    })();
  }, []);

  async function onSubmit(data: OrderFormData) {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const payload = {
        full_name: data.full_name,
        city: data.city,
        phone: data.phone || null,
        amount_usdt: data.amount_usdt,
        payment_method: data.payment_method,
        notes: data.notes || null,
        status: 'new',
      };
      console.log('ORDER_PAYLOAD', payload);
      const { data: inserted, error } = await supabase.from('orders').insert(payload as never).select('id').single();

      if (error) {
        console.error('SUPABASE_ERROR', error);
        throw error;
      }

      setSubmittedData(data);
      const insertedRow = inserted as { id?: string } | null;
      if (insertedRow?.id) setOrderId(insertedRow.id);
      toast.success('ההזמנה נוצרה בהצלחה');

      const totalIls =
        sellPrice != null && sellPrice > 0 && data.amount_usdt > 0
          ? (data.amount_usdt * sellPrice).toFixed(2)
          : null;
      const paymentLabel = PAYMENT_OPTIONS.find((o) => o.value === data.payment_method)?.label ?? data.payment_method;
      const text = [
        'שלום, שלחתי הזמנת USDT ✅',
        '',
        `שם: ${data.full_name}`,
        `עיר: ${data.city}`,
        `טלפון: ${data.phone}`,
        `כמות USDT: ${data.amount_usdt}`,
        `אמצעי תשלום: ${paymentLabel}`,
        totalIls != null ? `סה״כ לתשלום: ${totalIls} ₪` : '',
        data.notes?.trim() ? `הערות: ${data.notes.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const url = `https://wa.me/${BUSINESS_WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      console.error('Order submit error:', err);
      const isMissingEnv =
        err instanceof Error &&
        /missing.*supabase|NEXT_PUBLIC_SUPABASE/i.test(err.message);
      const message =
        isMissingEnv
          ? 'Missing Supabase env'
          : (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string')
            ? (err as Error).message
            : 'יצירת ההזמנה נכשלה';
      toast.error(message);
    }
  }

  // Success screen (neon/glass, RTL)
  if (submittedData) {
    const copyOrderId = () => {
      if (orderId) {
        void navigator.clipboard.writeText(orderId);
        toast.success('הועתק ללוח');
      }
    };
    const whatsAppHref = WHATSAPP_PHONE
      ? `https://wa.me/${WHATSAPP_PHONE.replace(/\D/g, '')}`
      : null;

    return (
      <div className="mx-auto max-w-[560px]">
        <Card className="p-8 py-10">
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--primary)] bg-[var(--primary)]/10">
              <svg
                className="h-7 w-7 text-[var(--primary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text)]">ההזמנה נוצרה בהצלחה</h2>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg1)] px-3 py-1.5 text-sm font-medium text-[var(--primary)]">
                הבקשה נשלחה
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg1)] px-3 py-1.5 text-sm text-[var(--muted)]">
                Status: New
              </span>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              ניצור איתך קשר בקרוב ב-WhatsApp
            </p>
            {orderId && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="text-sm text-[var(--muted)]">מזהה הזמנה:</span>
                <span dir="ltr" className="font-mono text-sm text-[var(--text)]">{shortOrderId(orderId)}</span>
                <button
                  type="button"
                  onClick={copyOrderId}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg1)] px-2.5 py-1 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                >
                  העתק
                </button>
              </div>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {whatsAppHref && (
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-lg border border-[var(--primary)] bg-[var(--primary)]/20 px-5 font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                >
                  פתח WhatsApp
                </a>
              )}
              <ButtonLink href="/" variant={whatsAppHref ? 'secondary' : 'primary'} className="!h-11 !min-w-[140px]">
                חזרה לדף הבית
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Form
  return (
    <div className="mx-auto max-w-[560px]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text)]">
          <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary2)] bg-clip-text text-transparent">
            יצירת הזמנה
          </span>
        </h1>
        <p className="mt-2 text-[var(--muted)]">מלא פרטים כדי לקנות USDT</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <CardTitle className="mb-4 border-b border-[var(--border)] pb-3">
            פרטי ההזמנה
          </CardTitle>

          <Input
            label="שם מלא *"
            placeholder="הכנס שם מלא"
            {...register('full_name')}
            error={errors.full_name?.message}
          />
          <Input
            label="עיר *"
            placeholder="תל אביב"
            {...register('city')}
            error={errors.city?.message}
          />
          <Input
            label="טלפון *"
            type="tel"
            placeholder="הכנס מספר טלפון"
            {...register('phone')}
            error={errors.phone?.message}
          />
          <Input
            label="כמות USDT *"
            type="number"
            step="any"
            min={0}
            placeholder="0.00"
            dir="ltr"
            {...register('amount_usdt')}
            error={errors.amount_usdt?.message}
          />

          {/* Price preview */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/50 p-4 backdrop-blur-sm">
            {sellPrice != null && sellPrice > 0 ? (
              <>
                <p className="text-sm text-[var(--muted)]">
                  הערכת תשלום: <span dir="ltr" className="font-semibold text-[var(--primary)]">₪ {(() => {
                    const amount = typeof amountUsdt === 'string' ? parseFloat(amountUsdt) : amountUsdt;
                    const num = Number.isNaN(amount) || amount <= 0 ? 0 : amount * sellPrice;
                    return num.toFixed(2);
                  })()}</span>
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  מחיר מכירה נוכחי: <span dir="ltr">{sellPrice} ₪ / 1 USDT</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">לא הוגדר מחיר מכירה כרגע</p>
            )}
          </div>

          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
              אמצעי תשלום *
            </label>
            <select
              className={`w-full rounded-lg border bg-[var(--bg1)] px-4 py-2.5 text-[var(--text)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 ${
                errors.payment_method?.message
                  ? 'border-red-500'
                  : 'border-[var(--border)]'
              }`}
              {...register('payment_method')}
            >
              {PAYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.payment_method?.message && (
              <p className="mt-1 text-sm text-red-400">{errors.payment_method.message}</p>
            )}
          </div>

          <Textarea
            label="הערות (אופציונלי)"
            rows={3}
            placeholder="הנחיות נוספות..."
            {...register('notes')}
            error={errors.notes?.message}
          />

          <div className="flex justify-start pt-2">
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'שולח…' : 'שליחת הזמנה'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
