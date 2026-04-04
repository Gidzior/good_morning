import { useState, useEffect } from 'react';
import { timeAgo } from '../utils';
import Card from './Card';
import Loading, { ErrorMsg } from './Loading';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
}

export default function NewsPL({ tick }: { tick: number }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/news-pl')
      .then(r => r.json())
      .then(data => {
        setItems(
          (data.items || []).slice(0, 5).map((item: any) => ({
            title: item.title || '',
            link: item.link || '#',
            pubDate: item.pubDate || '',
          }))
        );
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [tick]);

  return (
    <Card icon="🇵🇱" title="Wiadomosci PL">
      {loading ? <Loading text="Ladowanie wiadomosci..." /> :
       error ? <ErrorMsg message="Nie udalo sie pobrac wiadomosci" /> :
       items.length === 0 ? <div className="cal-empty">Brak wiadomosci</div> :
       items.map((item, i) => (
        <div className="article" key={i}>
          <a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
          <div className="meta">
            <span>{item.pubDate ? timeAgo(item.pubDate) : ''}</span>
          </div>
        </div>
       ))}
    </Card>
  );
}
