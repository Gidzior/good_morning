// ============================================
// GOOD MORNING DASHBOARD - app.js
// ============================================

// --- Helpers ---
function $(id) { return document.getElementById(id); }

function formatTime(date) {
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  return date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDayShort(date) {
  return date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min temu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} godz. temu`;
  return `${Math.floor(hrs / 24)} dni temu`;
}

function showError(elementId, msg) {
  $(elementId).innerHTML = `<div class="error-msg">${msg}</div>`;
}

// --- Header clock ---
function updateClock() {
  const now = new Date();
  $('header-date').textContent = formatDate(now);
  $('header-time').textContent = formatTime(now);
}
setInterval(updateClock, 1000);
updateClock();

// --- Greeting based on time ---
function updateGreeting() {
  const h = new Date().getHours();
  const el = document.querySelector('.header h1');
  if (h < 6) el.textContent = 'Dobranoc';
  else if (h < 12) el.textContent = 'Dzien Dobry';
  else if (h < 18) el.textContent = 'Dzien Dobry';
  else el.textContent = 'Dobry Wieczor';
}
updateGreeting();

// ============================================
// 1. POGODA (OpenWeatherMap via backend)
// ============================================
async function loadWeather() {
  const key = CONFIG.WEATHER_API_KEY;
  if (!key || key === 'TWOJ_KLUCZ_OPENWEATHERMAP') {
    $('weather-current').innerHTML = `
      <div class="weather-main">
        <div>
          <div class="weather-temp">--°C</div>
          <div class="weather-desc">Uzupelnij WEATHER_API_KEY w config.js</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
            Zarejestruj sie na <a href="https://openweathermap.org/api" target="_blank" style="color:var(--accent-light)">openweathermap.org</a> (darmowe)
          </div>
        </div>
      </div>`;
    $('weather-forecast').innerHTML = '<div class="error-msg">Brak klucza API pogody</div>';
    return;
  }

  try {
    const res = await fetch(`/api/weather?apiKey=${key}&city=${CONFIG.WEATHER_CITY}&country=${CONFIG.WEATHER_COUNTRY}`);
    const { current: data, forecast: fData } = await res.json();

    if (data.cod !== 200) throw new Error(data.message);

    $('weather-current').innerHTML = `
      <div class="weather-main">
        <img class="weather-icon" src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png" alt="">
        <div>
          <div class="weather-temp">${Math.round(data.main.temp)}°C</div>
          <div class="weather-desc">${data.weather[0].description}</div>
        </div>
      </div>
      <div class="weather-details">
        <div class="weather-detail">
          <div class="label">Odczuwalna</div>
          <div class="value">${Math.round(data.main.feels_like)}°</div>
        </div>
        <div class="weather-detail">
          <div class="label">Wilgotnosc</div>
          <div class="value">${data.main.humidity}%</div>
        </div>
        <div class="weather-detail">
          <div class="label">Wiatr</div>
          <div class="value">${Math.round(data.wind.speed * 3.6)} km/h</div>
        </div>
      </div>`;

    // Forecast for today
    const today = new Date().toDateString();
    let forecasts = fData.list.filter(item =>
      new Date(item.dt * 1000).toDateString() === today
    ).slice(0, 5);

    if (forecasts.length === 0) {
      const tomorrow = new Date(Date.now() + 86400000).toDateString();
      forecasts = fData.list.filter(item =>
        new Date(item.dt * 1000).toDateString() === tomorrow
      ).slice(0, 5);
    }

    if (forecasts.length === 0) {
      $('weather-forecast').innerHTML = '<div class="cal-empty">Brak danych prognozy</div>';
      return;
    }

    $('weather-forecast').innerHTML = forecasts.map(item => {
      const time = formatTime(new Date(item.dt * 1000));
      return `
        <div class="forecast-row">
          <span class="time">${time}</span>
          <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="">
          <span class="temp">${Math.round(item.main.temp)}°C</span>
          <span class="desc">${item.weather[0].description}</span>
        </div>`;
    }).join('');
  } catch (e) {
    showError('weather-current', `Blad pogody: ${e.message}`);
    showError('weather-forecast', `Blad prognozy: ${e.message}`);
  }
}

// ============================================
// 2. GOOGLE CALENDAR
// ============================================
async function loadCalendar() {
  const key = CONFIG.GOOGLE_CALENDAR_API_KEY;
  const calId = CONFIG.GOOGLE_CALENDAR_ID;

  if (!key || key === 'TWOJ_KLUCZ_GOOGLE_CALENDAR') {
    $('calendar').innerHTML = `
      <div class="cal-empty">
        Uzupelnij GOOGLE_CALENDAR_API_KEY i GOOGLE_CALENDAR_ID w config.js<br>
        <span style="font-size:12px;color:var(--text-muted);">
          Instrukcja: <a href="https://console.cloud.google.com/" target="_blank" style="color:var(--accent-light)">Google Cloud Console</a>
          → Calendar API → Create API Key
        </span>
      </div>`;
    return;
  }

  try {
    const now = new Date();
    const timeMin = now.toISOString();
    const end = new Date(now);
    end.setDate(end.getDate() + 3);
    const timeMax = end.toISOString();

    const res = await fetch(`/api/calendar?apiKey=${key}&calendarId=${encodeURIComponent(calId)}&timeMin=${timeMin}&timeMax=${timeMax}`);
    const data = await res.json();

    if (data.error) throw new Error(data.error.message);

    const events = data.items || [];

    // Group by day
    const days = {};
    for (let i = 0; i < 3; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dayKey = d.toDateString();
      days[dayKey] = { label: i === 0 ? 'Dzis' : i === 1 ? 'Jutro' : formatDayShort(d), events: [] };
    }

    events.forEach(ev => {
      const start = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date);
      const dayKey = start.toDateString();
      if (days[dayKey]) {
        days[dayKey].events.push(ev);
      }
    });

    let html = '';
    for (const [, day] of Object.entries(days)) {
      html += `<div class="cal-day"><div class="cal-day-header">${day.label}</div>`;
      if (day.events.length === 0) {
        html += '<div class="cal-empty">Brak wydarzen</div>';
      } else {
        day.events.forEach(ev => {
          let time = 'Caly dzien';
          if (ev.start.dateTime) {
            const s = new Date(ev.start.dateTime);
            const e = new Date(ev.end.dateTime);
            time = `${formatTime(s)} - ${formatTime(e)}`;
          }
          html += `
            <div class="cal-event">
              <span class="time">${time}</span>
              <span class="title">${ev.summary || '(bez tytulu)'}</span>
            </div>`;
        });
      }
      html += '</div>';
    }

    $('calendar').innerHTML = html;
  } catch (e) {
    showError('calendar', `Blad kalendarza: ${e.message}`);
  }
}

// ============================================
// 3. RSS FEEDS (via backend)
// ============================================
async function loadRSS() {
  const feeds = CONFIG.RSS_FEEDS;
  if (!feeds || feeds.length === 0) {
    $('rss-articles').innerHTML = '<div class="cal-empty">Dodaj kanaly RSS w config.js</div>';
    return;
  }

  let allArticles = [];

  for (const feed of feeds) {
    try {
      const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
      const data = await res.json();

      const items = (data.items || []).slice(0, CONFIG.RSS_ARTICLES_PER_FEED || 4);
      items.forEach(item => {
        allArticles.push({
          title: item.title || '',
          link: item.link || '#',
          pubDate: item.pubDate || item.isoDate || '',
          source: feed.name
        });
      });
    } catch (e) {
      console.warn(`RSS error for ${feed.name}:`, e);
    }
  }

  if (allArticles.length === 0) {
    $('rss-articles').innerHTML = '<div class="error-msg">Nie udalo sie pobrac artykulow RSS</div>';
    return;
  }

  allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  $('rss-articles').innerHTML = allArticles.map(a => `
    <div class="article">
      <a href="${a.link}" target="_blank">${a.title}</a>
      <div class="meta">
        <span class="source">${a.source}</span>
        <span>${a.pubDate ? timeAgo(a.pubDate) : ''}</span>
      </div>
    </div>
  `).join('');
}

// ============================================
// 4. BTC z Zonda w PLN (via backend)
// ============================================
async function loadBTC() {
  try {
    const res = await fetch('/api/btc');
    const data = await res.json();

    if (data.status !== 'Ok') throw new Error('Zonda API error');

    const ticker = data.ticker;
    const price = parseFloat(ticker.rate);
    const prevPrice = parseFloat(ticker.previousRate);
    const change = ((price - prevPrice) / prevPrice * 100);
    const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    const changeSign = change > 0 ? '+' : '';

    const bid = parseFloat(ticker.highestBid);
    const ask = parseFloat(ticker.lowestAsk);

    $('btc').innerHTML = `
      <div class="ticker">
        <div class="ticker-name">
          <span class="symbol">BTC / PLN</span>
          <span class="full-name">Bitcoin</span>
        </div>
        <div class="ticker-price">
          <div class="price">${price.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zl</div>
          <div class="change ${changeClass}">${changeSign}${change.toFixed(2)}%</div>
        </div>
      </div>
      <div style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-muted);padding:4px 0;">
          <span>Bid</span><span style="color:var(--text)">${bid.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zl</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-muted);padding:4px 0;">
          <span>Ask</span><span style="color:var(--text)">${ask.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zl</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-muted);padding:4px 0;">
          <span>Spread</span><span style="color:var(--text)">${(ask - bid).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zl</span>
        </div>
      </div>`;
  } catch (e) {
    showError('btc', `Blad pobierania BTC: ${e.message}`);
  }
}

// ============================================
// 5. AKCJE (via backend)
// ============================================
async function loadStocks() {
  const stocks = CONFIG.STOCKS;
  if (!stocks || stocks.length === 0) {
    $('stocks').innerHTML = '<div class="cal-empty">Dodaj akcje w config.js</div>';
    return;
  }

  let html = '';

  for (const stock of stocks) {
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(stock.symbol)}`);
      const data = await res.json();

      const meta = data.chart.result[0].meta;
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose;
      const change = ((price - prevClose) / prevClose * 100);
      const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
      const changeSign = change > 0 ? '+' : '';
      const currency = meta.currency || 'USD';

      html += `
        <div class="ticker">
          <div class="ticker-name">
            <span class="symbol">${stock.symbol}</span>
            <span class="full-name">${stock.name}</span>
          </div>
          <div class="ticker-price">
            <div class="price">${price.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}</div>
            <div class="change ${changeClass}">${changeSign}${change.toFixed(2)}%</div>
          </div>
        </div>`;
    } catch (e) {
      html += `
        <div class="ticker">
          <div class="ticker-name">
            <span class="symbol">${stock.symbol}</span>
            <span class="full-name">${stock.name}</span>
          </div>
          <div class="ticker-price">
            <div class="error-msg">Blad</div>
          </div>
        </div>`;
    }
  }

  $('stocks').innerHTML = html || '<div class="error-msg">Nie udalo sie pobrac kursow</div>';
}

// ============================================
// 6. CYTAT DNIA
// ============================================
async function loadQuote() {
  try {
    const res = await fetch('https://api.quotable.io/quotes/random?limit=1');
    if (!res.ok) throw new Error('API down');
    const data = await res.json();

    if (data && data.length > 0) {
      const q = data[0];
      $('quote').innerHTML = `
        <div class="quote-text">"${q.content}"</div>
        <div class="quote-author">— ${q.author}</div>`;
      return;
    }
    throw new Error('No quote');
  } catch (e) {
    const quotes = [
      { text: 'Jedynym sposobem na robienie wielkiej pracy jest kochanie tego, co robisz.', author: 'Steve Jobs' },
      { text: 'Sukces to nie klucz do szczescia. Szczescie to klucz do sukcesu.', author: 'Albert Schweitzer' },
      { text: 'Nie czekaj. Czas nigdy nie bedzie idealny.', author: 'Napoleon Hill' },
      { text: 'Kazdy dzien to nowa szansa, aby zmienic swoje zycie.', author: 'Anonim' },
      { text: 'Prostota jest ostatecznym wyrafinowaniem.', author: 'Leonardo da Vinci' },
      { text: 'Jedyna rzecz, ktorej musimy sie bac, to sam strach.', author: 'Franklin D. Roosevelt' },
      { text: 'Zycie to 10% tego co Ci sie przydarza i 90% tego jak na to reagujesz.', author: 'Charles R. Swindoll' },
    ];
    const q = quotes[new Date().getDate() % quotes.length];
    $('quote').innerHTML = `
      <div class="quote-text">"${q.text}"</div>
      <div class="quote-author">— ${q.author}</div>`;
  }
}

// ============================================
// 7. IMIENINY (via backend)
// ============================================
async function loadNameDay() {
  try {
    const res = await fetch('/api/nameday');
    const data = await res.json();

    if (data.results && data.results.namedays && data.results.namedays.pl) {
      $('nameday').innerHTML = `<div class="nameday-text">🎉 ${data.results.namedays.pl}</div>`;
    } else {
      throw new Error('No data');
    }
  } catch (e) {
    $('nameday').innerHTML = `<div class="nameday-text" style="color:var(--text-muted)">Nie udalo sie pobrac imienin</div>`;
  }
}

// ============================================
// 8. WIADOMOSCI PL (via backend)
// ============================================
async function loadNewsPL() {
  try {
    const res = await fetch('/api/news-pl');
    const data = await res.json();
    const items = (data.items || []).slice(0, 5);

    if (items.length === 0) {
      $('news-pl').innerHTML = '<div class="cal-empty">Brak wiadomosci</div>';
      return;
    }

    $('news-pl').innerHTML = items.map(item => `
      <div class="article">
        <a href="${item.link}" target="_blank">${item.title}</a>
        <div class="meta">
          <span>${item.pubDate ? timeAgo(item.pubDate) : ''}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    showError('news-pl', 'Nie udalo sie pobrac wiadomosci');
  }
}

// ============================================
// REFRESH LOGIC
// ============================================
let refreshTimer = null;
let nextRefreshTime = null;

function updateCountdown() {
  if (!nextRefreshTime) return;
  const diff = nextRefreshTime - Date.now();
  if (diff <= 0) return;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  $('next-update').textContent = `${h}h ${m}min`;
}

async function refreshAll() {
  $('last-update').textContent = formatTime(new Date());

  await Promise.allSettled([
    loadWeather(),
    loadCalendar(),
    loadRSS(),
    loadBTC(),
    loadStocks(),
    loadQuote(),
    loadNameDay(),
    loadNewsPL(),
  ]);

  if (refreshTimer) clearInterval(refreshTimer);
  nextRefreshTime = Date.now() + CONFIG.REFRESH_INTERVAL;
  refreshTimer = setInterval(() => {
    updateCountdown();
    if (Date.now() >= nextRefreshTime) {
      refreshAll();
    }
  }, 60000);
  updateCountdown();
}

// --- Start ---
refreshAll();
