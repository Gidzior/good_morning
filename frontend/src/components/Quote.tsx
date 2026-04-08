import { useState, useEffect } from 'react';
import Card from './DashboardCard';
import Loading from './Loading';

const FALLBACK_QUOTES = [
  { text: 'Jedynym sposobem na robienie wielkiej pracy jest kochanie tego, co robisz.', author: 'Steve Jobs' },
  { text: 'Sukces to nie klucz do szczescia. Szczescie to klucz do sukcesu.', author: 'Albert Schweitzer' },
  { text: 'Nie czekaj. Czas nigdy nie bedzie idealny.', author: 'Napoleon Hill' },
  { text: 'Kazdy dzien to nowa szansa, aby zmienic swoje zycie.', author: 'Anonim' },
  { text: 'Prostota jest ostatecznym wyrafinowaniem.', author: 'Leonardo da Vinci' },
  { text: 'Jedyna rzecz, ktorej musimy sie bac, to sam strach.', author: 'Franklin D. Roosevelt' },
  { text: 'Zycie to 10% tego co Ci sie przydarza i 90% tego jak na to reagujesz.', author: 'Charles R. Swindoll' },
];

export default function Quote({ tick }: { tick: number }) {
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);

  useEffect(() => {
    fetch('/api/quote')
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<{ text: string; author: string }>; })
      .then(data => setQuote(data))
      .catch((err) => {
        console.error('Quote fetch error:', err);
        const q = FALLBACK_QUOTES[new Date().getDate() % FALLBACK_QUOTES.length];
        setQuote(q);
      });
  }, [tick]);

  return (
    <Card icon="💬" title="Cytat dnia">
      {!quote ? <Loading text="Ladowanie cytatu..." /> : (
        <>
          <div className="quote-text">"{quote.text}"</div>
          <div className="quote-author">— {quote.author}</div>
        </>
      )}
    </Card>
  );
}
