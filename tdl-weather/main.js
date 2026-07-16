const MAIHAMA = { id: "maihama", name: "東京ディズニーリゾート", lat: 35.6268, lon: 139.8821 };

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, function(match) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match];
  });
}

let locations = JSON.parse(localStorage.getItem('weatherLocations')) || [];
locations = locations.filter(loc => loc.id !== 1 && loc.name !== "舞浜" && loc.name !== "東京ディズニーリゾート");
localStorage.setItem('weatherLocations', JSON.stringify(locations));

let currentLocation = MAIHAMA;
let weatherData = null;
let targetIndex = 3; 

const savedLocationId = localStorage.getItem('lastLocationId');
if (savedLocationId) {
  if (savedLocationId === "maihama") {
    currentLocation = MAIHAMA;
  } else {
    const found = locations.find(loc => loc.id == savedLocationId);
    if (found) currentLocation = found;
  }
}

async function searchAndAddLocation() {
  const input = document.getElementById('loc-search');
  const btn = document.getElementById('btn-search');
  const query = input.value.trim();
  
  if (!query) {
    alert("地名を入力してください！");
    return;
  }
  
  btn.disabled = true;
  btn.innerText = "検索中...";
  
  const gsiApi = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
  
  try {
    const res = await fetch(gsiApi);
    const data = await res.json();
    
    if (!data || data.length === 0) {
      alert("地点が見つかりませんでした。別のキーワードで試してください。");
      btn.disabled = false;
      btn.innerText = "検索＆追加";
      return;
    }
    
    const bestHit = data[0];
    const lon = bestHit.geometry.coordinates[0];
    const lat = bestHit.geometry.coordinates[1];
    
    let displayName = query.length > 8 ? query.substring(0, 8) + "..." : query;
    displayName = escapeHTML(displayName); 

    const newLoc = {
      id: Date.now(),
      name: displayName,
      lat: lat,
      lon: lon
    };
    
    locations.push(newLoc);
    localStorage.setItem('weatherLocations', JSON.stringify(locations));
    input.value = ''; 
    
    selectLocation(newLoc.id); 
  } catch(e) {
    alert("検索中にエラーが発生しました。");
  } finally {
    btn.disabled = false;
    btn.innerText = "検索＆追加";
  }
}

function addManualLocation() {
  const nameInput = document.getElementById('manual-name');
  const latInput = document.getElementById('manual-lat');
  const lonInput = document.getElementById('manual-lon');

  const rawName = nameInput.value.trim();
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);

  if (!rawName || isNaN(lat) || isNaN(lon)) {
    alert("地点名、緯度、経度を正しく入力してください！");
    return;
  }

  const name = escapeHTML(rawName); 
  const newLoc = { id: Date.now(), name: name, lat: lat, lon: lon };
  locations.push(newLoc);
  localStorage.setItem('weatherLocations', JSON.stringify(locations));
  
  nameInput.value = ''; latInput.value = ''; lonInput.value = '';
  selectLocation(newLoc.id);
}

function selectMaihama() {
  if (currentLocation.id === "maihama") return;
  currentLocation = MAIHAMA;
  localStorage.setItem('lastLocationId', currentLocation.id); 
  document.getElementById('btn-maihama').classList.add('active-loc');
  renderLocationList();
  getData();
}

function selectLocation(id) {
  currentLocation = locations.find(loc => loc.id === id);
  localStorage.setItem('lastLocationId', currentLocation.id); 
  document.getElementById('btn-maihama').classList.remove('active-loc');
  renderLocationList();
  getData();
}

function removeLocation(id, event) {
  event.stopPropagation();
  locations = locations.filter(loc => loc.id !== id);
  localStorage.setItem('weatherLocations', JSON.stringify(locations));

  if (currentLocation.id === id) selectMaihama();
  else renderLocationList();
}

function renderLocationList() {
  const list = document.getElementById('location-list');
  list.innerHTML = '';
  
  locations.forEach(loc => {
    const li = document.createElement('li');
    if (loc.id === currentLocation.id) li.className = 'active-loc';
    li.innerHTML = `
      <span onclick="selectLocation(${loc.id})">📍 ${loc.name}</span>
      <button class="btn-remove" onclick="removeLocation(${loc.id}, event)">✖</button>
    `;
    list.appendChild(li);
  });
}

async function getData() {
  const api = `https://api.open-meteo.com/v1/forecast?latitude=${currentLocation.lat}&longitude=${currentLocation.lon}&hourly=weather_code,temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset&wind_speed_unit=ms&timezone=Asia%2FTokyo&past_days=3`;
  
  const titleEl = document.getElementById('main-title');
  const originalTitle = isMaihama() ? `🏰 東京ディズニーリゾート 天気・ショー予想 🌋` : `📍 ${currentLocation.name} の天気予測`;
  titleEl.innerText = "データを取得中...";

  try {
    const res = await fetch(api);
    const data = await res.json();
    weatherData = data;
    
    titleEl.innerText = originalTitle;
    document.getElementById('daily-title').innerHTML = isMaihama() ? `📅 週間予測一覧 <small style="font-size: 0.8rem; color: var(--text-sub);">※日付タップで詳細表示</small>` : `📅 週間予測一覧`;
    
    document.getElementById('quick-links').style.display = isMaihama() ? 'flex' : 'none';
    document.getElementById('explanation-card').style.display = isMaihama() ? 'block' : 'none';

    setupSelectBox();
    renderAll();
    updateTheme();
  } catch(error) {
    console.error('データ取得失敗:', error);
    titleEl.innerText = "通信エラーが発生しました";
  }
}

function isMaihama() {
  return currentLocation.id === "maihama";
}

if (isMaihama()) {
  document.getElementById('btn-maihama').classList.add('active-loc');
}
renderLocationList();
getData();
setInterval(getData, 1000 * 60 * 60);

function updateClock() {
  const timeEl = document.getElementById('time');
  if (timeEl) timeEl.innerHTML = dateFormat(new Date(), 1);
  if (new Date().getSeconds() === 0 && weatherData) updateTheme();
}
setInterval(updateClock, 1000);

function updateTheme() {
  if (!weatherData) return;
  const now = new Date();
  const todaySunrise = new Date(weatherData.daily.sunrise[3]);
  const todaySunset = new Date(weatherData.daily.sunset[3]);
  const todayRain = weatherData.daily.precipitation_sum[3];

  const sunsetStart = new Date(todaySunset.getTime() - 45 * 60000);
  const sunsetEnd = new Date(todaySunset.getTime() + 30 * 60000);
  let theme = 'theme-day';
  
  if (now < todaySunrise || now > sunsetEnd) theme = 'theme-night';
  else if (now >= sunsetStart && now <= sunsetEnd) theme = 'theme-sunset';
  if (todayRain > 5) theme = 'theme-rain';

  document.getElementById('body').className = theme;
}

function setupSelectBox() {
  const selectEl = document.getElementById('visit-date');
  if (selectEl.options.length > 1) return;
  selectEl.innerHTML = '';
  const daily = weatherData.daily;

  for (let i = 0; i < daily.time.length; i++) {
    const rawDateStr = daily.time[i];
    const dObj = new Date(rawDateStr);
    const dayOfWeek = dObj.getDay();
    
    const displayDate = dateFormat(rawDateStr, 0);
    const option = document.createElement('option');
    option.value = i;
    
    let text = displayDate;
    if (i === 3) text += " (今日)";
    else if (i < 3) text += " (過去)";
    option.text = text;
    
    // ▼ プルダウンの土日の色付け ▼
    if (dayOfWeek === 0) option.style.color = "red";
    if (dayOfWeek === 6) option.style.color = "blue";
    
    if (i === targetIndex) option.selected = true;
    selectEl.appendChild(option);
  }
  selectEl.addEventListener('change', (e) => {
    targetIndex = parseInt(e.target.value);
    renderAll();
  });
  document.getElementById('share-btn').addEventListener('click', shareForecast);
}

function changeTargetDate(index) {
  targetIndex = index;
  const selectEl = document.getElementById('visit-date');
  if (selectEl) selectEl.value = index;
  renderAll();
  document.getElementById('hourly-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAll() {
  if (!weatherData) return;
  const daily = weatherData.daily;
  const hourly = weatherData.hourly;
  
  const isToday = (targetIndex === 3);
  const currentHour = new Date().getHours();

  generateParkAdvice(daily, targetIndex);

  let headerRow = '<tr><th>日付</th>';
  let weatherRow = '<tr><th>天気</th>';
  let maxTempRow = '<tr><th>最高気温</th>';
  let minTempRow = '<tr><th>最低気温</th>';
  let windRow = '<tr><th>最大風速<br><small>(風向)</small></th>'; 
  let precipRow = '<tr><th>降水量</th>';
  
  let reachRow = ''; let believeRow = ''; let fwRow = '';
  if (isMaihama()) {
    reachRow = '<tr><th style="line-height: 1.4;">Reach for the Stars<br><small>🏰 19:30</small></th>';
    believeRow = '<tr><th style="line-height: 1.4;">ビリーヴ！<br><span style="font-size: 0.7rem; font-weight: normal;">～シー・オブ・ドリームス～</span><br><small>🌋 20:30</small></th>';
    fwRow = '<tr><th style="line-height: 1.4;">スカイ・フル・オブ・カラーズ<br><small>🎆 20:30</small></th>'; 
  }

  for (let i = 0; i < daily.time.length; i++) {
    const colClass = (i === targetIndex) ? ` class="target-col clickable-col" onclick="changeTargetDate(${i})"` : ` class="clickable-col" onclick="changeTargetDate(${i})"`;
    const rawDateStr = daily.time[i];
    
    // ▼ 日付から曜日を取得し、土日の色付けクラスをセット ▼
    const dObj = new Date(rawDateStr);
    const dayOfWeek = dObj.getDay();
    let dayClass = "";
    if (dayOfWeek === 0) dayClass = "text-sunday";
    if (dayOfWeek === 6) dayClass = "text-saturday";
    
    let dateStr = `<span class="${dayClass}">${dateFormat(rawDateStr, 0)}</span>`;

    if (i === 3) {
      dateStr += '<br><span class="today-badge">今日</span>';
    } else if (i < 3) {
      dateStr += '<br><small>(過去)</small>';
    }

    headerRow += `<th${colClass}>${dateStr}</th>`;
    weatherRow += `<td${colClass}>${getWMO(daily.weather_code[i])}</td>`;
    maxTempRow += `<td${colClass}>${daily.temperature_2m_max[i]}℃</td>`;
    minTempRow += `<td${colClass}>${daily.temperature_2m_min[i]}℃</td>`;
    windRow += `<td${colClass}>${daily.wind_speed_10m_max[i]}m/s<br><small style="color:var(--text-sub)">${getWindDir(daily.wind_direction_10m_dominant[i])}</small></td>`;
    precipRow += `<td${colClass}>${daily.precipitation_sum[i]} mm</td>`;

    if (isMaihama()) {
      const hIdx = i * 24;
      
      const reachWind = hourly.wind_speed_10m[hIdx + 19];
      const reachWeather = hourly.weather_code[hIdx + 19];
      const reachRain = hourly.precipitation[hIdx + 19];
      
      const believeWind = hourly.wind_speed_10m[hIdx + 20];
      const believeWeather = hourly.weather_code[hIdx + 20];
      const believeRain = hourly.precipitation[hIdx + 20];

      reachRow += `<td${colClass}>${judgeReach(reachWind, reachRain, reachWeather)}<br><small>(${reachWind}m/s)</small></td>`;
      believeRow += `<td${colClass}>${judgeBelieve(believeWind, believeRain, believeWeather)}<br><small>(${believeWind}m/s)</small></td>`;
      
      if (isFwSuspended(rawDateStr)) fwRow += `<td${colClass}><span class="status-suspend">休止期間</span></td>`;
      else fwRow += `<td${colClass}>${judgeFireworks(believeWind, believeWeather)}<br><small>(${believeWind}m/s)</small></td>`;
    }
  }

  let tbodyHtml = `${weatherRow}</tr>${maxTempRow}</tr>${minTempRow}</tr>${windRow}</tr>${precipRow}</tr>`;
  if (isMaihama()) tbodyHtml += `${reachRow}</tr>${believeRow}</tr>${fwRow}</tr>`;

  document.getElementById('daily-table').innerHTML = `<thead>${headerRow}</tr></thead><tbody>${tbodyHtml}</tbody>`;

  // ▼ 詳細タイトルの曜日も色付け ▼
  let hTitleText = dateFormat(daily.time[targetIndex], 0);
  if (targetIndex === 3) hTitleText += " (今日)";
  else if (targetIndex < 3) hTitleText += " (過去)";
  
  const targetDateObj = new Date(daily.time[targetIndex]);
  const targetDayOfWeek = targetDateObj.getDay();
  let targetDayClass = "";
  if (targetDayOfWeek === 0) targetDayClass = "text-sunday";
  if (targetDayOfWeek === 6) targetDayClass = "text-saturday";

  document.getElementById('hourly-title').innerHTML = `⏰ <span class="${targetDayClass}">${hTitleText}</span> の1時間ごと詳細`;
  
  let hHeaderRow = '<tr><th>時間</th>';
  let hWeatherRow = '<tr><th>天気</th>';
  let hTempRow = '<tr><th>気温</th>';
  let hWindRow = '<tr><th>平均風速<br><small>(風向)</small></th>'; 
  let hPrecipRow = '<tr><th>降水</th>';

  const startHour = targetIndex * 24;
  for (let j = 0; j < 24; j++) {
    const idx = startHour + j;
    
    let colClass = '';
    let thId = '';
    
    if (j === currentHour) {
      thId = ' id="current-hour-th"';
    }

    if (isToday && j === currentHour) {
      colClass = ' class="current-hour-col"';
    } else if (isMaihama() && (j === 19 || j === 20)) {
      colClass = ' class="target-col"';
    }

    hHeaderRow += `<th${colClass}${thId}>${j}:00</th>`;
    hWeatherRow += `<td${colClass}>${getWMO(hourly.weather_code[idx])}</td>`;
    hTempRow += `<td${colClass}>${hourly.temperature_2m[idx]}℃</td>`;
    hWindRow += `<td${colClass}>${hourly.wind_speed_10m[idx]}m/s<br><small style="color:var(--text-sub)">${getWindDir(hourly.wind_direction_10m[idx])}</small></td>`;
    hPrecipRow += `<td${colClass}>${hourly.precipitation[idx]}mm</td>`;
  }
  
  document.getElementById('hourly-table').innerHTML = `<thead>${hHeaderRow}</tr></thead><tbody>${hWeatherRow}</tr>${hTempRow}</tr>${hWindRow}</tr>${hPrecipRow}</tr></tbody>`;

  setTimeout(scrollToCurrentHour, 100);
}

function scrollToCurrentHour() {
  const container = document.getElementById('hourly-scroll-container');
  const targetTh = document.getElementById('current-hour-th');

  if (container && targetTh) {
    const containerRect = container.getBoundingClientRect();
    const thRect = targetTh.getBoundingClientRect();
    
    const scrollPos = container.scrollLeft + (thRect.left - containerRect.left) - (containerRect.width / 2) + (thRect.width / 2);
    
    container.scrollTo({ left: scrollPos, behavior: 'smooth' });
  }
}

function generateParkAdvice(daily, tIndex) {
  const maxTemp = daily.temperature_2m_max[tIndex];
  const minTemp = daily.temperature_2m_min[tIndex];
  const maxWind = daily.wind_speed_10m_max[tIndex];
  const rain = daily.precipitation_sum[tIndex];
  
  const sr = new Date(daily.sunrise[tIndex]);
  const ss = new Date(daily.sunset[tIndex]);
  const srTime = addZero(sr.getHours()) + ':' + addZero(sr.getMinutes());
  const ssTime = addZero(ss.getHours()) + ':' + addZero(ss.getMinutes());

  let advice = `🌅 日の出 ${srTime} / 🌇 日の入り ${ssTime}<br><br>📝 `;
  
  if (rain > 5) advice += "雨の予報です。傘や雨具を準備しましょう。 ";
  
  if (maxWind >= 7.0) {
    advice += isMaihama() ? "💨 海沿いのため強風が吹き荒れる予報です！屋外ショーや花火が一時見合わせになる可能性が高まっています。 " : "💨 強い風が吹き荒れる予報です！屋外での活動には注意してください。 ";
  }
  
  if (maxTemp >= 30) {
    advice += "🥵 30℃以上の真夏日です。こまめな水分補給と熱中症対策を徹底してください。 ";
  } else if (minTemp <= 10) {
    advice += isMaihama() ? "🥶 夜間は10℃以下まで冷え込みます！海風の影響で体感温度はさらに下がるため、厚手の防寒着をお持ちください。 " : "🥶 夜間は10℃以下まで冷え込みます！厚手の防寒着をお持ちください。 ";
  } else if (maxWind >= 4.0 && minTemp <= 16) {
    advice += "🍃 風がやや強く、夕方以降は冷え込みます。長袖の羽織るものがあると安心です。 ";
  } else {
    advice += isMaihama() ? "✨ 比較的過ごしやすい気候です。絶好のパーク日和になりそうです！ " : "✨ 比較的過ごしやすい気候になりそうです！ ";
  }
  
  document.getElementById('park-advice').innerHTML = advice;
}

function shareForecast() {
  if (!weatherData) return;
  const daily = weatherData.daily;
  const hourly = weatherData.hourly;
  const rawDateStr = daily.time[targetIndex];
  const dateStr = dateFormat(rawDateStr, 0); // 曜日入りの日付
  const wmo = getWMO(daily.weather_code[targetIndex]);
  const maxT = daily.temperature_2m_max[targetIndex];
  const minT = daily.temperature_2m_min[targetIndex];
  
  let text = `【📍 ${currentLocation.name} 天気予測】\n🗓️ ${dateStr} の予報\n天気: ${wmo}\n気温: ${maxT}℃ / ${minT}℃\n`;

  if (isMaihama()) {
    const hIdx = targetIndex * 24;
    
    const reachWind = hourly.wind_speed_10m[hIdx + 19];
    const reachRain = hourly.precipitation[hIdx + 19];
    const reachWeather = hourly.weather_code[hIdx + 19];
    
    const believeWind = hourly.wind_speed_10m[hIdx + 20];
    const believeRain = hourly.precipitation[hIdx + 20];
    const believeWeather = hourly.weather_code[hIdx + 20];

    const reachText = getPlainReachJudge(reachWind, reachRain, reachWeather);
    const believeText = getPlainBelieveJudge(believeWind, believeRain, believeWeather);
    
    let fwText = getPlainFwJudge(believeWind, believeWeather);
    if (isFwSuspended(rawDateStr)) fwText = "休止期間";
    
    text = `【🏰 東京ディズニーリゾート 天気・ショー予想 🌋】\n🗓️ ${dateStr} の予報\n天気: ${wmo}\n気温: ${maxT}℃ / ${minT}℃\n\n🎆花火: ${fwText}\n🏰リーチ: ${reachText}\n🌋ビリーヴ: ${believeText}\n※非公式の予測です`;
  }

  if (navigator.share) {
    navigator.share({ title: '天気＆予測', text: text }).catch(err => console.log('Share canceled', err));
  } else {
    navigator.clipboard.writeText(text).then(() => { alert("クリップボードにコピーしました！\n\n" + text); });
  }
}

function getWindDir(deg) {
  if (deg === null || deg === undefined) return '--';
  const dirs = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function judgeReach(wind, rain, weatherCode) {
  if (wind === undefined || wind === null) return '--';
  if (weatherCode >= 95) return '<span class="status-cancel">× 中止</span><br><small>(雷雨)</small>'; 
  if (wind <= 4.0 && rain < 1.0) return '<span class="status-ok">◯ 通常版</span>'; 
  return '<span class="status-wind">△ 風/雨Ver.</span>'; 
}
function getPlainReachJudge(wind, rain, weatherCode) {
  if (weatherCode >= 95) return "❌中止(雷雨)";
  if (wind <= 4.0 && rain < 1.0) return "⭕️通常版";
  return "⚠️風/雨バージョン";
}

function judgeBelieve(wind, rain, weatherCode) {
  if (wind === undefined || wind === null) return '--';
  if (weatherCode >= 95) return '<span class="status-cancel">× 中止</span><br><small>(雷雨)</small>';
  if (rain >= 2.0) return '<span class="status-cancel">× 中止</span><br><small>(雨量)</small>'; 
  if (wind > 8.0) return '<span class="status-cancel">× 中止</span><br><small>(強風)</small>';
  if (wind <= 4.0) return '<span class="status-ok">◯ 通常版</span>'; 
  return '<span class="status-wind">△ 風Ver.</span>'; 
}
function getPlainBelieveJudge(wind, rain, weatherCode) {
  if (weatherCode >= 95) return "❌中止(雷雨)";
  if (rain >= 2.0) return "❌中止(雨量)";
  if (wind > 8.0) return "❌中止(強風)";
  if (wind <= 4.0) return "⭕️通常版";
  return "⚠️風バージョン";
}

function getPlainFwJudge(wind, weatherCode) {
  if (weatherCode >= 61 && weatherCode <= 67 || weatherCode >= 95) return "❌中止(雨/雷)";
  if (wind <= 4.5) return "⭕️開催予定";
  return "❌上空風中止濃厚";
}
function isFwSuspended(dateStr) {
  if (dateStr >= "2026-06-15" && dateStr <= "2026-09-14") return true;
  if (dateStr === "2026-10-02") return true;
  if (dateStr === "2026-12-04") return true;
  return false;
}
function judgeFireworks(wind, weatherCode) {
  if (wind === undefined || wind === null) return '--';
  if (weatherCode >= 61 && weatherCode <= 67 || weatherCode >= 95) return '<span class="status-cancel">× 中止</span><br><small>(雨/雷)</small>';
  if (wind <= 4.5) return '<span class="status-ok">◯ 開催予定</span>';
  return '<span class="status-cancel">× 上空風中止</span>';
}

// ▼ 変更：曜日の取得と表示を追加 ▼
function dateFormat(date, mode) {
  let d = new Date(date);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]; // 曜日配列
  
  if (mode == 1) {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${wd}) ${addZero(d.getHours())}:${addZero(d.getMinutes())}:${addZero(d.getSeconds())}`;
  }
  return (d.getMonth() + 1) + '/' + d.getDate() + '(' + wd + ')';
}

function addZero(n) { return n < 10 ? '0' + n : n; }
function getWMO(w) {
  if (w == 0) return '☀️'; if (w == 1) return '🌤'; if (w == 2) return '⛅️'; if (w == 3) return '☁️';
  if (w == 45 || w == 48) return '霧'; if (w >= 51 && w <= 57) return '霧雨'; if (w >= 61 && w <= 67) return '☔️';
  if (w >= 71 && w <= 77) return '❄️'; if (w >= 80 && w <= 82) return '☔️'; if (w >= 95) return '⚡️☔️';
  return w;
}