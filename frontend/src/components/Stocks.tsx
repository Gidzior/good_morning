import { useState, useEffect } from 'react';
import config from '../config';
import type { StockConfig } from '../types';
import Loading, { ErrorMsg } from './Loading';
import Card from './Card';

interface StockResult {
  config: StockConfig;
  price?: number;
  change?: number;
  currency?: string;
  error?: boolean;
}

export default function Stocks({ tick }: { tick: number }) {
  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config.STOCKS.length) { setLoading(false); return; }

    Promise.all(
      config.STOCKS.map(async (stock) => {
        try {
          const res = await fetch(`/api/stock/${encodeURIComponent(stock.symbol)}`);
          const data = await res.json();
          const meta = data.chart.result[0].meta;
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || meta.previousClose;
          return {
            config: stock,
            price,
            change: ((price - prev) / prev) * 100,
            currency: meta.currency || 'USD',
          };
        } catch {
          return { config: stock, error: true };
        }
      })
    ).then(r => { setResults(r); setLoading(false); });
  }, [tick]);

  return (
    <Card icon="📈" title="Akcje">
      {loading ? (
        <Loading text="Ladowanie kursow..." />
      ) : results.length === 0 ? (
        <div className="cal-empty">Dodaj akcje w config.ts</div>
      ) : (
        results.map((s, i) => (
          <div className="ticker" key={i}>
            <div className="ticker-name">
              <span className="symbol">{s.config.symbol}</span>
              <span className="full-name">{s.config.name}</span>
            </div>
            <div className="ticker-price">
              {s.error ? (
                <ErrorMsg message="Blad" />
              ) : (
                <>
                  <div className="price">
                    {s.price!.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {s.currency}
                  </div>
                  <div className={`change ${s.change! > 0 ? 'up' : s.change! < 0 ? 'down' : 'neutral'}`}>
                    {s.change! > 0 ? '+' : ''}{s.change!.toFixed(2)}%
                  </div>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
