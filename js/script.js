// ==================== CONFIGURATION ====================
const CONFIG = {
  API_KEY: '284f4ee1b8c4a2fea9b41e8e0ff0ee58',
  BASE_URL: 'https://api.openweathermap.org/data/2.5',
  GEO_URL: 'https://api.openweathermap.org/geo/1.0',
  ONECALL_URL: 'https://api.openweathermap.org/data/3.0/onecall',
  ICON_URL: 'https://openweathermap.org/img/wn',
  MAX_HISTORY: 8,
  DEBOUNCE_MS: 350
};

// ==================== STATE ====================
const state = {
  unit: localStorage.getItem('weatherUnit') || 'metric',
  theme: localStorage.getItem('weatherTheme') || 'light',
  history: JSON.parse(localStorage.getItem('weatherHistory') || '[]'),
  currentWeather: null,
  forecastData: null,
  oneCallData: null,
  displayDays: 5,
  currentLat: null,
  currentLon: null
};

// ==================== DOM ELEMENTS ====================
const $ = id => document.getElementById(id);
const dom = {
  preloader: $('preloader'),
  weatherBg: $('weatherBg'),
  weatherParticles: $('weatherParticles'),
  searchInput: $('searchInput'),
  searchBtn: $('searchBtn'),
  locationBtn: $('locationBtn'),
  autocompleteList: $('autocompleteList'),
  searchHistory: $('searchHistory'),
  skeletonLoader: $('skeletonLoader'),
  errorContainer: $('errorContainer'),
  errorIcon: $('errorIcon'),
  errorTitle: $('errorTitle'),
  errorMessage: $('errorMessage'),
  errorRetry: $('errorRetry'),
  welcomeSection: $('welcomeSection'),
  weatherContent: $('weatherContent'),
  unitToggle: $('unitToggle'),
  themeToggle: $('themeToggle'),
  themeCircle: $('themeCircle'),
  toast: $('toast'),
  toastIcon: $('toastIcon'),
  toastMessage: $('toastMessage'),
  // Weather display
  cityName: $('cityName'),
  countryName: $('countryName'),
  weatherDate: $('weatherDate'),
  weatherIcon: $('weatherIcon'),
  tempDisplay: $('tempDisplay'),
  weatherDesc: $('weatherDesc'),
  feelsLike: $('feelsLike'),
  humidity: $('humidity'),
  windSpeed: $('windSpeed'),
  visibility: $('visibility'),
  pressure: $('pressure'),
  tempMax: $('tempMax'),
  tempMin: $('tempMin'),
  uvIndex: $('uvIndex'),
  uvLevel: $('uvLevel'),
  uvIndicator: $('uvIndicator'),
  windGust: $('windGust'),
  windDir: $('windDir'),
  windArrow: $('windArrow'),
  rainChance: $('rainChance'),
  clouds: $('clouds'),
  sunrise: $('sunrise'),
  sunset: $('sunset'),
  sunPosition: $('sunPosition'),
  hourlyScroll: $('hourlyScroll'),
  forecastGrid: $('forecastGrid')
};

// ==================== PRELOADER ====================
window.addEventListener('load', () => {
  setTimeout(() => {
    dom.preloader.classList.add('hidden');
  }, 2200);
});

// ==================== INITIALIZATION ====================
function init() {
  applyTheme(state.theme);
  updateUnitButton();
  renderHistory();
  setupEventListeners();
  
  // Try loading last searched city
  const lastCity = localStorage.getItem('lastCity');
  if (lastCity) {
    fetchWeatherByCity(lastCity);
  }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Search
  dom.searchBtn.addEventListener('click', handleSearch);
  dom.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  
  // Autocomplete with debounce
  let debounceTimer;
  dom.searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    if (query.length < 2) {
      dom.autocompleteList.classList.remove('active');
      return;
    }
    debounceTimer = setTimeout(() => fetchAutocomplete(query), CONFIG.DEBOUNCE_MS);
  });
  
  // Close autocomplete on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-wrapper')) {
      dom.autocompleteList.classList.remove('active');
    }
  });
  
  // Location
  dom.locationBtn.addEventListener('click', handleGeolocation);
  
  // Unit toggle
  dom.unitToggle.addEventListener('click', toggleUnit);
  
  // Theme toggle
  dom.themeToggle.addEventListener('click', toggleTheme);
  
  // Error retry
  dom.errorRetry.addEventListener('click', () => {
    hideError();
    dom.searchInput.focus();
  });
  
  // Forecast toggle
  document.querySelectorAll('.forecast-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.forecast-toggle-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.displayDays = parseInt(e.target.dataset.days);
      if (state.forecastData) {
        renderForecast(state.forecastData);
      }
    });
  });
}

// ==================== SEARCH HANDLER ====================
function handleSearch() {
  const city = dom.searchInput.value.trim();
  if (!city) {
    showToast('⚠️', 'Please enter a city name');
    dom.searchInput.focus();
    return;
  }
  dom.autocompleteList.classList.remove('active');
  fetchWeatherByCity(city);
}

// ==================== GEOLOCATION ====================
function handleGeolocation() {
  if (!navigator.geolocation) {
    showToast('❌', 'Geolocation is not supported by your browser');
    return;
  }
  
  showToast('📍', 'Getting your location...');
  dom.locationBtn.disabled = true;
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      await fetchWeatherByCoords(latitude, longitude);
      dom.locationBtn.disabled = false;
    },
    (error) => {
      dom.locationBtn.disabled = false;
      let msg = 'Unable to get your location';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          msg = 'Location permission denied. Please enable it in settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          msg = 'Location unavailable';
          break;
        case error.TIMEOUT:
          msg = 'Location request timed out';
          break;
      }
      showToast('❌', msg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

// ==================== API CALLS ====================
async function fetchWeatherByCity(city) {
  showLoading();
  
  try {
    // Fetch current weather
    const weatherRes = await fetch(
      `${CONFIG.BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${CONFIG.API_KEY}&units=${state.unit}`
    );
    
    if (!weatherRes.ok) {
      if (weatherRes.status === 404) {
        throw new Error('CITY_NOT_FOUND');
      }
      throw new Error(`HTTP ${weatherRes.status}`);
    }
    
    const weatherData = await weatherRes.json();
    state.currentWeather = weatherData;
    state.currentLat = weatherData.coord.lat;
    state.currentLon = weatherData.coord.lon;
    
    // Fetch 5-day forecast
    const forecastRes = await fetch(
      `${CONFIG.BASE_URL}/forecast?lat=${weatherData.coord.lat}&lon=${weatherData.coord.lon}&appid=${CONFIG.API_KEY}&units=${state.unit}`
    );
    
    if (!forecastRes.ok) throw new Error('Forecast fetch failed');
    
    const forecastData = await forecastRes.json();
    state.forecastData = forecastData;
    
    // Try OneCall API for UV index and extra data (might fail with free key)
    try {
      const oneCallRes = await fetch(
        `${CONFIG.BASE_URL}/onecall?lat=${weatherData.coord.lat}&lon=${weatherData.coord.lon}&appid=${CONFIG.API_KEY}&units=${state.unit}&exclude=minutely,alerts`
      );
      if (oneCallRes.ok) {
        state.oneCallData = await oneCallRes.json();
      } else {
        state.oneCallData = null;
      }
    } catch {
      state.oneCallData = null;
    }
    
    // Save to history
    addToHistory(weatherData.name);
    localStorage.setItem('lastCity', weatherData.name);
    
    // Render everything
    renderCurrentWeather(weatherData);
    renderDetailCards(weatherData);
    renderSunTimes(weatherData);
    renderHourlyForecast(forecastData);
    renderForecast(forecastData);
    updateBackground(weatherData.weather[0].main);
    createWeatherParticles(weatherData.weather[0].main);
    
    hideLoading();
    showWeatherContent();
    
  } catch (error) {
    hideLoading();
    handleFetchError(error);
  }
}

async function fetchWeatherByCoords(lat, lon) {
  showLoading();
  
  try {
    const weatherRes = await fetch(
      `${CONFIG.BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=${state.unit}`
    );
    
    if (!weatherRes.ok) throw new Error(`HTTP ${weatherRes.status}`);
    
    const weatherData = await weatherRes.json();
    state.currentWeather = weatherData;
    state.currentLat = lat;
    state.currentLon = lon;
    
    const forecastRes = await fetch(
      `${CONFIG.BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=${state.unit}`
    );
    
    if (!forecastRes.ok) throw new Error('Forecast fetch failed');
    
    const forecastData = await forecastRes.json();
    state.forecastData = forecastData;
    
    try {
      const oneCallRes = await fetch(
        `${CONFIG.BASE_URL}/onecall?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=${state.unit}&exclude=minutely,alerts`
      );
      if (oneCallRes.ok) {
        state.oneCallData = await oneCallRes.json();
      } else {
        state.oneCallData = null;
      }
    } catch {
      state.oneCallData = null;
    }
    
    addToHistory(weatherData.name);
    localStorage.setItem('lastCity', weatherData.name);
    dom.searchInput.value = weatherData.name;
    
    renderCurrentWeather(weatherData);
    renderDetailCards(weatherData);
    renderSunTimes(weatherData);
    renderHourlyForecast(forecastData);
    renderForecast(forecastData);
    updateBackground(weatherData.weather[0].main);
    createWeatherParticles(weatherData.weather[0].main);
    
    hideLoading();
    showWeatherContent();
    showToast('✅', `Weather loaded for ${weatherData.name}`);
    
  } catch (error) {
    hideLoading();
    handleFetchError(error);
  }
}

// ==================== AUTOCOMPLETE ====================
async function fetchAutocomplete(query) {
  try {
    const res = await fetch(
      `${CONFIG.GEO_URL}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${CONFIG.API_KEY}`
    );
    
    if (!res.ok) return;
    
    const data = await res.json();
    renderAutocomplete(data);
    
  } catch (err) {
    console.error('Autocomplete error:', err);
  }
}

function renderAutocomplete(results) {
  if (!results.length) {
    dom.autocompleteList.classList.remove('active');
    return;
  }
  
  dom.autocompleteList.innerHTML = results.map(r => `
    <div class="autocomplete-item" data-city="${r.name}" data-lat="${r.lat}" data-lon="${r.lon}">
      <span>📍</span>
      <span>${r.name}${r.state ? ', ' + r.state : ''}, ${r.country}</span>
    </div>
  `).join('');
  
  dom.autocompleteList.classList.add('active');
  
  dom.autocompleteList.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', () => {
      dom.searchInput.value = item.dataset.city;
      dom.autocompleteList.classList.remove('active');
      fetchWeatherByCoords(item.dataset.lat, item.dataset.lon);
    });
  });
}

// ==================== RENDER FUNCTIONS ====================
function renderCurrentWeather(data) {
  const { name, sys, weather, main, wind, visibility: vis, clouds: cl, dt, timezone } = data;
  
  dom.cityName.textContent = name;
  dom.countryName.innerHTML = `📍 ${getCountryName(sys.country)} ${getFlagEmoji(sys.country)}`;
  dom.weatherDate.textContent = formatDateTime(dt, timezone);
  dom.weatherIcon.textContent = getWeatherEmoji(weather[0].id, weather[0].icon);
  dom.tempDisplay.textContent = `${Math.round(main.temp)}°`;
  dom.weatherDesc.textContent = weather[0].description;
  dom.feelsLike.textContent = `Feels like ${Math.round(main.feels_like)}°${state.unit === 'metric' ? 'C' : 'F'}`;
  dom.humidity.textContent = `${main.humidity}%`;
  dom.windSpeed.textContent = `${wind.speed} ${state.unit === 'metric' ? 'm/s' : 'mph'}`;
  dom.visibility.textContent = `${(vis / 1000).toFixed(1)} km`;
  dom.pressure.textContent = `${main.pressure} hPa`;
}

function renderDetailCards(data) {
  const { main, wind, clouds: cl } = data;
  const unitSymbol = state.unit === 'metric' ? '°C' : '°F';
  const windUnit = state.unit === 'metric' ? 'm/s' : 'mph';
  
  dom.tempMax.textContent = `${Math.round(main.temp_max)}${unitSymbol}`;
  dom.tempMin.textContent = `${Math.round(main.temp_min)}${unitSymbol}`;
  dom.clouds.textContent = `${cl.all}%`;
  
  // Wind
  const gust = wind.gust ? wind.gust.toFixed(1) : wind.speed.toFixed(1);
  dom.windGust.textContent = `${gust} ${windUnit}`;
  dom.windDir.textContent = getWindDirection(wind.deg);
  dom.windArrow.style.transform = `translate(-50%, -100%) rotate(${wind.deg || 0}deg)`;
  
  // UV Index (estimate if no OneCall)
  if (state.oneCallData && state.oneCallData.current) {
    const uv = state.oneCallData.current.uvi;
    dom.uvIndex.textContent = uv.toFixed(1);
    dom.uvLevel.textContent = getUVLevel(uv);
    dom.uvIndicator.style.left = `${Math.min(uv / 12 * 100, 100)}%`;
  } else {
    // Estimate UV from clouds and time
    const estimatedUV = estimateUV(data);
    dom.uvIndex.textContent = estimatedUV.toFixed(1);
    dom.uvLevel.textContent = getUVLevel(estimatedUV);
    dom.uvIndicator.style.left = `${Math.min(estimatedUV / 12 * 100, 100)}%`;
  }
  
  // Rain chance from forecast
  if (state.forecastData && state.forecastData.list && state.forecastData.list[0]) {
    const pop = state.forecastData.list[0].pop || 0;
    dom.rainChance.textContent = `${Math.round(pop * 100)}%`;
  } else {
    dom.rainChance.textContent = `0%`;
  }
}

function renderSunTimes(data) {
  const { sys, timezone } = data;
  
  dom.sunrise.textContent = formatTime(sys.sunrise, timezone);
  dom.sunset.textContent = formatTime(sys.sunset, timezone);
  
  // Sun position
  const now = Date.now() / 1000;
  const dayLength = sys.sunset - sys.sunrise;
  const elapsed = now - sys.sunrise;
  let sunPercent = Math.max(0, Math.min(100, (elapsed / dayLength) * 100));
  
  if (now < sys.sunrise || now > sys.sunset) {
    sunPercent = now < sys.sunrise ? 0 : 100;
    dom.sunPosition.textContent = '🌙';
  } else {
    dom.sunPosition.textContent = '☀️';
  }
  
  dom.sunPosition.style.left = `${sunPercent}%`;
}

function renderHourlyForecast(data) {
  if (!data || !data.list) return;
  
  const hourlyItems = data.list.slice(0, 8);
  
  dom.hourlyScroll.innerHTML = hourlyItems.map((item, i) => {
    const temp = Math.round(item.main.temp);
    const icon = getWeatherEmoji(item.weather[0].id, item.weather[0].icon);
    const time = i === 0 ? 'Now' : formatHour(item.dt, data.city.timezone);
    const pop = Math.round((item.pop || 0) * 100);
    
    return `
      <div class="hourly-card ${i === 0 ? 'now' : ''}">
        <div class="hourly-time">${time}</div>
        <span class="hourly-icon">${icon}</span>
        <div class="hourly-temp">${temp}°</div>
        ${pop > 0 ? `<div class="hourly-pop">💧${pop}%</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderForecast(data) {
  if (!data || !data.list) return;
  
  // Group by day
  const dailyMap = {};
  data.list.forEach(item => {
    const date = new Date(item.dt * 1000).toDateString();
    if (!dailyMap[date]) {
      dailyMap[date] = {
        temps: [],
        icons: [],
        weather: [],
        pop: [],
        humidity: [],
        wind: [],
        dt: item.dt
      };
    }
    dailyMap[date].temps.push(item.main.temp);
    dailyMap[date].icons.push({ id: item.weather[0].id, icon: item.weather[0].icon });
    dailyMap[date].weather.push(item.weather[0].description);
    dailyMap[date].pop.push(item.pop || 0);
    dailyMap[date].humidity.push(item.main.humidity);
    dailyMap[date].wind.push(item.wind.speed);
  });
  
  const days = Object.entries(dailyMap).slice(0, state.displayDays);
  
  dom.forecastGrid.innerHTML = days.map(([dateStr, dayData], i) => {
    const high = Math.round(Math.max(...dayData.temps));
    const low = Math.round(Math.min(...dayData.temps));
    const midIndex = Math.floor(dayData.icons.length / 2);
    const icon = getWeatherEmoji(dayData.icons[midIndex].id, dayData.icons[midIndex].icon);
    const desc = dayData.weather[midIndex];
    const maxPop = Math.round(Math.max(...dayData.pop) * 100);
    const avgHumidity = Math.round(dayData.humidity.reduce((a, b) => a + b, 0) / dayData.humidity.length);
    const date = new Date(dayData.dt * 1000);
    const dayName = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateFormatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const unitSymbol = state.unit === 'metric' ? '°' : '°';
    
    return `
      <div class="forecast-card" style="animation-delay: ${i * 0.08}s">
        <div class="forecast-day">${dayName}</div>
        <div class="forecast-date">${dateFormatted}</div>
        <span class="forecast-icon">${icon}</span>
        <div class="forecast-temps">
          <span class="forecast-high">${high}${unitSymbol}</span>
          <span class="forecast-low">${low}${unitSymbol}</span>
        </div>
        <div class="forecast-desc">${desc}</div>
        <div class="forecast-extra-info">
          <span>💧${avgHumidity}%</span>
          <span>🌧️${maxPop}%</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== BACKGROUND & PARTICLES ====================
function updateBackground(weatherMain) {
  const bgClasses = ['clear', 'clouds', 'rain', 'snow', 'thunderstorm', 'mist'];
  dom.weatherBg.classList.remove(...bgClasses);
  
  const weather = weatherMain.toLowerCase();
  if (weather.includes('clear')) dom.weatherBg.classList.add('clear');
  else if (weather.includes('cloud')) dom.weatherBg.classList.add('clouds');
  else if (weather.includes('rain') || weather.includes('drizzle')) dom.weatherBg.classList.add('rain');
  else if (weather.includes('snow')) dom.weatherBg.classList.add('snow');
  else if (weather.includes('thunder')) dom.weatherBg.classList.add('thunderstorm');
  else if (weather.includes('mist') || weather.includes('fog') || weather.includes('haze') || weather.includes('smoke')) dom.weatherBg.classList.add('mist');
  else dom.weatherBg.classList.add('clear');
}

function createWeatherParticles(weatherMain) {
  dom.weatherParticles.innerHTML = '';
  
  const weather = weatherMain.toLowerCase();
  
  if (weather.includes('rain') || weather.includes('drizzle')) {
    createRainParticles();
  } else if (weather.includes('snow')) {
    createSnowParticles();
  } else if (weather.includes('clear')) {
    createSunParticles();
  } else if (weather.includes('cloud')) {
    createCloudParticles();
  } else if (weather.includes('thunder')) {
    createRainParticles();
    createLightning();
  }
}

function createRainParticles() {
  for (let i = 0; i < 80; i++) {
    const drop = document.createElement('div');
    drop.className = 'rain-drop';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.height = `${Math.random() * 20 + 10}px`;
    drop.style.animationDuration = `${Math.random() * 0.5 + 0.5}s`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    drop.style.opacity = Math.random() * 0.4 + 0.2;
    dom.weatherParticles.appendChild(drop);
  }
}

function createSnowParticles() {
  const flakes = ['❄', '❅', '❆', '•'];
  for (let i = 0; i < 50; i++) {
    const flake = document.createElement('div');
    flake.className = 'snow-flake';
    flake.textContent = flakes[Math.floor(Math.random() * flakes.length)];
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.fontSize = `${Math.random() * 12 + 6}px`;
    flake.style.animationDuration = `${Math.random() * 5 + 5}s`;
    flake.style.animationDelay = `${Math.random() * 5}s`;
    dom.weatherParticles.appendChild(flake);
  }
}

function createSunParticles() {
  const ray = document.createElement('div');
  ray.className = 'sun-ray';
  dom.weatherParticles.appendChild(ray);
}

function createCloudParticles() {
  for (let i = 0; i < 4; i++) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud-float';
    cloud.textContent = '☁️';
    cloud.style.top = `${Math.random() * 40 + 5}%`;
    cloud.style.fontSize = `${Math.random() * 40 + 30}px`;
    cloud.style.animationDuration = `${Math.random() * 30 + 20}s`;
    cloud.style.animationDelay = `${Math.random() * 15}s`;
    dom.weatherParticles.appendChild(cloud);
  }
}

function createLightning() {
  const lightning = document.createElement('div');
  lightning.className = 'lightning';
  dom.weatherParticles.appendChild(lightning);
}

// ==================== SEARCH HISTORY ====================
function addToHistory(city) {
  const filtered = state.history.filter(c => c.toLowerCase() !== city.toLowerCase());
  filtered.unshift(city);
  state.history = filtered.slice(0, CONFIG.MAX_HISTORY);
  localStorage.setItem('weatherHistory', JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    dom.searchHistory.innerHTML = '';
    return;
  }
  
  dom.searchHistory.innerHTML = `
    <span class="history-label">Recent:</span>
    ${state.history.map(city => `
      <span class="history-chip" data-city="${city}">
        ${city}
        <span class="remove-chip" data-remove="${city}">✕</span>
      </span>
    `).join('')}
    <button class="clear-history" id="clearHistoryBtn">Clear all</button>
  `;
  
  // Click to search
  dom.searchHistory.querySelectorAll('.history-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-chip')) {
        e.stopPropagation();
        removeFromHistory(e.target.dataset.remove);
        return;
      }
      dom.searchInput.value = chip.dataset.city;
      fetchWeatherByCity(chip.dataset.city);
    });
  });
  
  // Clear all
  const clearBtn = document.getElementById('clearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.history = [];
      localStorage.setItem('weatherHistory', JSON.stringify(state.history));
      renderHistory();
      showToast('🗑️', 'Search history cleared');
    });
  }
}

function removeFromHistory(city) {
  state.history = state.history.filter(c => c !== city);
  localStorage.setItem('weatherHistory', JSON.stringify(state.history));
  renderHistory();
}

// ==================== THEME & UNITS ====================
function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(state.theme);
  localStorage.setItem('weatherTheme', state.theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  dom.themeCircle.textContent = theme === 'light' ? '☀️' : '🌙';
}

function toggleUnit() {
  state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
  localStorage.setItem('weatherUnit', state.unit);
  updateUnitButton();
  
  // Refetch if we have current data
  if (state.currentWeather) {
    fetchWeatherByCity(state.currentWeather.name);
  }
}

function updateUnitButton() {
  dom.unitToggle.textContent = state.unit === 'metric' ? '°C' : '°F';
}

// ==================== UI STATE MANAGEMENT ====================
function showLoading() {
  dom.welcomeSection.style.display = 'none';
  dom.weatherContent.classList.remove('active');
  dom.errorContainer.classList.remove('active');
  dom.skeletonLoader.classList.add('active');
}

function hideLoading() {
  dom.skeletonLoader.classList.remove('active');
}

function showWeatherContent() {
  dom.welcomeSection.style.display = 'none';
  dom.errorContainer.classList.remove('active');
  dom.weatherContent.classList.add('active');
}

function showError(icon, title, message) {
  dom.welcomeSection.style.display = 'none';
  dom.weatherContent.classList.remove('active');
  dom.errorIcon.textContent = icon;
  dom.errorTitle.textContent = title;
  dom.errorMessage.textContent = message;
  dom.errorContainer.classList.add('active');
}

function hideError() {
  dom.errorContainer.classList.remove('active');
  if (!state.currentWeather) {
    dom.welcomeSection.style.display = '';
  } else {
    dom.weatherContent.classList.add('active');
  }
}

function handleFetchError(error) {
  console.error('Fetch error:', error);
  
  if (error.message === 'CITY_NOT_FOUND') {
    showError('🏙️', 'City Not Found', 'We couldn\'t find weather data for that location. Please check the spelling and try again.');
  } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    showError('🌐', 'Network Error', 'Unable to connect. Please check your internet connection and try again.');
  } else {
    showError('⚠️', 'Something Went Wrong', `An unexpected error occurred: ${error.message}. Please try again.`);
  }
}

// ==================== TOAST ====================
function showToast(icon, message) {
  dom.toastIcon.textContent = icon;
  dom.toastMessage.textContent = message;
  dom.toast.classList.add('show');
  
  setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 3500);
}

// ==================== UTILITY FUNCTIONS ====================
function getWeatherEmoji(id, iconCode) {
  const isNight = iconCode && iconCode.includes('n');
  
  if (id >= 200 && id < 300) return '⛈️';
  if (id >= 300 && id < 400) return '🌧️';
  if (id >= 500 && id < 511) return '🌧️';
  if (id === 511) return '🧊';
  if (id >= 520 && id < 600) return '🌧️';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌫️';
  if (id === 800) return isNight ? '🌙' : '☀️';
  if (id === 801) return isNight ? '🌙' : '🌤️';
  if (id === 802) return '⛅';
  if (id === 803 || id === 804) return '☁️';
  return '🌤️';
}

function getCountryName(code) {
  const countries = {
    US: 'United States', GB: 'United Kingdom', IN: 'India', CA: 'Canada',
    AU: 'Australia', DE: 'Germany', FR: 'France', JP: 'Japan', CN: 'China',
    BR: 'Brazil', RU: 'Russia', IT: 'Italy', ES: 'Spain', MX: 'Mexico',
    KR: 'South Korea', NL: 'Netherlands', CH: 'Switzerland', SE: 'Sweden',
    NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland', BE: 'Belgium',
    AT: 'Austria', IE: 'Ireland', NZ: 'New Zealand', SG: 'Singapore',
    AE: 'UAE', SA: 'Saudi Arabia', EG: 'Egypt', ZA: 'South Africa',
    NG: 'Nigeria', KE: 'Kenya', AR: 'Argentina', CL: 'Chile', CO: 'Colombia',
    PK: 'Pakistan', BD: 'Bangladesh', TH: 'Thailand', VN: 'Vietnam',
    PH: 'Philippines', MY: 'Malaysia', ID: 'Indonesia', TR: 'Turkey',
    UA: 'Ukraine', CZ: 'Czech Republic', PT: 'Portugal', GR: 'Greece',
    HU: 'Hungary', RO: 'Romania', IL: 'Israel'
  };
  return countries[code] || code;
}

function getFlagEmoji(countryCode) {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function formatDateTime(timestamp, timezone) {
  const date = new Date((timestamp + timezone) * 1000);
  const options = { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC'
  };
  return date.toLocaleDateString('en-US', options);
}

function formatTime(timestamp, timezone) {
  const date = new Date((timestamp + timezone) * 1000);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit', 
    hour12: true,
    timeZone: 'UTC'
  });
}

function formatHour(timestamp, timezone) {
  const date = new Date((timestamp + timezone) * 1000);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    hour12: true,
    timeZone: 'UTC'
  });
}

function getWindDirection(deg) {
  if (deg === undefined || deg === null) return 'N/A';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return dirs[index];
}

function getUVLevel(uv) {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

function estimateUV(data) {
  const clouds = data.clouds ? data.clouds.all : 0;
  const now = Date.now() / 1000;
  const sunrise = data.sys.sunrise;
  const sunset = data.sys.sunset;
  
  if (now < sunrise || now > sunset) return 0;
  
  const dayLength = sunset - sunrise;
  const midday = sunrise + dayLength / 2;
  const distFromMidday = Math.abs(now - midday) / (dayLength / 2);
  const solarFactor = Math.max(0, 1 - distFromMidday);
  const cloudFactor = 1 - (clouds / 100) * 0.75;
  const baseUV = 10;
  
  return Math.max(0, baseUV * solarFactor * cloudFactor);
}

// ==================== INITIALIZE ====================
init();
