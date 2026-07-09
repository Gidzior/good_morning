// Serwer pod testy e2e — uruchamiany przez playwright.config.ts (webServer).
// Wymagane env (ustawia config): DB_PATH, PORT, BASE_URL, FRONTEND_URL.
// Kolejnosc: skasuj stara baze -> zaladuj modul db (tworzy schemat) -> seed
// usera (dla /auth/dev-login) i BTC (widget krypto) -> start backendu.
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  throw new Error('Brak DB_PATH w env — uruchamiaj przez npx playwright test, nie bezposrednio');
}

const distIndex = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
if (!fs.existsSync(distIndex)) {
  throw new Error('Brak frontend/dist/index.html — zbuduj frontend przed e2e: cd frontend && npm run build');
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(dbPath + suffix, { force: true });
}

async function main(): Promise<void> {
  // dynamiczne importy — modul db otwiera plik bazy przy zaladowaniu,
  // wiec musi wejsc dopiero po skasowaniu starej bazy
  const db = await import('../src/db');
  const user = db.upsertUser('e2e-google-id', 'e2e@example.com', 'E2E Tester', null);
  db.addUserCrypto(user.id, 'BTC', 'Bitcoin');
  await import('../src/server');
}

main().catch((err: unknown) => {
  console.error('Start serwera e2e nie powiodl sie:', err);
  process.exit(1);
});
