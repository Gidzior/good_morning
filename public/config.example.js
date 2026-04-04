// ============================================
// KONFIGURACJA DASHBOARDU - UZUPEŁNIJ SWOJE DANE
// Skopiuj ten plik jako config.js i uzupełnij wartości
// ============================================

const CONFIG = {
  // --- Pogoda (OpenWeatherMap) ---
  // Zarejestruj się na https://openweathermap.org/api i wklej klucz API
  WEATHER_API_KEY: 'TWOJ_KLUCZ_OPENWEATHERMAP',
  WEATHER_CITY: 'Warszawa',
  WEATHER_COUNTRY: 'PL',

  // --- Google Calendar ---
  // Wklej swój publiczny Google Calendar ID
  // Instrukcja: Ustawienia kalendarza > Integracja > Publiczny adres URL (kalendarz musi być publiczny)
  // Lub użyj Google Calendar API key + calendar ID
  GOOGLE_CALENDAR_API_KEY: 'TWOJ_KLUCZ_GOOGLE_CALENDAR',
  GOOGLE_CALENDAR_ID: 'primary', // np. 'twoj.email@gmail.com'

  // --- Kanały RSS ---
  // Dodaj swoje ulubione kanały RSS (po 3-4 artykuły z każdego)
  RSS_FEEDS: [
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'Niebezpiecznik', url: 'https://niebezpiecznik.pl/feed/' },
  ],
  RSS_ARTICLES_PER_FEED: 4,

  // --- Akcje (Yahoo Finance symbole) ---
  STOCKS: [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'CDR.WA', name: 'CD Projekt' },
  ],

  // --- Odświeżanie (w milisekundach) ---
  REFRESH_INTERVAL: 3 * 60 * 60 * 1000, // 3 godziny

  // --- Lokalizacja (do pogody) ---
  LATITUDE: 52.2297,
  LONGITUDE: 21.0122,
};
