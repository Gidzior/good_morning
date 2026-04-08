import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '..', 'data', 'dashboard.db');

// Ensure data directory exists
import fs from 'fs';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Safely parse JSON from DB, returning undefined on malformed data */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Malformed JSON in DB:', e);
    return undefined;
  }
}

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_tokens (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    scope TEXT,
    expires_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_calendar_prefs (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calendar_id TEXT NOT NULL,
    calendar_name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, calendar_id)
  );

  CREATE TABLE IF NOT EXISTS user_layouts (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    layout_json TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_cryptos (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, symbol)
  );

  CREATE TABLE IF NOT EXISTS user_currencies (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, code)
  );

  CREATE TABLE IF NOT EXISTS user_stocks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, symbol)
  );

  CREATE TABLE IF NOT EXISTS user_cities (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, lat, lon)
  );

  CREATE TABLE IF NOT EXISTS user_rss_widgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_rss_feeds (
    id TEXT PRIMARY KEY,
    widget_id TEXT NOT NULL REFERENCES user_rss_widgets(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    articles_count INTEGER NOT NULL DEFAULT 3,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_widget_prefs (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    widget_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    saved_layout TEXT,
    PRIMARY KEY (user_id, widget_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_rss_widgets_user ON user_rss_widgets(user_id);
  CREATE INDEX IF NOT EXISTS idx_rss_feeds_widget ON user_rss_feeds(widget_id);
`);

// --- Prepared statements ---
const stmts = {
  upsertUser: db.prepare(`
    INSERT INTO users (id, google_id, email, name, avatar_url, updated_at)
    VALUES (@id, @google_id, @email, @name, @avatar_url, datetime('now'))
    ON CONFLICT(google_id) DO UPDATE SET
      email = @email, name = @name, avatar_url = @avatar_url, updated_at = datetime('now')
  `),

  getUserByGoogleId: db.prepare(`SELECT * FROM users WHERE google_id = ?`),

  createSession: db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)
  `),

  getSession: db.prepare(`
    SELECT s.*, u.id as uid, u.google_id, u.email, u.name, u.avatar_url
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `),

  deleteSession: db.prepare(`DELETE FROM sessions WHERE id = ?`),

  deleteExpiredSessions: db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`),

  upsertToken: db.prepare(`
    INSERT INTO user_tokens (user_id, access_token, refresh_token, token_type, scope, expires_at, updated_at)
    VALUES (@user_id, @access_token, @refresh_token, @token_type, @scope, @expires_at, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = @access_token,
      refresh_token = COALESCE(@refresh_token, user_tokens.refresh_token),
      token_type = @token_type,
      scope = @scope,
      expires_at = @expires_at,
      updated_at = datetime('now')
  `),

  getToken: db.prepare(`SELECT * FROM user_tokens WHERE user_id = ?`),

  deleteToken: db.prepare(`DELETE FROM user_tokens WHERE user_id = ?`),

  upsertCalendarPref: db.prepare(`
    INSERT INTO user_calendar_prefs (user_id, calendar_id, calendar_name, enabled)
    VALUES (@user_id, @calendar_id, @calendar_name, @enabled)
    ON CONFLICT(user_id, calendar_id) DO UPDATE SET
      calendar_name = @calendar_name, enabled = @enabled
  `),

  getCalendarPrefs: db.prepare(`SELECT * FROM user_calendar_prefs WHERE user_id = ?`),

  deleteCalendarPrefs: db.prepare(`DELETE FROM user_calendar_prefs WHERE user_id = ?`),

  upsertLayout: db.prepare(`
    INSERT INTO user_layouts (user_id, layout_json, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      layout_json = excluded.layout_json, updated_at = datetime('now')
  `),

  getLayout: db.prepare(`SELECT layout_json FROM user_layouts WHERE user_id = ?`),

  getUserCryptos: db.prepare(`SELECT symbol, name FROM user_cryptos WHERE user_id = ? ORDER BY sort_order`),
  addUserCrypto: db.prepare(`
    INSERT OR IGNORE INTO user_cryptos (user_id, symbol, name, sort_order)
    VALUES (@user_id, @symbol, @name, (SELECT COALESCE(MAX(sort_order),0)+1 FROM user_cryptos WHERE user_id = @user_id))
  `),
  deleteUserCrypto: db.prepare(`DELETE FROM user_cryptos WHERE user_id = ? AND symbol = ?`),

  getUserCurrencies: db.prepare(`SELECT code, name FROM user_currencies WHERE user_id = ? ORDER BY sort_order`),
  addUserCurrency: db.prepare(`
    INSERT OR IGNORE INTO user_currencies (user_id, code, name, sort_order)
    VALUES (@user_id, @code, @name, (SELECT COALESCE(MAX(sort_order),0)+1 FROM user_currencies WHERE user_id = @user_id))
  `),
  deleteUserCurrency: db.prepare(`DELETE FROM user_currencies WHERE user_id = ? AND code = ?`),

  getUserStocks: db.prepare(`SELECT symbol, name FROM user_stocks WHERE user_id = ? ORDER BY sort_order`),
  addUserStock: db.prepare(`
    INSERT OR IGNORE INTO user_stocks (user_id, symbol, name, sort_order)
    VALUES (@user_id, @symbol, @name, (SELECT COALESCE(MAX(sort_order),0)+1 FROM user_stocks WHERE user_id = @user_id))
  `),
  deleteUserStock: db.prepare(`DELETE FROM user_stocks WHERE user_id = ? AND symbol = ?`),

  getUserCities: db.prepare(`SELECT lat, lon, name, country FROM user_cities WHERE user_id = ? ORDER BY sort_order`),
  addUserCity: db.prepare(`
    INSERT OR IGNORE INTO user_cities (user_id, lat, lon, name, country, sort_order)
    VALUES (@user_id, @lat, @lon, @name, @country, (SELECT COALESCE(MAX(sort_order),0)+1 FROM user_cities WHERE user_id = @user_id))
  `),
  deleteUserCity: db.prepare(`DELETE FROM user_cities WHERE user_id = ? AND lat = ? AND lon = ?`),

  getRssWidgets: db.prepare(`SELECT id, name, sort_order FROM user_rss_widgets WHERE user_id = ? ORDER BY sort_order`),
  createRssWidget: db.prepare(`
    INSERT INTO user_rss_widgets (id, user_id, name, sort_order)
    VALUES (@id, @user_id, @name, (SELECT COALESCE(MAX(sort_order),0)+1 FROM user_rss_widgets WHERE user_id = @user_id))
  `),
  updateRssWidget: db.prepare(`UPDATE user_rss_widgets SET name = ? WHERE id = ? AND user_id = ?`),
  deleteRssWidget: db.prepare(`DELETE FROM user_rss_widgets WHERE id = ? AND user_id = ?`),
  getRssFeeds: db.prepare(`SELECT id, url, name, articles_count FROM user_rss_feeds WHERE widget_id = ? ORDER BY sort_order`),
  addRssFeed: db.prepare(`
    INSERT INTO user_rss_feeds (id, widget_id, url, name, articles_count, sort_order)
    VALUES (@id, @widget_id, @url, @name, @articles_count, (SELECT COALESCE(MAX(sort_order),0)+1 FROM user_rss_feeds WHERE widget_id = @widget_id))
  `),
  deleteRssFeed: db.prepare(`DELETE FROM user_rss_feeds WHERE id = ? AND widget_id = ?`),
  countRssFeeds: db.prepare(`SELECT COUNT(*) as cnt FROM user_rss_feeds WHERE widget_id = ?`),

  getWidgetPrefs: db.prepare(`SELECT widget_id, enabled, saved_layout FROM user_widget_prefs WHERE user_id = ?`),
  upsertWidgetPref: db.prepare(`
    INSERT INTO user_widget_prefs (user_id, widget_id, enabled, saved_layout)
    VALUES (@user_id, @widget_id, @enabled, @saved_layout)
    ON CONFLICT(user_id, widget_id) DO UPDATE SET enabled = @enabled, saved_layout = @saved_layout
  `),
  deleteWidgetPref: db.prepare(`DELETE FROM user_widget_prefs WHERE user_id = ? AND widget_id = ?`),

  deleteAllUserCities: db.prepare(`DELETE FROM user_cities WHERE user_id = ?`),
  deleteAllUserCryptos: db.prepare(`DELETE FROM user_cryptos WHERE user_id = ?`),
  deleteAllUserCurrencies: db.prepare(`DELETE FROM user_currencies WHERE user_id = ?`),
  deleteAllUserStocks: db.prepare(`DELETE FROM user_stocks WHERE user_id = ?`),
  deleteAllCalendarPrefs: db.prepare(`DELETE FROM user_calendar_prefs WHERE user_id = ?`),
};

// --- Public API ---

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface SessionWithUser {
  id: string;
  user_id: string;
  expires_at: string;
  email: string;
  name: string;
  avatar_url: string | null;
  google_id: string;
}

export interface UserToken {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  scope: string | null;
  expires_at: string | null;
}

export interface CalendarPref {
  user_id: string;
  calendar_id: string;
  calendar_name: string;
  enabled: number; // 0 or 1
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function upsertUser(googleId: string, email: string, name: string, avatarUrl: string | null): User {
  const existing = stmts.getUserByGoogleId.get(googleId) as User | undefined;
  const id = existing?.id || uuidv4();
  stmts.upsertUser.run({ id, google_id: googleId, email, name, avatar_url: avatarUrl });
  return { id, google_id: googleId, email, name, avatar_url: avatarUrl };
}

export function createSession(userId: string): string {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  stmts.createSession.run(sessionId, userId, expiresAt);
  return sessionId;
}

export function getSession(sessionId: string): SessionWithUser | null {
  return (stmts.getSession.get(sessionId) as SessionWithUser) || null;
}

export function deleteSession(sessionId: string): void {
  stmts.deleteSession.run(sessionId);
}

export function cleanupExpiredSessions(): void {
  stmts.deleteExpiredSessions.run();
}

export function upsertToken(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  scope: string | null,
  expiresAt: Date | null,
): void {
  stmts.upsertToken.run({
    user_id: userId,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    scope,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
  });
}

export function getToken(userId: string): UserToken | null {
  return (stmts.getToken.get(userId) as UserToken) || null;
}

export function deleteToken(userId: string): void {
  stmts.deleteToken.run(userId);
}

export function getCalendarPrefs(userId: string): CalendarPref[] {
  return stmts.getCalendarPrefs.all(userId) as CalendarPref[];
}

export const saveCalendarPrefs = db.transaction(
  (userId: string, prefs: { calendar_id: string; calendar_name: string; enabled: boolean }[]) => {
    stmts.deleteCalendarPrefs.run(userId);
    for (const p of prefs) {
      stmts.upsertCalendarPref.run({
        user_id: userId,
        calendar_id: p.calendar_id,
        calendar_name: p.calendar_name,
        enabled: p.enabled ? 1 : 0,
      });
    }
  },
);

export function getLayout(userId: string): unknown | null {
  const row = stmts.getLayout.get(userId) as { layout_json: string } | undefined;
  if (!row) return null;
  return safeJsonParse(row.layout_json) ?? null;
}

export function saveLayout(userId: string, layout: unknown): void {
  stmts.upsertLayout.run(userId, JSON.stringify(layout));
}

export function getUserCryptos(userId: string): { symbol: string; name: string }[] {
  return stmts.getUserCryptos.all(userId) as { symbol: string; name: string }[];
}
export function addUserCrypto(userId: string, symbol: string, name: string): void {
  stmts.addUserCrypto.run({ user_id: userId, symbol, name });
}
export function deleteUserCrypto(userId: string, symbol: string): void {
  stmts.deleteUserCrypto.run(userId, symbol);
}

export function getUserCurrencies(userId: string): { code: string; name: string }[] {
  return stmts.getUserCurrencies.all(userId) as { code: string; name: string }[];
}
export function addUserCurrency(userId: string, code: string, name: string): void {
  stmts.addUserCurrency.run({ user_id: userId, code, name });
}
export function deleteUserCurrency(userId: string, code: string): void {
  stmts.deleteUserCurrency.run(userId, code);
}

export function getUserStocks(userId: string): { symbol: string; name: string }[] {
  return stmts.getUserStocks.all(userId) as { symbol: string; name: string }[];
}

export function addUserStock(userId: string, symbol: string, name: string): void {
  stmts.addUserStock.run({ user_id: userId, symbol, name });
}

export function deleteUserStock(userId: string, symbol: string): void {
  stmts.deleteUserStock.run(userId, symbol);
}

// --- User Cities ---
export interface UserCity { lat: number; lon: number; name: string; country: string; }

export function getUserCities(userId: string): UserCity[] {
  return stmts.getUserCities.all(userId) as UserCity[];
}

export function addUserCity(userId: string, lat: number, lon: number, name: string, country: string): void {
  stmts.addUserCity.run({ user_id: userId, lat, lon, name, country });
}

export function deleteUserCity(userId: string, lat: number, lon: number): void {
  stmts.deleteUserCity.run(userId, lat, lon);
}

// --- RSS Widgets ---
export interface RssWidget { id: string; name: string; sort_order: number; feeds: RssFeed[]; }
export interface RssFeed { id: string; url: string; name: string; articles_count: number; }

export function getRssWidgets(userId: string): RssWidget[] {
  const widgets = stmts.getRssWidgets.all(userId) as { id: string; name: string; sort_order: number }[];
  return widgets.map(w => ({
    ...w,
    feeds: stmts.getRssFeeds.all(w.id) as RssFeed[],
  }));
}

export function createRssWidget(userId: string, name: string): RssWidget {
  const id = uuidv4();
  stmts.createRssWidget.run({ id, user_id: userId, name });
  return { id, name, sort_order: 0, feeds: [] };
}

export function updateRssWidget(userId: string, widgetId: string, name: string): void {
  stmts.updateRssWidget.run(name, widgetId, userId);
}

export function deleteRssWidget(userId: string, widgetId: string): void {
  stmts.deleteRssWidget.run(widgetId, userId);
}

/** Verify that widgetId belongs to userId, throw if not */
function verifyWidgetOwner(userId: string, widgetId: string): void {
  const row = db.prepare('SELECT 1 FROM user_rss_widgets WHERE id = ? AND user_id = ?').get(widgetId, userId) as unknown;
  if (!row) throw new Error('Widget not found or not owned by user');
}

export function addRssFeed(userId: string, widgetId: string, url: string, name: string, articlesCount: number): RssFeed {
  verifyWidgetOwner(userId, widgetId);
  const cnt = (stmts.countRssFeeds.get(widgetId) as { cnt: number }).cnt;
  if (cnt >= 5) throw new Error('Max 5 feeds per widget');
  const id = uuidv4();
  stmts.addRssFeed.run({ id, widget_id: widgetId, url, name, articles_count: articlesCount });
  return { id, url, name, articles_count: articlesCount };
}

export function deleteRssFeed(userId: string, widgetId: string, feedId: string): void {
  verifyWidgetOwner(userId, widgetId);
  stmts.deleteRssFeed.run(feedId, widgetId);
}

// --- Widget Preferences ---
interface WidgetPrefRow { widget_id: string; enabled: number; saved_layout: string | null; }

export interface WidgetPrefData {
  enabled: boolean;
  savedLayout?: Record<string, unknown>;
}

export function getWidgetPrefs(userId: string): Record<string, WidgetPrefData> {
  const rows = stmts.getWidgetPrefs.all(userId) as WidgetPrefRow[];
  const prefs: Record<string, WidgetPrefData> = {};
  for (const r of rows) {
    prefs[r.widget_id] = {
      enabled: r.enabled === 1,
      savedLayout: r.saved_layout ? safeJsonParse(r.saved_layout) as Record<string, unknown> | undefined : undefined,
    };
  }
  return prefs;
}

/** Returns saved layout when re-enabling (before deleting the pref row) */
export function setWidgetEnabled(
  userId: string, widgetId: string, enabled: boolean, savedLayout?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (enabled) {
    // Get saved layout before deleting the row
    const rows = stmts.getWidgetPrefs.all(userId) as WidgetPrefRow[];
    const row = rows.find(r => r.widget_id === widgetId);
    const restored = row?.saved_layout ? safeJsonParse(row.saved_layout) as Record<string, unknown> | undefined : undefined;
    stmts.deleteWidgetPref.run(userId, widgetId);
    return restored;
  } else {
    stmts.upsertWidgetPref.run({
      user_id: userId,
      widget_id: widgetId,
      enabled: 0,
      saved_layout: savedLayout ? JSON.stringify(savedLayout) : null,
    });
    return undefined;
  }
}

/** Delete all user data for a given static widget */
export function clearWidgetData(userId: string, widgetId: string): void {
  switch (widgetId) {
    case 'weather': stmts.deleteAllUserCities.run(userId); break;
    case 'crypto': stmts.deleteAllUserCryptos.run(userId); break;
    case 'currencies': stmts.deleteAllUserCurrencies.run(userId); break;
    case 'stocks': stmts.deleteAllUserStocks.run(userId); break;
    case 'calendar': stmts.deleteAllCalendarPrefs.run(userId); break;
    case 'quote': break; // stateless
    default:
      // RSS widget: delete the widget and its feeds (CASCADE)
      if (widgetId.startsWith('rss-')) {
        const rssId = widgetId.slice(4);
        stmts.deleteRssWidget.run(rssId, userId);
      }
      break;
  }
}

// Cleanup expired sessions on startup
cleanupExpiredSessions();

export default db;
