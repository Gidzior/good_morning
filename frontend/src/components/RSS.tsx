import { useState, useEffect } from 'react';
import config from '../config';
import { timeAgo } from '../utils';
import Card from './Card';
import Loading from './Loading';

interface Article {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export default function RSS({ tick }: { tick: number }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config.RSS_FEEDS.length) { setLoading(false); return; }

    Promise.all(
      config.RSS_FEEDS.map(async (feed) => {
        try {
          const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
          const data = await res.json();
          return (data.items || [])
            .slice(0, config.RSS_ARTICLES_PER_FEED)
            .map((item: any) => ({
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
      setArticles(all);
      setLoading(false);
    });
  }, [tick]);

  return (
    <Card icon="📰" title="Artykuly z RSS" span={3}>
      {loading ? (
        <Loading text="Ladowanie artykulow..." />
      ) : articles.length === 0 ? (
        <div className="error-msg">Nie udalo sie pobrac artykulow RSS</div>
      ) : (
        articles.map((a, i) => (
          <div className="article" key={i}>
            <a href={a.link} target="_blank" rel="noopener noreferrer">{a.title}</a>
            <div className="meta">
              <span className="source">{a.source}</span>
              <span>{a.pubDate ? timeAgo(a.pubDate) : ''}</span>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
