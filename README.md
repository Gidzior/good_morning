# good_morning

Poranny dashboard briefingowy — wszystkie najwazniejsze informacje na start dnia w jednym miejscu.

## Funkcje

- **Pogoda** — aktualna temperatura i prognoza na dzis (OpenWeatherMap)
- **Kalendarz Google** — wydarzenia na najblizsze 3 dni
- **Kursy walut i BTC** — Bitcoin z Zonda, USD/EUR z NBP
- **Akcje GPW** — CD Projekt, Allegro (Yahoo Finance)
- **AI News** — artykuly ze zrodel o sztucznej inteligencji
- **Finanse i Biznes** — Bankier.pl, Money.pl, Business Insider
- **Cytat dnia** — motywacyjny cytat na start
- **Imieniny** — lokalna baza polskich imienin
- **Auto-odswiezanie** — dane aktualizowane co 3 godziny

## Wymagania

- Node.js (v18+)

## Instalacja

```bash
git clone git@github.com:Gidzior/good_morning.git
cd good_morning
npm install
cd frontend && npm install && cd ..
```

## Konfiguracja

Skopiuj `.env.example` do `.env` i uzupelnij klucze API:

```bash
cp .env.example .env
```

| Zmienna | Opis | Gdzie uzyskac |
|---------|------|---------------|
| `WEATHER_API_KEY` | Klucz API pogody | [openweathermap.org](https://openweathermap.org/api) (darmowy) |
| `WEATHER_CITY` | Miasto (domyslnie: Warszawa) | — |
| `WEATHER_COUNTRY` | Kraj (domyslnie: PL) | — |
| `GOOGLE_CALENDAR_API_KEY` | Klucz API kalendarza | [Google Cloud Console](https://console.cloud.google.com/) |
| `GOOGLE_CALENDAR_ID` | ID kalendarza Google | Ustawienia kalendarza > Integracja |

Akcje GPW konfiguruj w `frontend/src/config.ts`.

## Uruchomienie

Potrzebne sa dwa terminale:

**Backend** (z katalogu glownego):
```bash
npm run dev:backend
```

**Frontend** (z katalogu `frontend/`):
```bash
npm run dev:frontend
```

Dashboard dostepny pod adresem: `http://localhost:5173`

## Zatrzymanie

- **Frontend:** `Ctrl+C` w terminalu z Vite
- **Backend:** `Ctrl+C` w terminalu z Express

## Inne komendy

```bash
npm run build          # Build backendu i frontendu (produkcja)
npm run start          # Uruchom zbudowany serwer produkcyjny
cd frontend && npm run lint   # ESLint + typecheck
```

## Struktura projektu

```
good_morning/
├── src/
│   └── server.ts              # Backend Express (proxy API)
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Glowny komponent
│   │   ├── App.css            # Style
│   │   ├── config.ts          # Konfiguracja (akcje, interwaly)
│   │   ├── types.ts           # Typy TypeScript
│   │   ├── utils.ts           # Funkcje pomocnicze
│   │   └── components/        # Komponenty React
│   └── vite.config.ts         # Vite + proxy /api → :3001
├── .env                       # Klucze API (gitignored)
├── .env.example               # Szablon .env
├── CLAUDE.md                  # Instrukcje dla Claude Code
└── package.json
```

## Technologie

- **Frontend:** React, TypeScript, Vite
- **Backend:** Express, TypeScript, rss-parser, dotenv
- **API:** OpenWeatherMap, Zonda Crypto, Yahoo Finance, NBP, Google Calendar
