import { useState, useEffect } from 'react';
import { timeAgo } from '../utils';
import type { RSSItem } from '../types';
import Card from './DashboardCard';
import Loading from './Loading';
import { Input } from '@/components/ui/input';
import SettingsModal from './SettingsModal';

export interface RssFeedConfig {
  id: string;
  url: string;
  name: string;
  articles_count: number;
}

interface Article {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface RSSProps {
  widgetId: string;
  widgetName: string;
  feeds: RssFeedConfig[];
  tick: number;
  onFeedsChanged: () => void;
}

export default function RSS({ widgetId, widgetName, feeds, tick, onFeedsChanged }: RSSProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [newCount, setNewCount] = useState(3);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (feeds.length === 0) { setArticles([]); setLoading(false); return; }
    setLoading(true);
    Promise.all(
      feeds.map(async (feed) => {
        try {
          const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
          const data = await res.json();
          return (data.items || [])
            .slice(0, feed.articles_count)
            .map((item: RSSItem) => ({
              title: item.title || '',
              link: item.link || '#',
              pubDate: item.pubDate || item.isoDate || '',
              source: feed.name,
            }));
        } catch (err) {
          console.error(`Failed to fetch RSS feed ${feed.name}:`, err);
          return [];
        }
      })
    ).then(results => {
      const all = results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      setArticles(all);
      setLoading(false);
    });
  }, [tick, feeds]);

  const handleAddFeed = async () => {
    if (!newUrl || !newName) return;
    setAdding(true);
    try {
      await fetch(`/api/rss-widgets/${widgetId}/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, name: newName, articles_count: newCount }),
      });
      setNewUrl(''); setNewName(''); setNewCount(3);
      onFeedsChanged();
    } catch (err) { console.error('Failed to add RSS feed:', err); }
    setAdding(false);
  };

  const handleRemoveFeed = async (feedId: string) => {
    await fetch(`/api/rss-widgets/${widgetId}/feeds/${feedId}`, { method: 'DELETE' });
    onFeedsChanged();
  };

  return (
    <Card icon="📡" title={widgetName} onSettings={() => setShowSettings(true)}>
      {loading ? (
        <Loading text="Ladowanie RSS..." />
      ) : feeds.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Brak kanalow RSS. Kliknij <button onClick={() => setShowSettings(true)} className="text-primary underline">⚙ ustawienia</button> zeby dodac.
        </div>
      ) : articles.length === 0 ? (
        <div className="text-sm text-muted-foreground">Brak artykulow</div>
      ) : (
        <div className="space-y-3">
          {articles.map((a, i) => (
            <div key={i} className="border-b border-border pb-2 last:border-0">
              <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2">
                {a.title}
              </a>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-primary/70">{a.source}</span>
                <span>{a.pubDate ? timeAgo(a.pubDate) : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} title={`Kanaly RSS — ${widgetName}`}>
        <div className="text-xs font-medium text-muted-foreground mb-2">Twoje kanaly ({feeds.length}/5)</div>
        {feeds.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">Brak — dodaj kanaly ponizej</p>
        ) : (
          <div className="mb-4 space-y-1">
            {feeds.map(f => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[280px]">{f.url}</div>
                  <div className="text-xs text-muted-foreground">Artykulow: {f.articles_count}</div>
                </div>
                <button onClick={() => handleRemoveFeed(f.id)} className="ml-2 text-destructive hover:text-destructive/80 text-lg leading-none">&times;</button>
              </div>
            ))}
          </div>
        )}

        {feeds.length < 5 && (
          <div className="border-t pt-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Dodaj kanal</div>
            <Input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Nazwa (np. The Verge AI)" />
            <Input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)}
              placeholder="URL kanalu RSS" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Artykulow:</label>
              <Input type="number" min={1} max={10} value={newCount}
                onChange={e => setNewCount(Math.min(10, Math.max(1, Number(e.target.value))))}
                className="w-16" />
              <button onClick={handleAddFeed} disabled={!newUrl || !newName || adding}
                className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40">
                {adding ? '...' : 'Dodaj'}
              </button>
            </div>
          </div>
        )}
      </SettingsModal>
    </Card>
  );
}
