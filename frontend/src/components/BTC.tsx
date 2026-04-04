import { useState, useEffect } from 'react';
import type { ZondaResponse } from '../types';
import Loading, { ErrorMsg } from './Loading';
import Card from './DashboardCard';

function fmtPLN(val: number): string {
  return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface NBPRate {
  currency: string;
  code: string;
  mid: number;
  prev?: number;
}

export default function BTC({ tick }: { tick: number }) {
  const [data, setData] = useState<ZondaResponse | null>(null);
  const [currencies, setCurrencies] = useState<NBPRate[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/btc')
      .then(r => r.json())
      .then(d => { setData(d); setError(''); })
      .catch(e => setError(e.message));

    fetch('/api/currencies')
      .then(r => r.json())
      .then(d => setCurrencies(d))
      .catch(() => {});
  }, [tick]);

  return (
    <Card icon="💱" title="Kursy walut i BTC">
      {error ? <ErrorMsg message={error} /> :
       !data ? <Loading text="Ladowanie kursow..." /> :
       data.status !== 'Ok' ? <ErrorMsg message="Zonda API error" /> :
       <>
        {(() => {
          const t = data.ticker;
          const price = parseFloat(t.rate);
          const prev = parseFloat(t.previousRate);
          const change = ((price - prev) / prev) * 100;
          const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
          const sign = change > 0 ? '+' : '';
          return (
            <div className="ticker">
              <div className="ticker-name">
                <span className="symbol">BTC / PLN</span>
                <span className="full-name">Bitcoin (Zonda)</span>
              </div>
              <div className="ticker-price">
                <div className="price">{fmtPLN(price)} zl</div>
                <div className={`change ${changeClass}`}>{sign}{change.toFixed(2)}%</div>
              </div>
            </div>
          );
        })()}

        {currencies.map((c, i) => {
          const changeVal = c.prev ? ((c.mid - c.prev) / c.prev) * 100 : 0;
          const changeClass = changeVal > 0 ? 'up' : changeVal < 0 ? 'down' : 'neutral';
          const sign = changeVal > 0 ? '+' : '';
          return (
            <div className="ticker" key={i}>
              <div className="ticker-name">
                <span className="symbol">{c.code} / PLN</span>
                <span className="full-name">{c.currency}</span>
              </div>
              <div className="ticker-price">
                <div className="price">{fmtPLN(c.mid)} zl</div>
                <div className={`change ${changeClass}`}>{sign}{changeVal.toFixed(2)}%</div>
              </div>
            </div>
          );
        })}
       </>
      }
    </Card>
  );
}
