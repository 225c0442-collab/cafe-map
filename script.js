import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://nwlfxjtunbqjkwpiaury.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bGZ4anR1bmJxamt3cGlhdXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTMxOTMsImV4cCI6MjA5OTU4OTE5M30.1ew82vNMtwqqm97-neRxW21hHTW4LH2NmbNZ230rppU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var COUNTER_ID = 53;
var ADMINS_CAFE_ID = 55;
var BANS_CAFE_ID = 54;
var INQUIRIES_CAFE_ID = 56;
var PHOTOS_CAFE_ID = 57;
var APPS_CAFE_ID = 58;

// アクセスカウンター (Supabase に保存)
(function () {
  var el = document.getElementById('visitCount');
  if (!el) return;
  function updateDisplay(n) { el.textContent = (typeof n === 'number' ? n : 0).toLocaleString(); }
  updateDisplay(0);
  supabase.from('cafes').select('comment').eq('id', COUNTER_ID).limit(1).then(function (res) {
    if (res.error || !res.data || !res.data.length) { updateDisplay(0); return; }
    var comment = res.data[0].comment || '{}';
    var count = 0;
    try { var parsed = JSON.parse(comment); count = (typeof parsed.vc === 'number') ? parsed.vc : 0; } catch (e) { count = 0; }
    count += 1;
    updateDisplay(count);
    var newComment = JSON.stringify({ vc: count });
    supabase.from('cafes').update({ comment: newComment }).eq('id', COUNTER_ID).then();
  });
})();

// トースト通知機能
function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

const TAG_LABELS = {
  power: '電源あり', wifi: 'Wi-Fi完備', terrace: 'テラス席',
  pet: 'ペット可', smoking: '喫煙可', quiet: '静かな空間',
  starbucks: 'スターバックス'
};
const TAG_KEYS = Object.keys(TAG_LABELS);

let cafes = [];
let editingId = null;
let activeTagFilter = null;
let searchQuery = '';

var adminIds = [];
var bannedIds = [];
var cafePhotoUrls = {};

const map = L.map('map', { zoomControl: true }).setView([35.6605, 139.7000], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19
}).addTo(map);

function iconForCafe(cafe) {
  var cls = 'marker-default';
  if (cafe.tags && cafe.tags.length) { cls = 'marker-' + cafe.tags[0]; }
  return L.divIcon({
    className: '',
    html: '<div class="custom-marker ' + cls + '"><div class="custom-marker-inner"></div></div>',
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -38]
  });
}

const allMarkers = [];
var currentLocMarker = null;
var currentLocCircle = null;
var tempPreviewMarker = null;

function toCafe(row) {
  return {
    id: row.id, name: row.name, address: row.address, lat: row.lat, lng: row.lng,
    desc: row.comment || '', hours: row.hours || '', wifi: row.wifi === null ? null : !!row.wifi,
    power: row.power === null ? null : !!row.power, parking: row.parking === null ? null : !!row.parking,
    tags: row.tags || [], like_count: row.like_count || 0
  };
}

async function fetchCafes() {
  var { data, error } = await supabase.from('cafes').select('*').order('id');
  if (error) { console.error(error); return; }
  cafes = (data || []).map(toCafe);
  renderAllCafes();
  renderList();
}

async function insertCafe(cafe) {
  var { data, error } = await supabase.from('cafes').insert({
    name: cafe.name, address: cafe.address, lat: cafe.lat, lng: cafe.lng,
    comment: cafe.desc, hours: cafe.hours, wifi: cafe.wifi, power: cafe.power, parking: cafe.parking,
    tags: cafe.tags || [], like_count: cafe.like_count || 0
  }).select();
  if (error) { console.error(error); throw error; }
  insertActionLog('を追加', cafe.name);
  showToast('カフェを新しく登録しました。');
  return data[0];
}

async function updateCafe(id, cafe) {
  var { error } = await supabase.from('cafes').update({
    name: cafe.name, address: cafe.address, lat: cafe.lat, lng: cafe.lng,
    comment: cafe.desc, hours: cafe.hours, wifi: cafe.wifi, power: cafe.power, parking: cafe.parking, tags: cafe.tags || []
  }).eq('id', id);
  if (error) { console.error(error); throw error; }
  var found = cafes.find(function (c) { return c.id === id; });
  if (found) {
    insertActionLog('を編集', cafe.name);
    showToast('カフェ情報を更新しました。');
  }
}

async function deleteCafe(id) {
  var cafe = cafes.find(function (c) { return c.id === id; });
  var cafeName = cafe ? cafe.name : '';
  var { error } = await supabase.from('cafes').delete().eq('id', id);
  if (error) { console.error(error); throw error; }
  if (cafeName) {
    insertActionLog('を削除', cafeName);
    showToast('カフェを削除しました。');
  }
}

async function fetchComments(cafeId) {
  var { data, error } = await supabase.from('comments').select('*').eq('cafe_id', cafeId).order('created_at', { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function insertComment(cafeId, nickname, text) {
  var { data, error } = await supabase.from('comments').insert({ cafe_id: cafeId, nickname: nickname, text: text }).select();
  if (error) { console.error(error); throw error; }
  var cafe = cafes.find(function (c) { return c.id === cafeId; });
  if (cafe) {
    insertActionLog('にコメント', cafe.name);
    showToast('コメントを投稿しました。');
  }
  return data[0];
}

async function toggleLike(cafeId) {
  var cafe = cafes.find(function (c) { return c.id === cafeId; });
  if (!cafe) return { liked: false, count: 0 };
  var { data: existing } = await supabase.from('likes').select('id').eq('user_id', currentUserId).eq('cafe_id', cafeId).maybeSingle();
  if (existing) {
    var { error: delErr } = await supabase.from('likes').delete().eq('id', existing.id);
    if (delErr) throw delErr;
    cafe.like_count = Math.max(0, (cafe.like_count || 0) - 1);
    await supabase.from('cafes').update({ like_count: cafe.like_count }).eq('id', cafeId);
    return { liked: false, count: cafe.like_count };
  } else {
    var { error: insErr } = await supabase.from('likes').insert({ user_id: currentUserId, cafe_id: cafeId });
    if (insErr) throw insErr;
    cafe.like_count = (cafe.like_count || 0) + 1;
    await supabase.from('cafes').update({ like_count: cafe.like_count }).eq('id', cafeId);
    insertActionLog('にいいね', cafe.name);
    return { liked: true, count: cafe.like_count };
  }
}

function clearMarkers() {
  allMarkers.forEach(function (m) { map.removeLayer(m); });
  allMarkers.length = 0;
}

function boolHtml(label, val) {
  var cls, txt;
  if (val === true) { cls = 'yes'; txt = 'あり'; }
  else if (val === false) { cls = 'no'; txt = 'なし'; }
  else { cls = 'unknown'; txt = '不明'; }
  return '<div class="popup-detail-row">' + label + ': <span class="val ' + cls + '">' + txt + '</span></div>';
}

function openStatus(cafe) {
  if (!cafe.hours) return { cls: 'unknown', label: '情報なし' };
  var h = cafe.hours.replace(/[〜~]/g, '-');
  var m = h.match(/(\d{1,2}):?(\d{0,2})\s*[-–]\s*(\d{1,2}):?(\d{0,2})/);
  if (!m) return { cls: 'unknown', label: '情報なし' };
  var startH = parseInt(m[1], 10), startM = parseInt(m[2] || '0', 10);
  var endH = parseInt(m[3], 10), endM = parseInt(m[4] || '0', 10);
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var startMin = startH * 60 + startM;
  var endMin = endH * 60 + endM;
  if (endMin <= startMin) { endMin += 1440; }
  if (nowMin < startMin) { nowMin += 1440; }
  var isOpen = nowMin >= startMin && nowMin <= endMin;
  return { cls: isOpen ? 'open' : 'closed', label: isOpen ? '営業中' : '営業時間外' };
}

function makePopupContent(cafe) {
  var tagsHtml = '';
  if (cafe.tags && cafe.tags.length) {
    tagsHtml = '<div class="popup-tags">' + cafe.tags.map(function (t) { return '<span class="tag tag-' + t + '">' + (TAG_LABELS[t] || t) + '</span>'; }).join('') + '</div>';
  }
  var photoHtml = '';
  var photoUrl = cafePhotoUrls[cafe.id];
  if (photoUrl) photoHtml = '<div class="popup-photo"><img src="' + photoUrl + '" onclick="window.open(\'' + photoUrl + '\',\'_blank\')"></div>';
  var detailHtml = '';
  if (cafe.hours || cafe.wifi !== undefined || cafe.power !== undefined || cafe.parking !== undefined) {
    detailHtml = '<div class="popup-detail">';
    if (cafe.hours) {
      var st = openStatus(cafe);
      detailHtml += '<div class="popup-detail-row"><span class="open-indicator"><span class="dot ' + st.cls + '"></span><span class="label">' + st.label + '</span></span></div>';
      detailHtml += '<div class="popup-detail-row">営業時間: ' + cafe.hours + '</div>';
    }
    if (cafe.wifi !== undefined) detailHtml += boolHtml('Wi-Fi', cafe.wifi);
    if (cafe.power !== undefined) detailHtml += boolHtml('電源', cafe.power);
    if (cafe.parking !== undefined) detailHtml += boolHtml('駐車場', cafe.parking);
    detailHtml += '</div>';
  }
  return (
    photoHtml +
    '<div class="popup-name">' + cafe.name + '</div>' + tagsHtml + detailHtml +
    '<div class="popup-addr">' + cafe.address + '</div>' +
    '<div class="popup-desc">' + cafe.desc + '</div>' +
    '<div class="popup-actions">' +
      '<button class="popup-btn popup-btn-like" data-id="' + cafe.id + '">いいね <span class="like-cnt">' + (cafe.like_count || 0) + '</span></button>' +
      '<button class="popup-btn popup-btn-route" data-lat="' + cafe.lat + '" data-lng="' + cafe.lng + '">ルート</button>' +
      '<button class="popup-btn popup-btn-edit" data-id="' + cafe.id + '">編集</button>' +
      '<button class="popup-btn popup-btn-delete" data-id="' + cafe.id + '">削除</button>' +
    '</div>' +
    '<div class="popup-comments" data-cafe-id="' + cafe.id + '">' +
      '<div class="popup-comments-title">コメント</div>' +
      '<div class="popup-comments-list"></div>' +
      '<div class="popup-comment-form">' +
        '<input type="text" class="comment-text" placeholder="コメントを入力..." maxlength="200">' +
        '<button class="comment-submit" data-id="' + cafe.id + '">送信</button>' +
      '</div>' +
    '</div>'
  );
}

function addMarkerForCafe(cafe) {
  var marker = L.marker([cafe.lat, cafe.lng], { icon: iconForCafe(cafe) }).addTo(map);
  marker.bindPopup(makePopupContent(cafe));
  marker._cafeId = cafe.id;
  allMarkers.push(marker);
}

function renderAllCafes() {
  clearMarkers();
  cafes.forEach(addMarkerForCafe);
}

map.on('popupopen', function (e) {
  var popup = e.popup;
  var content = popup.getContent();
  var match = content && content.match(/data-cafe-id="(\d+)"/);
  if (!match) return;
  var cafeId = parseInt(match[1], 10);
  if (currentUserId) {
    supabase.from('likes').select('id').eq('user_id', currentUserId).eq('cafe_id', cafeId).maybeSingle().then(function (res) {
      if (res.data) {
        var likeBtn = popup.getElement().querySelector('.popup-btn-like');
        if (likeBtn) likeBtn.classList.add('liked');
      }
    });
  }
  var container = popup.getElement().querySelector('.popup-comments-list');
  if (!container) return;
  container.innerHTML = '<div style="font-size:11px;color:#8c7e73;text-align:center;">読み込み中...</div>';
  fetchComments(cafeId).then(function (comments) {
    if (!comments.length) {
      container.innerHTML = '<div class="comments-empty">まだコメントはありません</div>';
    } else {
      container.innerHTML = comments.map(function (c) {
        return '<div class="popup-comment"><span class="popup-comment-nick">' + escHtml(c.nickname) + '</span><span class="popup-comment-text">' + escHtml(c.text) + '</span></div>';
      }).join('');
    }
  });
});

function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showCurrentLocation() {
  if (!navigator.geolocation) { showToast('位置情報に対応していません'); return; }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      var lat = pos.coords.latitude; var lng = pos.coords.longitude;
      if (currentLocMarker) { map.removeLayer(currentLocMarker); }
      if (currentLocCircle) { map.removeLayer(currentLocCircle); }
      currentLocCircle = L.circleMarker([lat, lng], { radius: 40, color: '#4285f4', fillColor: 'rgba(66,133,244,0.15)', fillOpacity: 0.3, weight: 1 }).addTo(map);
      currentLocMarker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: '<div style="position:relative"><div class="current-loc-pulse"></div><div class="current-loc-marker"></div></div>', iconSize: [24, 24], iconAnchor: [12, 12] })
      }).addTo(map);
      map.setView([lat, lng], map.getZoom());
    },
    function () { showToast('現在地を取得できませんでした'); },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function fetchAddress(lat, lng) {
  var status = document.getElementById('geoStatus');
  status.textContent = '住所を取得中...'; status.className = 'geo-status loading';
  fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&accept-language=ja')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.display_name) {
        cafeAddress.value = data.display_name;
        status.textContent = 'OK'; status.className = 'geo-status success';
      } else { status.textContent = '取得できませんでした'; status.className = 'geo-status error'; }
    })
    .catch(function () { status.textContent = '失敗'; status.className = 'geo-status error'; });
}

var formOverlay = document.getElementById('formOverlay');
var formToggle = document.getElementById('formToggle');
var formPanel = document.getElementById('formPanel');
var formTitle = document.getElementById('formTitle');
var formSubmit = document.getElementById('formSubmit');
var formCancel = document.getElementById('formCancel');
var formCloseIcon = document.getElementById('formCloseIcon');
var cafeName = document.getElementById('cafeName');
var cafeAddress = document.getElementById('cafeAddress');
var cafeLat = document.getElementById('cafeLat');
var cafeLng = document.getElementById('cafeLng');
var cafeDesc = document.getElementById('cafeDesc');
var cafeHours = document.getElementById('cafeHours');
var formTagsEl = document.getElementById('formTags');
var hint = document.getElementById('hint');
var submitting = false;

var BOOL_FIELDS = ['wifi', 'power', 'parking'];
BOOL_FIELDS.forEach(function (field) {
  var container = document.querySelector('.form-radio-group[data-field="' + field + '"]');
  if (!container) return;
  [null, true, false].forEach(function (val) {
    var label = document.createElement('label'); label.className = 'form-radio-opt';
    var text = val === null ? '不明' : val ? 'あり' : 'なし';
    label.innerHTML = '<input type="radio" name="' + field + '" value="' + val + '">' + text;
    container.appendChild(label);
    label.addEventListener('click', function (e) {
      if (e.target.tagName !== 'INPUT') { var rb = label.querySelector('input'); rb.checked = true; }
      container.querySelectorAll('.form-radio-opt').forEach(function (l) { l.classList.toggle('selected', l.querySelector('input').checked); });
    });
  });
});

function getRadioValue(field) {
  var checked = document.querySelector('.form-radio-group[data-field="' + field + '"] input:checked');
  if (!checked) return null;
  return checked.value === 'true' ? true : checked.value === 'false' ? false : null;
}

function setRadioValue(field, val) {
  var container = document.querySelector('.form-radio-group[data-field="' + field + '"]');
  if (!container) return;
  container.querySelectorAll('input').forEach(function (i) {
    var match = (val === true && i.value === 'true') || (val === false && i.value === 'false') || (val === null && i.value === 'null');
    i.checked = match; i.parentNode.classList.toggle('selected', match);
  });
}

TAG_KEYS.forEach(function (key) {
  var label = document.createElement('label'); label.className = 'form-tag-opt';
  label.innerHTML = '<input type="checkbox" value="' + key + '">' + TAG_LABELS[key];
  formTagsEl.appendChild(label);
  label.addEventListener('click', function (e) {
    if (e.target.tagName !== 'INPUT') { var cb = label.querySelector('input'); cb.checked = !cb.checked; }
    label.classList.toggle('selected', label.querySelector('input').checked);
  });
});

function getSelectedTags() { return Array.from(formTagsEl.querySelectorAll('input:checked')).map(function (i) { return i.value; }); }

function resetFormFields() {
  cafeName.value = ''; cafeAddress.value = ''; cafeLat.value = ''; cafeLng.value = ''; cafeDesc.value = ''; cafeHours.value = '';
  BOOL_FIELDS.forEach(function (f) { setRadioValue(f, null); });
  formTagsEl.querySelectorAll('input').forEach(function (i) { i.checked = false; });
  formTagsEl.querySelectorAll('.form-tag-opt').forEach(function (l) { l.classList.remove('selected'); });
}

function updateTempPreviewMarker(lat, lng) {
  if (tempPreviewMarker) { map.removeLayer(tempPreviewMarker); }
  tempPreviewMarker = L.marker([lat, lng], {
    icon: L.divIcon({ className: '', html: '<div class="custom-marker preview-marker"><div class="custom-marker-inner"></div></div>', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -38] })
  }).addTo(map);
}

function removeTempPreviewMarker() {
  if (tempPreviewMarker) { map.removeLayer(tempPreviewMarker); tempPreviewMarker = null; }
}

function setFormMode(mode, cafe) {
  if (mode === 'edit' && cafe) {
    editingId = cafe.id; formTitle.textContent = 'カフェを編集'; formSubmit.textContent = '更新する';
    cafeName.value = cafe.name; cafeAddress.value = cafe.address; cafeLat.value = cafe.lat; cafeLng.value = cafe.lng; cafeDesc.value = cafe.desc; cafeHours.value = cafe.hours || '';
    BOOL_FIELDS.forEach(function (f) { setRadioValue(f, cafe[f] !== undefined ? cafe[f] : null); });
    formTagsEl.querySelectorAll('input').forEach(function (i) {
      i.checked = (cafe.tags || []).indexOf(i.value) !== -1;
      i.parentNode.classList.toggle('selected', i.checked);
    });
  } else {
    editingId = null; formTitle.textContent = '新しいカフェを登録'; formSubmit.textContent = '登録する'; resetFormFields();
  }
}

function openForm() {
  formPanel.classList.add('open'); 
  formOverlay.classList.add('open');
  formToggle.classList.add('open');
  formToggle.innerHTML = '×'; 
  hint.classList.add('show'); 
  cafeName.focus();
}

function closeForm() {
  formPanel.classList.remove('open'); 
  formOverlay.classList.remove('open');
  formToggle.classList.remove('open');
  formToggle.innerHTML = '+'; 
  hint.classList.remove('show');
  if (!submitting) { setFormMode('add'); }
  submitting = false; 
  removeTempPreviewMarker();
}

formToggle.addEventListener('click', function () {
  if (formPanel.classList.contains('open')) { closeForm(); } else { setFormMode('add'); openForm(); }
});
formCancel.addEventListener('click', function () { setFormMode('add'); closeForm(); });
formCloseIcon.addEventListener('click', function () { setFormMode('add'); closeForm(); });
formOverlay.addEventListener('click', closeForm);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && formPanel.classList.contains('open')) { closeForm(); } });

map.on('click', function (e) {
  if (editingId !== null) {
    if (!formPanel.classList.contains('open')) return;
    cafeLat.value = e.latlng.lat.toFixed(6); cafeLng.value = e.latlng.lng.toFixed(6); fetchAddress(e.latlng.lat, e.latlng.lng); updateTempPreviewMarker(e.latlng.lat, e.latlng.lng); return;
  }
  if (!formPanel.classList.contains('open')) { setFormMode('add'); openForm(); }
  cafeLat.value = e.latlng.lat.toFixed(6); cafeLng.value = e.latlng.lng.toFixed(6); fetchAddress(e.latlng.lat, e.latlng.lng); updateTempPreviewMarker(e.latlng.lat, e.latlng.lng);
});

formSubmit.addEventListener('click', async function () {
  if (!requireLogin()) return;
  var name = cafeName.value.trim(); var address = cafeAddress.value.trim();
  var lat = parseFloat(cafeLat.value); var lng = parseFloat(cafeLng.value); var desc = cafeDesc.value.trim();
  
  if (!name) { showToast('カフェ名を入力してください'); return; }
  if (!address) { showToast('住所を入力してください'); return; }
  if (isNaN(lat) || lat < -90 || lat > 90) { showToast('正しい緯度を入力してください'); return; }
  if (isNaN(lng) || lng < -180 || lng > 180) { showToast('正しい経度を入力してください'); return; }
  if (!desc) { showToast('一言コメントを入力してください'); return; }

  var cafeData = { 
    name: name, address: address, lat: lat, lng: lng, desc: desc, hours: cafeHours.value.trim(), 
    wifi: getRadioValue('wifi'), power: getRadioValue('power'), parking: getRadioValue('parking'), tags: getSelectedTags() 
  };

  try {
    if (editingId !== null) {
      await updateCafe(editingId, cafeData);
      var found = cafes.find(function (c) { return c.id === editingId; });
      if (found) { Object.assign(found, cafeData); }
    } else {
      var inserted = await insertCafe(cafeData);
      cafes.push(toCafe(inserted));
    }
    renderAllCafes(); renderList(); setFormMode('add'); submitting = true; closeForm();
  } catch (err) { showToast('保存に失敗しました'); }
});

document.addEventListener('click', async function (e) {
  var t = e.target;
  if (t.classList.contains('popup-btn-edit')) {
    var id = parseInt(t.getAttribute('data-id'), 10);
    var cafe = cafes.find(function (c) { return c.id === id; });
    if (!cafe) return; map.closePopup(); setFormMode('edit', cafe); openForm();
  }
  if (t.classList.contains('popup-btn-delete')) {
    if (!requireLogin()) return;
    var id = parseInt(t.getAttribute('data-id'), 10);
    if (!confirm('「' + t.parentNode.parentNode.querySelector('.popup-name').textContent + '」を削除してもよろしいですか？')) return;
    try {
      await deleteCafe(id);
      cafes = cafes.filter(function (c) { return c.id !== id; });
      renderAllCafes(); renderList(); map.closePopup();
    } catch (err) { showToast('削除に失敗しました'); }
  }
  if (t.classList.contains('popup-btn-like')) {
    if (!requireLogin()) return;
    var id = parseInt(t.getAttribute('data-id'), 10);
    toggleLike(id).then(function (res) {
      t.querySelector('.like-cnt').textContent = res.count;
      t.classList.toggle('liked', res.liked);
      showToast(res.liked ? 'いいね！しました' : 'いいねを取り消しました');
    }).catch(function () {
      showToast('いいねに失敗しました');
    });
  }
  if (t.classList.contains('comment-submit')) {
    if (!requireLogin()) return;
    var cafeId = parseInt(t.getAttribute('data-id'), 10);
    var form = t.parentNode;
    var text = form.querySelector('.comment-text');
    if (!text.value.trim()) { showToast('コメントを入力してください'); return; }
    if (!currentUsername) { showToast('ユーザーネームが設定されていません'); return; }
    insertComment(cafeId, currentUsername, text.value.trim()).then(function () {
      text.value = '';
      var list = form.parentNode.querySelector('.popup-comments-list');
      if (list) {
        list.innerHTML = '<div style="font-size:11px;color:#8c7e73;text-align:center;">読み込み中...</div>';
        fetchComments(cafeId).then(function (comments) {
          if (!comments.length) { list.innerHTML = '<div class="comments-empty">まだコメントはありません</div>'; } 
          else { list.innerHTML = comments.map(function (c) { return '<div class="popup-comment"><span class="popup-comment-nick">' + escHtml(c.nickname) + '</span><span class="popup-comment-text">' + escHtml(c.text) + '</span></div>'; }).join(''); }
        });
      }
    });
  }
  if (t.classList.contains('popup-btn-route')) {
    var lat = t.getAttribute('data-lat'); var lng = t.getAttribute('data-lng');
    window.open('https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng, '_blank');
  }
});

var listPanel = document.getElementById('listPanel');
var listItems = document.getElementById('listItems');
var searchBox = document.getElementById('searchBox');
var tagFiltersEl = document.getElementById('tagFilters');
var listToggleEl = L.DomUtil.create('button', 'list-toggle');
listToggleEl.innerHTML = '☰'; listToggleEl.title = 'カフェを探す';
L.DomEvent.on(listToggleEl, 'click', function () { listPanel.classList.toggle('open'); listToggleEl.classList.toggle('active'); });
var listCtrl = new L.Control({ position: 'topleft' }); listCtrl.onAdd = function () { return listToggleEl; }; listCtrl.addTo(map);
document.getElementById('listCloseBtn').addEventListener('click', function () { listPanel.classList.remove('open'); listToggleEl.classList.remove('active'); });

TAG_KEYS.forEach(function (key) {
  var chip = document.createElement('span'); chip.className = 'tag-filter-chip'; chip.textContent = TAG_LABELS[key]; chip.setAttribute('data-tag', key);
  tagFiltersEl.appendChild(chip);
  chip.addEventListener('click', function () {
    activeTagFilter = activeTagFilter === key ? null : key;
    renderTagFilters(); renderList();
  });
});

function renderTagFilters() {
  tagFiltersEl.querySelectorAll('.tag-filter-chip').forEach(function (c) { c.classList.toggle('active', c.getAttribute('data-tag') === activeTagFilter); });
}

searchBox.addEventListener('input', function () { searchQuery = searchBox.value.trim().toLowerCase(); renderList(); });

function filteredCafes() {
  return cafes.filter(function (c) {
    if (activeTagFilter && (!c.tags || c.tags.indexOf(activeTagFilter) === -1)) return false;
    if (searchQuery) {
      var q = searchQuery;
      if (c.name.toLowerCase().indexOf(q) === -1 && c.address.toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  });
}

function focusCafeOnMap(id) {
  var cafe = cafes.find(function (c) { return c.id === id; });
  if (!cafe) return;
  map.setView([cafe.lat, cafe.lng], 17, { animate: true });
  allMarkers.forEach(function (m) { if (m._cafeId === id) { map.closePopup(); m.openPopup(); } });
  if (window.innerWidth <= 700) { listPanel.classList.remove('open'); listToggleEl.classList.remove('active'); }
}

function renderList() {
  var filtered = filteredCafes();
  if (!filtered.length) { listItems.innerHTML = '<div class="list-empty">該当するカフェがありません</div>'; return; }
  listItems.innerHTML = filtered.map(function (c) {
    var colors = ['#b5825a', '#2d9cdb', '#27ae60', '#e67e22', '#9b59b6', '#e74c3c', '#1abc9c'];
    var color = colors[Math.abs(c.id) % colors.length];
    var tagsHtml = '';
    if (c.tags && c.tags.length) { tagsHtml = '<div class="list-item-tags">' + c.tags.map(function (t) { return '<span class="tag tag-' + t + '">' + (TAG_LABELS[t] || t) + '</span>'; }).join('') + '</div>'; }
    var st = openStatus(c);
    var openHtml = '<div class="open-indicator"><span class="dot ' + st.cls + '"></span><span>' + st.label + '</span></div>';
    return (
      '<div class="list-item" data-id="' + c.id + '">' +
        '<div class="list-item-marker" style="background:' + color + '"></div>' +
        '<div class="list-item-info">' +
          '<div class="list-item-name">' + c.name + '</div><div class="list-item-addr">' + c.address + '</div>' + openHtml + tagsHtml +
        '</div></div>'
    );
  }).join('');
  listItems.querySelectorAll('.list-item').forEach(function (el) { el.addEventListener('click', function () { focusCafeOnMap(parseInt(el.getAttribute('data-id'), 10)); }); });
}

document.getElementById('exportBtn').addEventListener('click', function () {
  var blob = new Blob([JSON.stringify(cafes, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'cafe-map-data.json'; a.click(); URL.revokeObjectURL(url);
  showToast('データを書き出しました。');
});
document.getElementById('importBtn').addEventListener('click', function () { document.getElementById('importFile').click(); });
document.getElementById('importFile').addEventListener('change', async function (e) {
  var file = e.target.files[0]; if (!file) return; var reader = new FileReader();
  reader.onload = async function (ev) {
    try {
      var data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) { showToast('不正なファイル形式です。'); return; }
      if (!confirm('データを読み込むと現在のデータは上書きされます。よろしいですか？')) return;
      var { error } = await supabase.from('cafes').delete().neq('id', 0);
      if (error) { showToast('既存データの削除に失敗しました。'); return; }
      for (var i = 0; i < data.length; i++) {
        var c = data[i];
        var { error: insErr } = await supabase.from('cafes').insert({
          name: c.name, address: c.address, lat: c.lat, lng: c.lng, comment: c.desc || c.comment || '',
          hours: c.hours || '', wifi: c.wifi, power: c.power, parking: c.parking, tags: c.tags || []
        });
      }
      await fetchCafes(); showToast(data.length + '件のデータを読み込みました。');
    } catch (err) { showToast('ファイルの読み込みに失敗しました。'); }
  };
  reader.readAsText(file); e.target.value = '';
});

L.Control.CurrentLocation = L.Control.extend({
  onAdd: function () {
    var btn = L.DomUtil.create('button', 'locate-btn'); btn.innerHTML = '◎'; btn.title = '現在地を表示'; btn.style.fontSize = '18px';
    L.DomEvent.on(btn, 'click', showCurrentLocation); return btn;
  }
});
new L.Control.CurrentLocation({ position: 'topleft' }).addTo(map);

var CHANGELOG = [
  { date: '2026-07-16', time: '18:30', text: '<b>全カフェの座標を住所に基づき修正</b><ul><li>Nominatim ジオコーディングで各住所の正しい緯度経度を取得</li><li>登録済み座標と比較し、ズレがある場合に自動修正</li><li>新宿ラーメンマップも同様に全店舗の住所・座標を訂正</li><li>非実在ラーメン店舗を削除し風雲児を追加</li></ul>' },
  { date: '2026-07-16', time: '16:30', text: '<b>ダークモード・営業中表示・写真・いいね一覧・おすすめカフェを追加</b><ul><li>ダークモード切替（ヘッダーの🌙/☀️ボタン）</li><li>営業時間から営業中/時間外を自動判定してリストとポップアップに表示</li><li>カフェ写真アップロード（base64保存、フォームから設定）</li><li>いいね一覧モーダル（いいねしたカフェをリスト表示）</li><li>おすすめカフェ（ランダム抽選、もう一度引く・地図で見る）</li></ul>' },
  { date: '2026-07-16', time: '15:00', text: '<b>問い合わせ機能・アカウント削除機能を追加</b><ul><li>一般ユーザーが管理者に問い合わせを送信できる機能</li><li>管理パネルに問い合わせタブを追加（閲覧・返信・解決）</li><li>管理パネルにアカウント削除機能を追加</li><li>未読問い合わせバッジを管理タブに表示</li></ul>' },
  { date: '2026-07-16', time: '13:30', text: '<b>カフェデータの精度検証と修正</b><ul><li>カフェ・ド・クリエ渋谷店（存在確認できず削除）</li><li>TUBOCAFE→TUBO CAFEに名称修正、住所を旭町12-6に訂正</li><li>名曲喫茶カオリ座の住所を百人町1-23-19に詳細化</li></ul>' },
  { date: '2026-07-16', time: '13:30', text: '<b>管理パネル追加・アクセスカウンターをヘッダーに移動</b><ul><li>開発者用管理パネル（ユーザーBAN機能）を追加</li><li>アクセスカウンターをヘッダー内バッジに統合</li><li>BANされたユーザーの操作を制限</li></ul>' },
  { date: '2026-07-15', time: '21:30', text: '<b>新宿・百人町・天龍村・八王子・みなみ野にカフェを追加</b><ul><li>新宿: アナログシンジュク、アティックルーム</li><li>百人町: ゆめいろcafe、SOOM CAFE、名曲喫茶カオリ座</li><li>天龍村(長野): バードPaPa、龍の道、WACHI CAFEさとね</li><li>八王子: 八王子珈琲店、Cafe Anri Matisse、TUBOCAFE</li><li>八王子みなみ野: 高倉町珈琲、タリーズ、373-DINING、BEANS TIME</li><li>新エリアのカフェを地図で表示可能に</li></ul>' },
  { date: '2026-07-15', time: '19:30', text: '<b>関連アプリモーダル追加・ポータルサイト公開</b><ul><li>ヘッダーに「関連アプリ」ボタンを追加</li><li>TDL天気予報・おみくじアプリへのリンク</li><li>ポータルページ (Web Applications Portfolio) を公開</li></ul>' },
  { date: '2026-07-15', time: '18:20', text: '<b>位置決め時に仮ピン表示</b><ul><li>地図タップ時に青いプレビューマーカーが表示されるように</li></ul>' },
  { date: '2026-07-15', time: '17:30', text: '<b>スターバックス13店舗を追加</b><ul><li>渋谷マークシティ、ストリーム、TSUTAYA、フクラス、ヒカリエ、クロスタワー、公園通り、パルコ、モディ、cocoti、3丁目、文化村通り</li><li>マーカー色をスタバグリーンに設定</li></ul>' },
  { date: '2026-07-15', time: '16:30', text: '<b>UIデザインを一新</b><ul><li>モダンなトースト通知を実装</li><li>グラスモフィズムとアースカラーの適用</li></ul>' },
  { date: '2026-07-15', time: '16:00', text: '<b>会員登録・ログイン機能を追加</b><ul><li>メールアドレス＋パスワードでの会員登録・ログイン</li><li>ログイン中のみカフェ登録・編集・削除・コメント・いいねが可能に</li><li>操作ログ機能（誰がいつ何をしたか記録）</li><li>ユーザーネーム設定（重複不可）</li><li>いいね機能の重複防止（likesテーブル）</li><li>コメント時の名前入力を廃止しログインユーザー名を自動使用</li></ul>' },
  { date: '2026-07-14', time: '18:30', text: '<b>Supabase 対応</b><ul><li>データ保存先を localStorage から Supabase に移行</li><li>RLSポリシー設定、GRANT権限付与</li></ul>' },
  { date: '2026-07-20', time: '21:00', text: '<b>スマホ最適化・おすすめUI改善・各種リファクタ</b><ul><li>おすすめカフェをモーダルからボトムシートに変更（画面下部スライド）</li><li>ヘッダーオーバーフローメニュー追加（スマホでは一部ボタンを...に格納）</li><li>フォームパネルを PC ではセンターモーダル、スマホではボトムシートに</li><li>認証バーを PC では左下フローティング、スマホでは固定ヘッダーに</li><li>CSSを変数化しダークモード対応を強化</li><li>ポータルにラーメンマップ追加、tdl-weather を独立リポジトリ化</li></ul>' },
  { date: '2026-07-20', time: '23:30', text: '<b>天気予報クリックで時間別予報を表示</b><ul><li>天気ウィジェットをタップすると1時間ごとの気温・天気アイコンをモーダル表示</li><li>Open-Meteo APIで当日24時間分の時間別データを取得</li><li>現在時刻の枠はアクセントカラーで強調表示</li></ul>' },
  { date: '2026-07-21', time: '01:00', text: '<b>関連アプリモーダル改善＋tdl-weather関連アプリ追加</b><ul><li>関連アプリに「ポータルサイトに戻る」を先頭表示</li><li>現在開いているアプリを一覧から自動除外（pathname比較）</li><li>tdl-weatherに関連アプリモーダルを新設（ポータル戻る＋全アプリリンク）</li><li>tdl-weatherをcafe-mapリポジトリから独立（.gitignore管理）</li></ul>' },
  { date: '2026-07-21', time: '02:00', text: '<b>利用規約を追加</b><ul><li>ヘッダーに「利用規約」ボタンを追加</li><li>モーダルで全5条の利用規約を表示（適用・登録・禁止事項・免責・変更）</li><li>スマホでは...メニューに格納</li></ul>' }
];

function renderChangelog() {
  var body = document.getElementById('changelogBody');
  body.innerHTML = CHANGELOG.map(function (e) {
    return '<div class="changelog-entry"><div class="changelog-date">' + e.date + ' <span>' + e.time + '</span></div><div class="changelog-text">' + e.text + '</div></div>';
  }).join('');
}
document.getElementById('changelogBtn').addEventListener('click', function () { renderChangelog(); document.getElementById('changelogModal').classList.add('open'); });
document.getElementById('changelogClose').addEventListener('click', function () { document.getElementById('changelogModal').classList.remove('open'); });
document.getElementById('changelogModal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });
document.getElementById('termsBtn').addEventListener('click', function () { document.getElementById('termsModal').classList.add('open'); });
document.getElementById('termsClose').addEventListener('click', function () { document.getElementById('termsModal').classList.remove('open'); });
document.getElementById('termsModal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });

var currentUserId = null; var currentUsername = null; var currentEmail = null; var isRegisterMode = false;
var authNotLoggedIn = document.getElementById('authNotLoggedIn'); var authLoggedIn = document.getElementById('authLoggedIn');
var authEmailInput = document.getElementById('authEmail'); var authPasswordInput = document.getElementById('authPassword');
var authUsernameInput = document.getElementById('authUsername'); var authRegisterArea = document.getElementById('authRegisterArea');
var authLoginBtn = document.getElementById('authLoginBtn'); var authRegisterBtn = document.getElementById('authRegisterBtn');
var authToggleLink = document.getElementById('authToggleLink'); var authError = document.getElementById('authError');
var authGreeting = document.getElementById('authGreeting'); var authUsernameDisplay = document.getElementById('authUsernameDisplay');
var authEmailDisplay = document.getElementById('authEmailDisplay'); var authLogoutBtn = document.getElementById('authLogoutBtn');

function authShowError(msg) { authError.textContent = msg; } function authClearError() { authError.textContent = ''; }

function updateAuthUI(session) {
  authClearError();
  if (session) {
    authNotLoggedIn.classList.add('auth-hidden'); authLoggedIn.classList.remove('auth-hidden');
    currentUserId = session.user.id; currentEmail = session.user.email; authEmailDisplay.textContent = currentEmail; document.body.classList.add('logged-in');
    authGreeting.textContent = 'こんにちは、...';
    supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle().then(function (res) {
      var setup = document.getElementById('authUsernameSetup');
      if (res.data && res.data.username) {
        currentUsername = res.data.username; authUsernameDisplay.textContent = currentUsername;
        authUsernameDisplay.classList.remove('auth-hidden'); setup.classList.add('auth-hidden');
        authGreeting.textContent = 'こんにちは、' + currentUsername + 'さん';
      } else {
        var pending = sessionStorage.getItem('pendingUsername');
        if (pending) {
          sessionStorage.removeItem('pendingUsername');
          supabase.from('profiles').insert({ id: session.user.id, username: pending }).then(function (ins) {
            if (!ins.error) {
              currentUsername = pending; authUsernameDisplay.textContent = pending;
              authUsernameDisplay.classList.remove('auth-hidden'); setup.classList.add('auth-hidden');
              authGreeting.textContent = 'こんにちは、' + pending + 'さん';
              return;
            }
          });
        }
        if (!currentUsername) {
          authUsernameDisplay.classList.add('auth-hidden'); setup.classList.remove('auth-hidden');
          authGreeting.textContent = 'こんにちは、' + currentEmail + '（ユーザーネーム未設定）';
        }
      }
    });
  } else {
    authNotLoggedIn.classList.remove('auth-hidden'); authLoggedIn.classList.add('auth-hidden');
    currentUserId = null; currentUsername = null; currentEmail = null; document.body.classList.remove('logged-in');
    authGreeting.textContent = 'こんにちは、ゲストさん';
  }
}

supabase.auth.onAuthStateChange(function (event, session) {
  if (event === 'SIGNED_OUT') { updateAuthUI(null); } else if (session) { updateAuthUI(session); }
});

authToggleLink.addEventListener('click', function () {
  isRegisterMode = !isRegisterMode;
  if (isRegisterMode) {
    authRegisterArea.classList.remove('auth-hidden'); authLoginBtn.classList.add('auth-hidden');
    authRegisterBtn.classList.remove('auth-hidden'); authToggleLink.textContent = 'すでにアカウントをお持ちの方はこちら';
  } else {
    authRegisterArea.classList.add('auth-hidden'); authLoginBtn.classList.remove('auth-hidden');
    authRegisterBtn.classList.add('auth-hidden'); authToggleLink.textContent = 'アカウントをお持ちでない方はこちら';
  }
  authClearError();
});

authLoginBtn.addEventListener('click', async function () {
  var email = authEmailInput.value.trim(); var password = authPasswordInput.value.trim();
  if (!email || !password) { authShowError('メールアドレスとパスワードを入力してください'); return; }
  authShowError('ログイン中...');
  var res = await supabase.auth.signInWithPassword({ email: email, password: password });
  if (res.error) { authShowError(res.error.message); return; }
  authEmailInput.value = ''; authPasswordInput.value = ''; authClearError();
  showToast('ログインしました。');
});

authRegisterBtn.addEventListener('click', async function () {
  var email = authEmailInput.value.trim(); var password = authPasswordInput.value.trim(); var username = authUsernameInput.value.trim();
  if (!email || !password || !username) { authShowError('全ての項目を入力してください'); return; }
  var { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) { authShowError('このユーザーネームは既に使用されています'); return; }
  authShowError('登録中...');
  var res = await supabase.auth.signUp({ email: email, password: password });
  if (res.error) { authShowError(res.error.message); return; }
  if (res.data.session) {
    var uid = res.data.user.id;
    var { error: profErr } = await supabase.from('profiles').insert({ id: uid, username: username });
    if (profErr) { authShowError('プロフィール作成失敗: ' + profErr.message); return; }
    currentUsername = username;
    showToast('登録が完了しました。');
  } else {
    sessionStorage.setItem('pendingUsername', username);
    showToast('確認メールを送信しました。'); return;
  }
  authEmailInput.value = ''; authPasswordInput.value = ''; authUsernameInput.value = ''; authClearError();
});

authLogoutBtn.addEventListener('click', async function () {
  await supabase.auth.signOut();
  showToast('ログアウトしました。');
});

document.getElementById('authSetupBtn').addEventListener('click', function () { setupUsername(document.getElementById('authSetupUsername').value.trim()); });

var actionLogBody = document.getElementById('actionLogBody');
async function fetchActionLogs() {
  var { data, error } = await supabase.from('action_log').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) { return []; } return data || [];
}
async function insertActionLog(action, cafeName) {
  if (!currentUsername) return;
  await supabase.from('action_log').insert({ username: currentUsername, action: action, cafe_name: cafeName || '' });
}
function renderActionLog() {
  actionLogBody.innerHTML = '<div class="action-log-loading">読み込み中...</div>';
  fetchActionLogs().then(function (logs) {
    if (!logs || !logs.length) { actionLogBody.innerHTML = '<div class="action-log-empty">まだ操作ログはありません</div>'; return; }
    actionLogBody.innerHTML = logs.map(function (l) {
      var cafeText = l.cafe_name ? '「' + escHtml(l.cafe_name) + '」' : '';
      var time = l.created_at ? new Date(l.created_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      return '<div class="action-log-item"><span class="action-log-user">' + escHtml(l.username) + '</span> が ' + cafeText + l.action + '<br><span class="action-log-time">' + time + '</span></div>';
    }).join('');
  });
}
document.getElementById('actionLogBtn').addEventListener('click', function () { renderActionLog(); document.getElementById('actionLogModal').classList.add('open'); });
document.getElementById('actionLogClose').addEventListener('click', function () { document.getElementById('actionLogModal').classList.remove('open'); });
document.getElementById('actionLogModal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });

function requireLogin() {
  if (!currentEmail) { showToast('ログインが必要です。'); return false; }
  if (checkBanAndWarn()) return false;
  return true;
}

async function setupUsername(username) {
  if (!username) { showToast('ユーザーネームを入力してください。'); return; }
  var { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) { showToast('このユーザーネームは既に使用されています。'); return; }
  var { data: sessData } = await supabase.auth.getSession();
  var uid = sessData?.session?.user?.id;
  if (!uid) { showToast('セッションが切れました。再ログインしてください。'); return; }
  var { error } = await supabase.from('profiles').insert({ id: uid, username: username });
  if (error) { showToast('ユーザーネームの設定に失敗しました。'); return; }
  currentUsername = username; authUsernameDisplay.textContent = username; authUsernameDisplay.classList.remove('auth-hidden');
  document.getElementById('authUsernameSetup').classList.add('auth-hidden'); authGreeting.textContent = 'こんにちは、' + username + 'さん';
}

var _origOpenForm = openForm;
openForm = function () { if (!requireLogin()) return; _origOpenForm(); };
map.off('click');
map.on('click', function (e) {
  if (editingId !== null) {
    if (!formPanel.classList.contains('open')) return;
    cafeLat.value = e.latlng.lat.toFixed(6); cafeLng.value = e.latlng.lng.toFixed(6); fetchAddress(e.latlng.lat, e.latlng.lng); updateTempPreviewMarker(e.latlng.lat, e.latlng.lng); return;
  }
  if (!requireLogin()) return;
  if (!formPanel.classList.contains('open')) { setFormMode('add'); openForm(); }
  cafeLat.value = e.latlng.lat.toFixed(6); cafeLng.value = e.latlng.lng.toFixed(6); fetchAddress(e.latlng.lat, e.latlng.lng); updateTempPreviewMarker(e.latlng.lat, e.latlng.lng);
});

await fetchCafes();

// ===== 写真情報の読み込み =====
loadPhotoUrls().then(function () { renderAllCafes(); renderList(); });

// ===== 営業情報の定期更新（1分ごと） =====
setInterval(function () { renderList(); }, 60000);

// ===== 天気予報 =====
(function () {
  var el = document.getElementById('weatherWidget');
  if (!el) return;
  var ICONS = { 0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌦️',56:'🌦️',57:'🌦️',61:'🌧️',63:'🌧️',65:'🌧️',66:'🌧️',67:'🌧️',71:'❄️',73:'❄️',75:'❄️',77:'❄️',80:'🌦️',81:'🌦️',82:'🌦️',85:'❄️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️' };
  var hourlyData = [];
  function fetchWeather() {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=35.6580&longitude=139.7016&current_weather=true&hourly=temperature_2m,weathercode&timezone=Asia%2FTokyo&forecast_days=1')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.current_weather) return;
        var w = d.current_weather;
        var icon = ICONS[w.weathercode] || '🌤️';
        el.innerHTML = '<span class="icon">' + icon + '</span><span class="temp">' + Math.round(w.temperature) + '°C</span>';
        if (d.hourly && d.hourly.time) {
          hourlyData = d.hourly.time.map(function (t, i) {
            return { time: t, temp: d.hourly.temperature_2m[i], code: d.hourly.weathercode[i] };
          });
        }
      })
      .catch(function () { /* ignore */ });
  }
  function renderForecast() {
    var now = new Date();
    var currentHour = now.getHours();
    var body = document.getElementById('weatherForecastBody');
    if (!body || hourlyData.length === 0) return;
    var html = '<div class="forecast-grid">';
    hourlyData.forEach(function (h) {
      var parts = h.time.split('T');
      var hour = parseInt(parts[1].split(':')[0], 10);
      var isNow = (hour === currentHour);
      var icon = ICONS[h.code] || '🌤️';
      var label = isNow ? 'Now' : hour.toString().padStart(2, '0') + ':00';
      html += '<div class="forecast-hour' + (isNow ? ' forecast-hour-now' : '') + '">';
      html += '<div class="forecast-hour-time">' + label + '</div>';
      html += '<div class="forecast-hour-icon">' + icon + '</div>';
      html += '<div class="forecast-hour-temp">' + Math.round(h.temp) + '°C</div>';
      html += '</div>';
    });
    html += '</div>';
    body.innerHTML = html;
  }
  el.style.cursor = 'pointer';
  el.title = 'タップで時間別予報';
  el.addEventListener('click', function () {
    renderForecast();
    document.getElementById('weatherModal').classList.add('open');
  });
  document.getElementById('weatherClose').addEventListener('click', function () {
    document.getElementById('weatherModal').classList.remove('open');
  });
  fetchWeather();
  setInterval(fetchWeather, 600000);
})();

// ===== 関連アプリモーダルの表示制御 =====
document.getElementById('appsBtn').addEventListener('click', function () {
  document.getElementById('appsModal').classList.add('open');
});
document.getElementById('appsClose').addEventListener('click', function () {
  document.getElementById('appsModal').classList.remove('open');
});
document.getElementById('appsModal').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('open');
});

// イベントデリゲーションによる動的レンダリングカードの処理
document.getElementById('appsBody').addEventListener('click', function (e) {
  var card = e.target.closest('.app-link-card');
  if (!card) return;
  var action = card.getAttribute('data-action');
  if (action === 'portal') {
    location.href = 'https://class.tama.net/~p225C0442/';
    return;
  }
  var idx = parseInt(card.getAttribute('data-index'), 10);
  if (isNaN(idx)) return;
  var app = appLinks[idx];
  if (!app) return;
  if (app.target === 'self') { location.href = app.url; }
  else { window.open(app.url, '_blank'); }
});

// ===== 管理パネル =====
var adminBtn = document.getElementById('adminBtn');
var adminModal = document.getElementById('adminModal');
var adminBody = document.getElementById('adminBody');
var adminUserList = document.getElementById('adminUserList');

function isAdmin() { return adminIds.indexOf(currentUserId) !== -1; }

function loadAdminList() {
  return supabase.from('cafes').select('comment').eq('id', ADMINS_CAFE_ID).limit(1).then(function (res) {
    if (res.data && res.data.length) {
      try { var d = JSON.parse(res.data[0].comment || '{}'); adminIds = d.admins || []; } catch (e) { adminIds = []; }
    } else { adminIds = []; }
  });
}

function saveAdminList() {
  supabase.from('cafes').update({ comment: JSON.stringify({ admins: adminIds }) }).eq('id', ADMINS_CAFE_ID).then();
}

function loadAdminBans() {
  return supabase.from('cafes').select('comment').eq('id', BANS_CAFE_ID).limit(1).then(function (res) {
    if (res.data && res.data.length) {
      try { var d = JSON.parse(res.data[0].comment || '{}'); bannedIds = d.banned || []; } catch (e) { bannedIds = []; }
    } else { bannedIds = []; }
  });
}

function saveAdminBans() {
  supabase.from('cafes').update({ comment: JSON.stringify({ banned: bannedIds }) }).eq('id', BANS_CAFE_ID).then();
}

function isUserBanned(uid) { return bannedIds.indexOf(uid) !== -1; }

function checkBanAndWarn() {
  if (currentUserId && isUserBanned(currentUserId)) {
    showToast('このアカウントは制限されています');
    return true;
  }
  return false;
}

function renderAdminUserList() {
  supabase.from('profiles').select('*').then(function (res) {
    if (res.error) { adminUserList.innerHTML = '<div class="list-empty">読み込みエラー</div>'; return; }
    var users = res.data || [];
    var html = '';
    users.forEach(function (u) {
      var isBanned = isUserBanned(u.id);
      var isAdminUser = adminIds.indexOf(u.id) !== -1;
      var rowClass = 'admin-user-row' + (isBanned ? ' admin-user-row-banned' : '');
      var badges = '';
      if (isAdminUser) badges = '<span class="admin-user-badge" style="background:#efe8e1;color:#966642;">管理者</span>';
      if (isBanned) badges += '<span class="admin-user-badge admin-user-badge-banned">BANNED</span>';

      html += '<div class="' + rowClass + '">' +
        '<div class="admin-user-info">' +
        '<div class="admin-user-name">' + (u.username || '(ユーザーネーム未設定)') + badges + '</div>' +
        '<div class="admin-user-id">' + String(u.id) + '</div>' +
        '</div><div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;">';

      if (!isBanned) {
        html += '<button class="admin-btn-ban admin-btn-ban-ban" data-uid="' + u.id + '" data-action="ban">BAN</button>';
      } else {
        html += '<button class="admin-btn-ban admin-btn-ban-unban" data-uid="' + u.id + '" data-action="unban">解除</button>';
      }

      if (isAdminUser) {
        if (u.id !== currentUserId) {
          html += '<button class="admin-btn-ban admin-btn-ban-ban" data-uid="' + u.id + '" data-action="demote">管理者解除</button>';
        }
      } else {
        html += '<button class="admin-btn-ban admin-btn-ban-unban" data-uid="' + u.id + '" data-action="promote">管理者追加</button>';
      }
      
      html += '<button class="admin-btn-delete" data-uid="' + u.id + '" data-username="' + (u.username || '') + '">削除</button>';
      html += '</div></div>';
    });
    if (!users.length) html = '<div class="list-empty">登録ユーザーはいません</div>';
    adminUserList.innerHTML = html;

    adminUserList.querySelectorAll('.admin-btn-ban').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var uid = btn.getAttribute('data-uid');
        var action = btn.getAttribute('data-action');

        if (action === 'ban') {
          if (bannedIds.indexOf(uid) === -1) bannedIds.push(uid);
          saveAdminBans(); renderAdminUserList(); showToast('BANしました');
        } else if (action === 'unban') {
          bannedIds = bannedIds.filter(function (id) { return id !== uid; });
          saveAdminBans(); renderAdminUserList(); showToast('BANを解除しました');
        } else if (action === 'promote') {
          if (adminIds.indexOf(uid) === -1) adminIds.push(uid);
          saveAdminList(); renderAdminUserList(); showToast('管理者に追加しました');
        } else if (action === 'demote') {
          adminIds = adminIds.filter(function (id) { return id !== uid; });
          saveAdminList(); renderAdminUserList(); showToast('管理者を解除しました');
        }
      });
    });

    adminUserList.querySelectorAll('.admin-btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteUserAccount(btn.getAttribute('data-uid'), btn.getAttribute('data-username'));
      });
    });
  });
}

function openAdminPanel() {
  Promise.all([loadAdminList(), loadAdminBans()]).then(function () {
    renderAdminUserList();
    adminModal.classList.add('open');
  });
}

document.getElementById('adminClose').addEventListener('click', function () { adminModal.classList.remove('open'); });
adminModal.addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });

function updateAdminBtn() { adminBtn.style.display = isAdmin() ? '' : 'none'; }
adminBtn.addEventListener('click', openAdminPanel);

loadAdminList().then(function () { updateAdminBtn(); });

var _origUpdateAuthUI = updateAuthUI;
updateAuthUI = function (session) {
  _origUpdateAuthUI(session);
  loadAdminList().then(function () { updateAdminBtn(); });
  if (session && currentUserId && isUserBanned(currentUserId)) {
    showToast('このアカウントは制限されています。');
  }
  var inquiryBtn = document.getElementById('inquiryBtn');
  if (session && currentUserId) { inquiryBtn.style.display = ''; } else { inquiryBtn.style.display = 'none'; }
};

// ===== 問い合わせ機能 =====
var inquiryModal = document.getElementById('inquiryModal');
var inquiryBody = document.getElementById('inquiryBody');
var inquiryHistory = document.getElementById('inquiryHistory');
var inquiryBadge = document.getElementById('inquiryBadge');

function loadInquiries() {
  return supabase.from('cafes').select('comment').eq('id', INQUIRIES_CAFE_ID).limit(1).then(function (res) {
    if (res.data && res.data.length) {
      try { var d = JSON.parse(res.data[0].comment || '{}'); return d.inquiries || []; } catch (e) { return []; }
    }
    return [];
  });
}

function saveInquiries(inquiries) {
  supabase.from('cafes').update({ comment: JSON.stringify({ inquiries: inquiries }) }).eq('id', INQUIRIES_CAFE_ID).then();
}

function inquiryStatusLabel(inq) {
  if (inq.status === 'closed') return { cls: 'closed', label: '解決済み' };
  if (inq.replies && inq.replies.some(function (r) { return r.from === 'admin'; })) return { cls: 'replied', label: '対処済み' };
  return { cls: 'open', label: '未対処' };
}

function renderInquiryHistory() {
  inquiryHistory.innerHTML = '<div class="inquiry-history-title">送信履歴</div>';
  loadInquiries().then(function (inquiries) {
    var mine = inquiries.filter(function (i) { return i.user_id === currentUserId; });
    if (!mine.length) { inquiryHistory.innerHTML += '<div class="inquiry-empty">送信した問い合わせはありません</div>'; return; }
    mine.sort(function (a, b) { return b.id - a.id; });
    mine.forEach(function (inq) {
      var st = inquiryStatusLabel(inq);
      var html = '<div class="inquiry-item">' +
        '<div class="inquiry-item-header">' +
          '<span class="inquiry-item-status ' + st.cls + '">' + st.label + '</span>' +
          '<span class="inquiry-item-time">' + new Date(inq.time).toLocaleString('ja-JP') + '</span>' +
        '</div>' +
        '<div class="inquiry-item-text">' + escHtml(inq.text) + '</div>';
      if (inq.replies && inq.replies.length) {
        inq.replies.forEach(function (r) {
          html += '<div class="inquiry-reply"><label>' + (r.from === 'admin' ? '管理者からの返信' : 'あなたの返信') + '</label><p>' + escHtml(r.text) + '</p><div class="inquiry-reply-time">' + new Date(r.time).toLocaleString('ja-JP') + '</div></div>';
        });
      }
      html += '</div>';
      inquiryHistory.innerHTML += html;
    });
  });
}

function updateInquiryBadge() {
  loadInquiries().then(function (inquiries) {
    var unhandled = inquiries.filter(function (i) {
      if (i.status === 'closed') return false;
      return !(i.replies && i.replies.some(function (r) { return r.from === 'admin'; }));
    }).length;
    if (unhandled > 0) { inquiryBadge.textContent = unhandled; inquiryBadge.style.display = ''; } else { inquiryBadge.style.display = 'none'; }
  });
}

document.getElementById('inquiryBtn').addEventListener('click', function () {
  inquiryModal.classList.add('open');
  renderInquiryHistory();
});

document.getElementById('inquiryClose').addEventListener('click', function () { inquiryModal.classList.remove('open'); });
inquiryModal.addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });

document.getElementById('inquirySendBtn').addEventListener('click', function () {
  if (!currentEmail) { showToast('ログインが必要です。'); return; }
  var text = document.getElementById('inquiryText').value.trim();
  if (!text) { showToast('問い合わせ内容を入力してください'); return; }
  loadInquiries().then(function (inquiries) {
    var maxId = inquiries.reduce(function (m, i) { return Math.max(m, i.id || 0); }, 0);
    inquiries.push({
      id: maxId + 1, user_id: currentUserId, username: currentUsername || '名無し',
      text: text, time: new Date().toISOString(), status: 'open', replies: []
    });
    saveInquiries(inquiries);
    document.getElementById('inquiryText').value = '';
    showToast('問い合わせを送信しました');
    renderInquiryHistory();
    updateInquiryBadge();
  });
});

// ===== 管理パネル タブ切り替え =====
document.querySelectorAll('.admin-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.admin-tab-content').forEach(function (c) { c.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('adminTab' + tab.getAttribute('data-tab').replace(/^\w/, function (c) { return c.toUpperCase(); })).classList.add('active');
    if (tab.getAttribute('data-tab') === 'inquiries') {
      renderAdminInquiries(); updateInquiryBadge();
    }
  });
});

// ===== 管理パネル 問い合わせ管理 =====
function renderAdminInquiries() {
  var list = document.getElementById('adminInquiryList');
  list.innerHTML = '<div style="text-align:center;color:#8c7e73;font-size:13px;padding:20px 0;">読み込み中...</div>';
  loadInquiries().then(function (inquiries) {
    if (!inquiries.length) { list.innerHTML = '<div class="inquiry-empty">問い合わせはありません</div>'; return; }
    inquiries.sort(function (a, b) { return b.id - a.id; });
    var html = '';
    inquiries.forEach(function (inq) {
      var st = inquiryStatusLabel(inq);
      var userLabel = inq.username + ' (' + String(inq.user_id).substring(0, 8) + '...)';
      var replyHtml = '';
      if (inq.replies && inq.replies.length) {
        inq.replies.forEach(function (r) {
          replyHtml += '<div class="admin-inquiry-reply-item"><div class="admin-inquiry-reply-from">' + (r.from === 'admin' ? '管理者' : escHtml(inq.username)) + '</div><div class="admin-inquiry-reply-text">' + escHtml(r.text) + '</div><div class="admin-inquiry-reply-time">' + new Date(r.time).toLocaleString('ja-JP') + '</div></div>';
        });
      }
      html += '<div class="admin-inquiry-card" data-inquiry-id="' + inq.id + '">' +
        '<div class="admin-inquiry-header">' +
          '<span class="admin-inquiry-user">' + escHtml(userLabel) + '</span>' +
          '<span class="inquiry-item-status ' + st.cls + '">' + st.label + '</span>' +
          '<span class="inquiry-item-time">' + new Date(inq.time).toLocaleString('ja-JP') + '</span>' +
        '</div>' +
        '<div class="admin-inquiry-text">' + escHtml(inq.text) + '</div>' +
        '<div class="admin-inquiry-reply-list">' + replyHtml + '</div>';
      if (inq.status === 'open') {
        html += '<div class="admin-inquiry-reply-box">' +
          '<textarea placeholder="返信を入力..."></textarea>' +
          '<div class="admin-inquiry-actions">' +
            '<button class="btn btn-primary admin-inquiry-reply-btn" data-inquiry-id="' + inq.id + '">返信</button>' +
            '<button class="btn btn-cancel admin-inquiry-close-btn" data-inquiry-id="' + inq.id + '">解決済みにする</button>' +
          '</div></div>';
      }
      html += '</div>';
    });
    list.innerHTML = html;

    list.querySelectorAll('.admin-inquiry-reply-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-inquiry-id'), 10);
        var textarea = btn.parentNode.parentNode.querySelector('textarea');
        var text = textarea.value.trim();
        if (!text) { showToast('返信内容を入力してください'); return; }
        loadInquiries().then(function (inquiries) {
          var inq = inquiries.find(function (i) { return i.id === id; });
          if (!inq) { showToast('問い合わせが見つかりません'); return; }
          if (!inq.replies) inq.replies = [];
          inq.replies.push({ from: 'admin', text: text, time: new Date().toISOString() });
          saveInquiries(inquiries); showToast('返信しました');
          renderAdminInquiries(); updateInquiryBadge();
        });
      });
    });

    list.querySelectorAll('.admin-inquiry-close-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-inquiry-id'), 10);
        loadInquiries().then(function (inquiries) {
          var inq = inquiries.find(function (i) { return i.id === id; });
          if (!inq) { showToast('問い合わせが見つかりません'); return; }
          inq.status = 'closed';
          saveInquiries(inquiries); showToast('解決済みにしました');
          renderAdminInquiries(); updateInquiryBadge();
        });
      });
    });
  });
}

document.getElementById('adminBody').addEventListener('click', function (e) {
  if (e.target.id === 'adminInquiryClearAllBtn') {
    if (!confirm('全ての問い合わせを削除しますか？この操作は元に戻せません。')) return;
    supabase.from('cafes').update({ comment: JSON.stringify({ inquiries: [] }) }).eq('id', INQUIRIES_CAFE_ID).then(function () {
      showToast('全ての問い合わせを削除しました');
      renderAdminInquiries();
      updateInquiryBadge();
    });
  }
});

// ===== 管理パネル アカウント削除 =====
function deleteUserAccount(uid, username) {
  if (!confirm('このユーザーのアカウントを削除しますか？\n\n（プロフィール・いいね・操作ログが削除されます。元に戻せません）')) return;
  Promise.all([
    supabase.from('profiles').delete().eq('id', uid),
    supabase.from('likes').delete().eq('user_id', uid),
    supabase.from('action_log').delete().eq('username', username || '')
  ]).then(function () {
    if (bannedIds.indexOf(uid) !== -1) { bannedIds = bannedIds.filter(function (id) { return id !== uid; }); saveAdminBans(); }
    if (adminIds.indexOf(uid) !== -1) { adminIds = adminIds.filter(function (id) { return id !== uid; }); saveAdminList(); }
    showToast('アカウントを削除しました');
    renderAdminUserList();
  }).catch(function () { showToast('削除に失敗しました'); });
}

// ===== ダークモード =====
(function () {
  var toggle = document.getElementById('darkToggle');
  var saved = localStorage.getItem('cafe-dark-mode');
  if (saved === 'true') { document.body.classList.add('dark-mode'); toggle.textContent = '☀️'; }
  toggle.addEventListener('click', function () {
    var isDark = document.body.classList.toggle('dark-mode');
    toggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('cafe-dark-mode', isDark);
  });
})();

// ===== 写真機能 (Supabase cafes id=57) =====
function loadPhotoUrls() {
  return supabase.from('cafes').select('comment').eq('id', PHOTOS_CAFE_ID).limit(1).then(function (res) {
    if (res.data && res.data.length) {
      try { var d = JSON.parse(res.data[0].comment || '{}'); cafePhotoUrls = d.photos || {}; } catch (e) { cafePhotoUrls = {}; }
    } else { cafePhotoUrls = {}; }
  });
}

function savePhotoUrls() {
  supabase.from('cafes').update({ comment: JSON.stringify({ photos: cafePhotoUrls }) }).eq('id', PHOTOS_CAFE_ID).then();
}

var photoPreview = document.getElementById('photoPreview');
var photoPreviewImg = document.getElementById('photoPreviewImg');
var photoInput = document.getElementById('photoInput');
var photoUploadBtn = document.getElementById('photoUploadBtn');
var photoRemoveBtn = document.getElementById('photoRemoveBtn');
var currentPhotoDataUrl = null;

document.getElementById('photoUploadBtn').addEventListener('click', function () { photoInput.click(); });

photoInput.addEventListener('change', function () {
  var file = photoInput.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('画像は2MB以下にしてください'); return; }
  var reader = new FileReader();
  reader.onload = function (e) {
    currentPhotoDataUrl = e.target.result;
    photoPreviewImg.src = currentPhotoDataUrl;
    photoPreview.style.display = '';
    photoUploadBtn.textContent = '写真を変更';
    photoUploadBtn.classList.add('has-photo');
  };
  reader.readAsDataURL(file);
});

photoRemoveBtn.addEventListener('click', function () {
  currentPhotoDataUrl = null;
  photoPreview.style.display = 'none';
  photoInput.value = '';
  photoUploadBtn.textContent = '写真を選択';
  photoUploadBtn.classList.remove('has-photo');
});

var _origSetFormMode2 = setFormMode;
setFormMode = function (mode, cafe) {
  _origSetFormMode2(mode, cafe);
  if (mode === 'edit' && cafe && cafePhotoUrls[cafe.id]) {
    currentPhotoDataUrl = cafePhotoUrls[cafe.id];
    photoPreviewImg.src = currentPhotoDataUrl;
    photoPreview.style.display = '';
    photoUploadBtn.textContent = '写真を変更';
    photoUploadBtn.classList.add('has-photo');
  } else {
    currentPhotoDataUrl = null;
    photoPreview.style.display = 'none';
    photoInput.value = '';
    photoUploadBtn.textContent = '写真を選択';
    photoUploadBtn.classList.remove('has-photo');
  }
};

var _origResetFormFields2 = resetFormFields;
resetFormFields = function () {
  _origResetFormFields2();
  currentPhotoDataUrl = null;
  photoPreview.style.display = 'none';
  photoInput.value = '';
  photoUploadBtn.textContent = '写真を選択';
  photoUploadBtn.classList.remove('has-photo');
};

var _origInsertCafe2 = insertCafe;
insertCafe = async function (cafe) {
  var res = await _origInsertCafe2(cafe);
  if (currentPhotoDataUrl) { cafePhotoUrls[res.id] = currentPhotoDataUrl; savePhotoUrls(); }
  return res;
};
var _origUpdateCafe2 = updateCafe;
updateCafe = async function (id, cafe) {
  await _origUpdateCafe2(id, cafe);
  if (currentPhotoDataUrl) { cafePhotoUrls[id] = currentPhotoDataUrl; savePhotoUrls(); }
  else if (cafePhotoUrls[id]) { delete cafePhotoUrls[id]; savePhotoUrls(); }
};

// ===== いいね一覧 =====
var likesBtn = document.getElementById('likesBtn');
var likesModal = document.getElementById('likesModal');
var likesList = document.getElementById('likesList');

function renderLikesList() {
  likesList.innerHTML = '<div style="text-align:center;color:#8c7e73;font-size:13px;padding:20px 0;">読み込み中...</div>';
  if (!currentUserId) { likesList.innerHTML = '<div class="likes-empty">ログインが必要です</div>'; return; }
  supabase.from('likes').select('cafe_id').eq('user_id', currentUserId).then(function (res) {
    if (res.error) { likesList.innerHTML = '<div class="likes-empty">読み込みエラー</div>'; return; }
    var likedIds = (res.data || []).map(function (l) { return l.cafe_id; });
    var liked = cafes.filter(function (c) { return likedIds.indexOf(c.id) !== -1; });
    if (!liked.length) { likesList.innerHTML = '<div class="likes-empty">いいねしたカフェはありません</div>'; return; }
    var colors = ['#b5825a', '#2d9cdb', '#27ae60', '#e67e22', '#9b59b6', '#e74c3c', '#1abc9c'];
    likesList.innerHTML = liked.map(function (c) {
      var color = colors[Math.abs(c.id) % colors.length];
      return '<div class="likes-item" data-id="' + c.id + '">' +
        '<div class="likes-item-icon" style="background:' + color + '"></div>' +
        '<div class="likes-item-info">' +
          '<div class="likes-item-name">' + c.name + '</div>' +
          '<div class="likes-item-addr">' + c.address + '</div>' +
        '</div></div>';
    }).join('');
    likesList.querySelectorAll('.likes-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = parseInt(el.getAttribute('data-id'), 10);
        focusCafeOnMap(id);
        likesModal.classList.remove('open');
      });
    });
  });
}

likesBtn.addEventListener('click', function () { likesModal.classList.add('open'); renderLikesList(); });
document.getElementById('likesClose').addEventListener('click', function () { likesModal.classList.remove('open'); });
likesModal.addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });

// ===== おすすめカフェ =====
var recommendOverlay = document.getElementById('recommendOverlay');
var recommendContent = document.getElementById('recommendContent');
var _lastRecommendPick = null;

function showRecommend() {
  var available = cafes.filter(function (c) { return c.id > 0 && c.id !== 53 && c.id !== 54 && c.id !== 55 && c.id !== 56 && c.id !== 57 && c.id !== 58; });
  if (!available.length) { recommendContent.innerHTML = '<div class="recommend-empty">カフェが登録されていません</div>'; return; }
  _lastRecommendPick = available[Math.floor(Math.random() * available.length)];
  var pick = _lastRecommendPick;
  var tagsHtml = '';
  if (pick.tags && pick.tags.length) { tagsHtml = '<div class="recommend-tags">' + pick.tags.map(function (t) { return '<span class="tag tag-' + t + '">' + (TAG_LABELS[t] || t) + '</span>'; }).join('') + '</div>'; }
  var st = openStatus(pick);
  recommendContent.innerHTML =
    '<div class="recommend-card">' +
      '<div class="recommend-icon">☕</div>' +
      '<div class="recommend-name">' + escHtml(pick.name) + '</div>' +
      '<div class="recommend-addr">' + escHtml(pick.address) + '</div>' +
      '<div style="margin-bottom:10px"><span class="open-indicator"><span class="dot ' + st.cls + '"></span><span style="font-size:13px;font-weight:700;color:var(--text-secondary)">' + st.label + '</span></span></div>' +
      tagsHtml +
      '<div class="recommend-desc">' + escHtml(pick.desc) + '</div>' +
    '</div>';
}

document.getElementById('recommendBtn').addEventListener('click', function () { recommendOverlay.classList.add('open'); showRecommend(); });
document.getElementById('recommendClose').addEventListener('click', function () { recommendOverlay.classList.remove('open'); });
document.getElementById('recommendRetryBtn').addEventListener('click', showRecommend);
document.getElementById('recommendMapBtn').addEventListener('click', function () {
  if (_lastRecommendPick) {
    focusCafeOnMap(_lastRecommendPick.id);
    recommendOverlay.classList.remove('open');
  }
});
recommendOverlay.addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });

// ===== ヘッダーオーバーフローメニュー =====
var headerMoreBtn = document.getElementById('headerMoreBtn');
var headerDropdown = document.getElementById('headerDropdown');
if (headerMoreBtn) {
  headerMoreBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var items = [];
    var btns = document.querySelectorAll('.header-actions .header-btn');
    btns.forEach(function (btn) {
      if (btn === headerMoreBtn) return;
      if (btn.style.display === 'none') return;
      if (btn.offsetParent === null) items.push(btn);
    });
    if (!items.length) { headerDropdown.classList.remove('open'); return; }
    var html = '';
    items.forEach(function (btn) {
      html += '<button class="header-dropdown-item" data-id="' + btn.id + '">' + btn.textContent + '</button>';
    });
    headerDropdown.innerHTML = html;
    headerDropdown.querySelectorAll('.header-dropdown-item').forEach(function (item) {
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var orig = document.getElementById(this.getAttribute('data-id'));
        if (orig) orig.click();
        headerDropdown.classList.remove('open');
      });
    });
    headerDropdown.classList.toggle('open');
  });
  document.addEventListener('click', function () { headerDropdown.classList.remove('open'); });
}

var _origUpdateAuthUI3 = updateAuthUI;
updateAuthUI = function (session) {
  _origUpdateAuthUI3(session);
  if (session && currentUserId) { likesBtn.style.display = ''; } else { likesBtn.style.display = 'none'; }
};

// ===== 関連アプリ管理 (Supabase cafes id=58) =====
var appLinks = [];

function loadApps() {
  return supabase.from('cafes').select('comment').eq('id', APPS_CAFE_ID).limit(1).then(function (res) {
    if (res.data && res.data.length) {
      try { var d = JSON.parse(res.data[0].comment || '{}'); appLinks = d.apps || []; } catch (e) { appLinks = []; }
    } else { appLinks = []; }
    renderAppsModal();
    renderAdminApps();
  });
}

function saveApps() {
  supabase.from('cafes').update({ comment: JSON.stringify({ apps: appLinks }) }).eq('id', APPS_CAFE_ID).then();
}

function renderAppsModal() {
  var body = document.getElementById('appsBody');
  var html = '<div class="app-link-card" data-action="portal">' +
    '<div class="app-link-info">' +
      '<div class="app-link-title">ポータルサイトに戻る</div>' +
      '<div class="app-link-desc">Web Applications Portfolio を開く</div>' +
    '</div><div class="app-link-arrow">←</div></div>';
  if (!appLinks.length) { body.innerHTML = html; return; }
  var currentPath = location.pathname.replace(/\/$/, '');
  html += appLinks.map(function (a, i) {
    try {
      var appPath = new URL(a.url).pathname.replace(/\/$/, '');
      if (currentPath.indexOf(appPath) !== -1 || appPath.indexOf(currentPath) !== -1) return '';
    } catch(e) {}
    return '<div class="app-link-card" data-index="' + i + '">' +
      '<div class="app-link-info">' +
        '<div class="app-link-title">' + escHtml(a.title) + '</div>' +
        '<div class="app-link-desc">' + escHtml(a.desc) + '</div>' +
      '</div><div class="app-link-arrow">→</div></div>';
  }).filter(Boolean).join('');
  body.innerHTML = html;
}

function renderAdminApps() {
  var list = document.getElementById('adminAppsList');
  if (!list) return;
  if (!appLinks.length) { list.innerHTML = '<div class="list-empty">登録されたアプリはありません</div>'; return; }
  list.innerHTML = appLinks.map(function (a, i) {
    return '<div class="admin-app-card" data-index="' + i + '">' +
      '<div class="admin-app-info">' +
        '<div class="admin-app-title">' + escHtml(a.title) + '</div>' +
        '<div class="admin-app-desc">' + escHtml(a.desc) + '</div>' +
        '<div class="admin-app-url">' + escHtml(a.url) + '</div>' +
      '</div>' +
      '<div class="admin-app-actions">' +
        '<button class="admin-app-edit-btn" data-index="' + i + '">編集</button>' +
        '<button class="admin-app-del-btn" data-index="' + i + '">削除</button>' +
      '</div></div>';
  }).join('');
  list.querySelectorAll('.admin-app-edit-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var i = parseInt(btn.getAttribute('data-index'), 10);
      showAppEditModal(i);
    });
  });
  list.querySelectorAll('.admin-app-del-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var i = parseInt(btn.getAttribute('data-index'), 10);
      if (!confirm('「' + appLinks[i].title + '」を削除しますか？')) return;
      appLinks.splice(i, 1);
      saveApps(); renderAdminApps(); renderAppsModal(); showToast('削除しました');
    });
  });
}

function showAppEditModal(index) {
  var app = index >= 0 ? appLinks[index] : { title: '', desc: '', url: '', target: 'blank' };
  var isNew = index < 0;
  var overlay = document.createElement('div');
  overlay.className = 'app-edit-overlay';
  overlay.innerHTML =
    '<div class="app-edit-modal">' +
      '<h3>' + (isNew ? 'アプリを追加' : 'アプリを編集') + '</h3>' +
      '<div class="form-group"><label>タイトル</label><input type="text" id="appEditTitle" value="' + escHtml(app.title) + '"></div>' +
      '<div class="form-group"><label>説明</label><input type="text" id="appEditDesc" value="' + escHtml(app.desc) + '"></div>' +
      '<div class="form-group"><label>URL</label><input type="text" id="appEditUrl" value="' + escHtml(app.url) + '"></div>' +
      '<div class="form-group"><label>開き方</label><select id="appEditTarget"><option value="blank" ' + (app.target === 'blank' ? 'selected' : '') + '>新しいタブ</option><option value="self" ' + (app.target === 'self' ? 'selected' : '') + '>同じタブ</option></select></div>' +
      '<div class="form-actions">' +
        '<button class="btn btn-cancel" id="appEditCancel">キャンセル</button>' +
        '<button class="btn btn-primary" id="appEditSave">保存</button>' +
      '</div></div>';
  document.body.appendChild(overlay);
  document.getElementById('appEditCancel').addEventListener('click', function () { overlay.remove(); });
  document.getElementById('appEditSave').addEventListener('click', function () {
    var title = document.getElementById('appEditTitle').value.trim();
    var desc = document.getElementById('appEditDesc').value.trim();
    var url = document.getElementById('appEditUrl').value.trim();
    var target = document.getElementById('appEditTarget').value;
    if (!title || !url) { showToast('タイトルとURLは必須です'); return; }
    if (isNew) { appLinks.push({ title: title, desc: desc, url: url, target: target }); }
    else { appLinks[index] = { title: title, desc: desc, url: url, target: target }; }
    saveApps(); renderAdminApps(); renderAppsModal(); overlay.remove();
    showToast(isNew ? '追加しました' : '更新しました');
  });
}

document.getElementById('adminAppAddBtn').addEventListener('click', function () { showAppEditModal(-1); });

var appTabBtn = document.querySelector('.admin-tab[data-tab="apps"]');
if (appTabBtn) { appTabBtn.addEventListener('click', function () { renderAdminApps(); }); }

loadApps();