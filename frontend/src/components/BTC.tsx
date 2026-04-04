import { useState, useEffect } from 'react';
import type { ZondaResponse } from '../types';
import Loading, { ErrorMsg } from './Loading';
import Card from './Card';

function fmtPLN(val: number): string {
  return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BTC({ tick }: { tick: number }) {
  const [data, setData] = useState<ZondaResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/btc')
      .then(r => r.json())
      .then(d => { setData(d); setError(''); })
      .catch(e => setError(e.message));
  }, [tick]);

  if (error) return <Card icon="₿" title="Bitcoin (Zonda / PLN)"><ErrorMsg message={error} /></Card>;
  if (!data) return <Card icon="₿" title="Bitcoin (Zonda / PLN)"><Loading text="Ladowanie kursu BTC..." /></Card>;
  if (data.status !== 'Ok') return <Card icon="₿" title="Bitcoin (Zonda / PLN)"><ErrorMsg message="Zonda API error" /></Card>;

  const t = data.ticker;
  const price = parseFloat(t.rate);
  const prev = parseFloat(t.previousRate);
  const change = ((price - prev) / prev) * 100;
  const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  const sign = change > 0 ? '+' : '';
  const bid = parseFloat(t.highestBid);
  const ask = parseFloat(t.lowestAsk);

  return (
    <Card icon="₿" title="Bitcoin (Zonda / PLN)">
      <div className="ticker">
        <div className="ticker-name">
          <span className="symbol">BTC / PLN</span>
          <span className="full-name">Bitcoin</span>
        </div>
        <div className="ticker-price">
          <div className="price">{fmtPLN(price)} zl</div>
          <div className={`change ${changeClass}`}>{sign}{change.toFixed(2)}%</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="ticker-detail"><span>Bid</span><span>{fmtPLN(bid)} zl</span></div>
        <div className="ticker-detail"><span>Ask</span><span>{fmtPLN(ask)} zl</span></div>
        <div className="ticker-detail"><span>Spread</span><span>{fmtPLN(ask - bid)} zl</span></div>
      </div>
    </Card>
  );
}
