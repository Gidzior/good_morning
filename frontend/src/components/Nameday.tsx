import { useState, useEffect } from 'react';
import Card from './Card';
import Loading from './Loading';

export default function Nameday({ tick }: { tick: number }) {
  const [names, setNames] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/nameday')
      .then(r => r.json())
      .then(data => {
        setNames(data?.results?.namedays?.pl || null);
      })
      .catch(() => setNames(null));
  }, [tick]);

  return (
    <Card icon="🎂" title="Imieniny dzis">
      {names === null ? (
        <Loading text="Ladowanie..." />
      ) : (
        <div className="nameday-text">🎉 {names}</div>
      )}
    </Card>
  );
}
