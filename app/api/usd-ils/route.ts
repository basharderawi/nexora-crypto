import { XMLParser } from 'fast-xml-parser';

const BOI_XML_URL = 'https://www.boi.org.il/PublicApi/GetExchangeRates?asXml=true';

export const revalidate = 3600;

export async function GET() {
  try {
    const res = await fetch(BOI_XML_URL, { next: { revalidate: 3600 } });
    if (!res.ok) {
      throw new Error(`BoI API returned ${res.status}`);
    }
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);

    const collection =
      parsed?.ExchangeRatesResponseCollectioDTO ??
      parsed?.['ExchangeRatesResponseCollectioDTO'];
    const rates = collection?.ExchangeRates?.ExchangeRateResponseDTO ?? [];
    const list = Array.isArray(rates) ? rates : [rates];
    const usd = list.find(
      (r: Record<string, unknown>) =>
        (String(r?.Key ?? r?.key ?? '').toUpperCase() === 'USD')
    );
    const rateStr =
      usd?.CurrentExchangeRate ??
      usd?.currentExchangeRate ??
      (usd as Record<string, unknown>)?.['CurrentExchangeRate'];
    const rate = rateStr != null ? parseFloat(String(rateStr)) : null;

    if (rate == null || Number.isNaN(rate) || rate <= 0) {
      throw new Error('USD rate not found in BoI response');
    }

    const fetched_at = new Date().toISOString();
    return Response.json(
      { rate, source: 'boi', fetched_at },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('USD/ILS fetch error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch rate' },
      { status: 500 }
    );
  }
}
