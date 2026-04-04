import { useState, useEffect } from 'react';
import { timeAgo } from '../utils';
import type { RSSItem } from '../types';
import Card from './DashboardCard';
import Loading from './Loading';

const NEWS_FEEDS = [
  { name: 'Bankier.pl', url: 'https://www.bankier.pl/rss/wiadomosci.xml' },
  { name: 'Money.pl', url: 'https://money.pl/rss/rss.xml' },
  { name: 'Business Insider', url: 'https://businessinsider.com.pl/.feed' },
];

const ARTICLES_PER_FEED = 3;

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export default function NewsPL({ tick }: { tick: number }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      NEWS_FEEDS.map(async (feed) => {
        try {
          const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
          const data = await res.json();
          return (data.items || [])
            .slice(0, ARTICLES_PER_FEED)
            .map((item: RSSItem) => ({
              title: item.title || '',
              link: item.link || '#',
              pubDate: item.pubDate || item.isoDate || '',
              source: feed.name,
            }));
        } catch {
          return [];
        }
      })
    ).then(results => {
      const all = results
        .flat()
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      setItems(all);
      setLoading(false);
    });
  }, [tick]);

  return (
    <Card icon="💰" title="Finanse i Biznes">
      {loading ? <Loading text="Ladowanie wiadomosci..." /> :
       items.length === 0 ? <div className="cal-empty">Brak wiadomosci</div> :
       <div className="news-scroll">
        {items.map((item, i) => (
          <div className="article" key={i}>
            <a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
            <div className="meta">
              <span className="source">{item.source}</span>
              <span>{item.pubDate ? timeAgo(item.pubDate) : ''}</span>
            </div>
          </div>
        ))}
       </div>
      }
    </Card>
  );
}
