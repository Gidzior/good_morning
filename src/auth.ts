import { Router, Request, Response, NextFunction } from 'express';
import type { CookieOptions } from 'express';
import { google } from 'googleapis';
import { upsertUser, createSession, getSession, deleteSession, upsertToken, getToken, deleteToken } from './db';
import type { SessionWithUser, UserToken } from './db';

const IS_PROD = process.env.NODE_ENV === 'production';

/** Shared cookie options — secure + lax in production.
 *  Lax (not Strict) because Google OAuth callback is a cross-site redirect
 *  and Strict would block the cookie on first navigation after login. */
function sessionCookie(sessionId: string): [string, string, CookieOptions] {
  return ['session_id', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  }];
}

// --- Google OAuth2 client ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || BASE_URL;
const REDIRECT_URI = `${BASE_URL}/auth/google/callback`;

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function createOAuth2Client() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

// --- Extend Express Request with user ---
declare global {
  namespace Express {
    interface Request {
      user?: SessionWithUser;
    }
  }
}

// --- Auth middleware ---
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.session_id as string | undefined;
  if (!sessionId) {
    res.status(401).json({ error: 'Nie zalogowany' });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    res.clearCookie('session_id');
    res.status(401).json({ error: 'Sesja wygasla' });
    return;
  }

  req.user = session;
  next();
}

// --- Auth router ---
const router = Router();

// Initiate Google OAuth
router.get('/google', (_req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(500).json({ error: 'Google OAuth nie skonfigurowany. Uzupelnij GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET w .env' });
    return;
  }

  const oauth2Client = createOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
  res.redirect(url);
});

// Google OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send('Brak kodu autoryzacji');
    return;
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.id || !profile.email) {
      res.status(400).send('Nie udalo sie pobrac profilu Google');
      return;
    }

    // Upsert user
    const user = upsertUser(
      profile.id,
      profile.email,
      profile.name || profile.email,
      profile.picture || null,
    );

    // Store OAuth tokens for calendar access
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
    upsertToken(
      user.id,
      tokens.access_token || '',
      tokens.refresh_token || null,
      tokens.scope || null,
      expiresAt,
    );

    // Create session
    const sessionId = createSession(user.id);

    res.cookie(...sessionCookie(sessionId));

    // Redirect to dashboard
    res.redirect(FRONTEND_URL);
  } catch (err: unknown) {
    console.error('Google OAuth error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).send(`Blad autoryzacji: ${msg}`);
  }
});

// Get current user
router.get('/me', (req: Request, res: Response) => {
  const sessionId = req.cookies?.session_id as string | undefined;
  if (!sessionId) {
    res.json({ user: null });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    res.clearCookie('session_id');
    res.json({ user: null });
    return;
  }

  // Check if user has calendar tokens
  const token = getToken(session.user_id);
  const hasCalendar = !!token?.access_token;

  res.json({
    user: {
      id: session.user_id,
      email: session.email,
      name: session.name,
      avatar_url: session.avatar_url,
      has_calendar: hasCalendar,
    },
  });
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  const sessionId = req.cookies?.session_id as string | undefined;
  if (sessionId) {
    deleteSession(sessionId);
  }
  res.clearCookie('session_id');
  res.json({ ok: true });
});

// Disconnect calendar (remove OAuth tokens)
router.post('/disconnect-calendar', requireAuth, (req: Request, res: Response) => {
  deleteToken(req.user!.user_id);
  res.json({ ok: true });
});

// Re-authorize calendar (redirect to Google with calendar scope)
router.get('/calendar-connect', requireAuth, (_req: Request, res: Response) => {
  const oauth2Client = createOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
  res.redirect(url);
});

// Dev-only auto-login (creates session for first user in DB)
if (process.env.NODE_ENV !== 'production') {
  router.get('/dev-login', (_req: Request, res: Response) => {
    // Find first user in DB via a direct query
    const db = require('./db').default;
    const firstUser = db.prepare('SELECT * FROM users LIMIT 1').get() as { id: string; google_id: string; email: string; name: string; avatar_url: string | null } | undefined;
    if (!firstUser) {
      res.status(404).send('Brak userow w bazie. Zaloguj sie najpierw przez Google.');
      return;
    }

    const sessionId = createSession(firstUser.id);
    res.cookie(...sessionCookie(sessionId));
    res.redirect(FRONTEND_URL);
  });
}

export default router;

// --- Helper: get refreshed OAuth2 client for a user ---
export function getOAuth2ClientForUser(userId: string): ReturnType<typeof createOAuth2Client> | null {
  const token = getToken(userId);
  if (!token) return null;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type,
    expiry_date: token.expires_at ? new Date(token.expires_at).getTime() : undefined,
  });

  // Auto-refresh tokens and persist
  oauth2Client.on('tokens', (newTokens) => {
    const newExpires = newTokens.expiry_date ? new Date(newTokens.expiry_date) : null;
    upsertToken(
      userId,
      newTokens.access_token || token.access_token,
      newTokens.refresh_token || null,
      newTokens.scope || token.scope,
      newExpires,
    );
  });

  return oauth2Client;
}
