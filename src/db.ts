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

  CREATE TABLE IF NOT EXISTS user_stocks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, symbol)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
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

  getUserStocks: db.prepare(`SELECT symbol, name FROM user_stocks WHERE user_id = ? ORDER BY sort_order`),
  addUserStock: db.prepare(`
    INSERT OR IGNORE INTO user_stocks (user_id, symbol, name, sort_order)
    VALUES (@user_id, @symbol, @name, (SELECT COALESCE(MAX(sort_order),0)+1 FROM user_stocks WHERE user_id = @user_id))
  `),
  deleteUserStock: db.prepare(`DELETE FROM user_stocks WHERE user_id = ? AND symbol = ?`),
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

export function saveCalendarPrefs(userId: string, prefs: { calendar_id: string; calendar_name: string; enabled: boolean }[]): void {
  stmts.deleteCalendarPrefs.run(userId);
  for (const p of prefs) {
    stmts.upsertCalendarPref.run({
      user_id: userId,
      calendar_id: p.calendar_id,
      calendar_name: p.calendar_name,
      enabled: p.enabled ? 1 : 0,
    });
  }
}

export function getLayout(userId: string): unknown | null {
  const row = stmts.getLayout.get(userId) as { layout_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.layout_json) as unknown;
}

export function saveLayout(userId: string, layout: unknown): void {
  stmts.upsertLayout.run(userId, JSON.stringify(layout));
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

// Cleanup expired sessions on startup
cleanupExpiredSessions();

export default db;
