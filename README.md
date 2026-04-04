# good_morning

Poranny dashboard briefingowy — wszystkie najwazniejsze informacje na start dnia w jednym miejscu.

## Funkcje

- **Pogoda** — aktualna temperatura i prognoza na dzis (OpenWeatherMap)
- **Kalendarz Google** — wydarzenia na najblizsze 3 dni
- **Kanaly RSS** — 3-4 najnowsze artykuly z kazdego skonfigurowanego kanalu
- **BTC/PLN** — kurs Bitcoina z Zonda Crypto (bid, ask, spread)
- **Kursy akcji** — wybrane spolki z Yahoo Finance
- **Wiadomosci PL** — top wiadomosci z Polski
- **Cytat dnia** — motywacyjny cytat na start
- **Imieniny** — kto dzis obchodzi imieniny
- **Auto-odswiezanie** — dane aktualizowane co 3 godziny

## Wymagania

- Node.js (v18+)

## Instalacja

```bash
git clone https://github.com/Gidzior/good_morning.git
cd good_morning
npm install
```

## Konfiguracja

Skopiuj plik konfiguracyjny i uzupelnij swoje dane:

```bash
cp public/config.example.js public/config.js
```

W pliku `public/config.js` uzupelnij:

| Pole | Opis | Gdzie uzyskac |
|------|------|---------------|
| `WEATHER_API_KEY` | Klucz API pogody | [openweathermap.org](https://openweathermap.org/api) (darmowy) |
| `GOOGLE_CALENDAR_API_KEY` | Klucz API kalendarza | [Google Cloud Console](https://console.cloud.google.com/) |
| `GOOGLE_CALENDAR_ID` | ID kalendarza Google | Ustawienia kalendarza > Integracja |
| `RSS_FEEDS` | Lista kanalow RSS | Dowolne kanaly RSS |
| `STOCKS` | Symbole akcji (Yahoo Finance) | np. `AAPL`, `CDR.WA` |

## Uruchomienie

```bash
node server.js
```

Dashboard dostepny pod adresem: `http://localhost:3000`

## Struktura projektu

```
good_morning/
├── server.js                 # Backend Express (proxy API)
├── package.json
├── public/
│   ├── index.html            # Strona glowna dashboardu
│   ├── app.js                # Logika frontendowa
│   ├── config.js             # Twoja konfiguracja (gitignored)
│   └── config.example.js     # Wzorcowy plik konfiguracji
└── .gitignore
```

## Technologie

- **Backend:** Node.js, Express, rss-parser, node-fetch
- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **API:** OpenWeatherMap, Zonda Crypto, Yahoo Finance, Google Calendar
