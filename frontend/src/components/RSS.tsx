import { useState, useEffect } from 'react';
import { timeAgo } from '../utils';
import type { RSSItem } from '../types';
import Card from './Card';
import Loading from './Loading';

const AI_FEEDS = [
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
  { name: 'Anthropic', url: 'https://www.anthropic.com/rss.xml' },
  { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/' },
];

const ARTICLES_PER_FEED = 3;

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
    Promise.all(
      AI_FEEDS.map(async (feed) => {
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
      setArticles(all);
      setLoading(false);
    });
  }, [tick]);

  return (
    <Card icon="🤖" title="AI News" span={3}>
      {loading ? (
        <Loading text="Ladowanie wiadomosci AI..." />
      ) : articles.length === 0 ? (
        <div className="error-msg">Nie udalo sie pobrac wiadomosci AI</div>
      ) : (
        <div className="news-scroll">
          {articles.map((a, i) => (
            <div className="article" key={i}>
              <a href={a.link} target="_blank" rel="noopener noreferrer">{a.title}</a>
              <div className="meta">
                <span className="source">{a.source}</span>
                <span>{a.pubDate ? timeAgo(a.pubDate) : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
