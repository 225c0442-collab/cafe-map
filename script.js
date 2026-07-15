import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://nwlfxjtunbqjkwpiaury.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bGZ4anR1bmJxamt3cGlhdXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTMxOTMsImV4cCI6MjA5OTU4OTE5M30.1ew82vNMtwqqm97-neRxW21hHTW4LH2NmbNZ230rppU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// トースト通知機能 (絵文字引数を削除)
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
  pet: 'ペット可', smoking: '喫煙可', quiet: '静かな空間'
};
const TAG_KEYS = Object.keys(TAG_LABELS);

let cafes = [];
let editingId = null;
let activeTagFilter = null;
let searchQuery = '';

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

function makePopupContent(cafe) {
  var tagsHtml = '';
  if (cafe.tags && cafe.tags.length) {
    tagsHtml = '<div class="popup-tags">' + cafe.tags.map(function (t) { return '<span class="tag tag-' + t + '">' + (TAG_LABELS[t] || t) + '</span>'; }).join('') + '</div>';
  }
  var detailHtml = '';
  if (cafe.hours || cafe.wifi !== undefined || cafe.power !== undefined || cafe.parking !== undefined) {
    detailHtml = '<div class="popup-detail">';
    if (cafe.hours) detailHtml += '<div class="popup-detail-row">営業時間: ' + cafe.hours + '</div>';
    if (cafe.wifi !== undefined) detailHtml += boolHtml('Wi-Fi', cafe.wifi);
    if (cafe.power !== undefined) detailHtml += boolHtml('電源', cafe.power);
    if (cafe.parking !== undefined) detailHtml += boolHtml('駐車場', cafe.parking);
    detailHtml += '</div>';
  }
  return (
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
        '<input type="text" class="comment-nick" placeholder="名前" maxlength="20">' +
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

var formToggle = document.getElementById('formToggle');
var formPanel = document.getElementById('formPanel');
var formTitle = document.getElementById('formTitle');
var formSubmit = document.getElementById('formSubmit');
var formCancel = document.getElementById('formCancel');
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
  formPanel.classList.add('open'); formToggle.classList.add('open');
  formToggle.innerHTML = '×'; hint.classList.add('show'); cafeName.focus();
}

function closeForm() {
  formPanel.classList.remove('open'); formToggle.classList.remove('open');
  formToggle.innerHTML = '+'; hint.classList.remove('show');
  if (!submitting) { setFormMode('add'); }
  submitting = false;
}

formToggle.addEventListener('click', function () {
  if (formPanel.classList.contains('open')) { closeForm(); } else { setFormMode('add'); openForm(); }
});
formCancel.addEventListener('click', function () { setFormMode('add'); closeForm(); });

map.on('click', function (e) {
  if (editingId !== null) {
    if (!formPanel.classList.contains('open')) return;
    cafeLat.value = e.latlng.lat.toFixed(6); cafeLng.value = e.latlng.lng.toFixed(6); fetchAddress(e.latlng.lat, e.latlng.lng); return;
  }
  if (!formPanel.classList.contains('open')) { setFormMode('add'); openForm(); }
  cafeLat.value = e.latlng.lat.toFixed(6); cafeLng.value = e.latlng.lng.toFixed(6); fetchAddress(e.latlng.lat, e.latlng.lng);
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
    var nick = form.querySelector('.comment-nick');
    var text = form.querySelector('.comment-text');
    if (!nick.value.trim()) { showToast('名前を入力してください'); return; }
    if (!text.value.trim()) { showToast('コメントを入力してください'); return; }
    insertComment(cafeId, nick.value.trim(), text.value.trim()).then(function () {
      nick.value = ''; text.value = '';
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
    return (
      '<div class="list-item" data-id="' + c.id + '">' +
        '<div class="list-item-marker" style="background:' + color + '"></div>' +
        '<div class="list-item-info">' +
          '<div class="list-item-name">' + c.name + '</div><div class="list-item-addr">' + c.address + '</div>' + tagsHtml +
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
  { date: '2026-07-15', time: '16:30', text: '<b>UIデザインを一新</b><ul><li>モダンなトースト通知を実装</li><li>グラスモフィズムとアースカラーの適用</li></ul>' },
  { date: '2026-07-15', time: '16:00', text: '<b>会員登録・ログイン機能を追加</b><ul><li>メールアドレス＋パスワードでの会員登録・ログイン</li><li>ログイン中のみカフェ登録・編集・削除・コメントが可能に</li><li>操作ログ機能（誰がいつ何をしたか記録）</li><li>ユーザーネーム設定（重複不可）</li></ul>' },
  { date: '2026-07-14', time: '18:30', text: '<b>Supabase 対応</b><ul><li>データ保存先を localStorage から Supabase に移行</li></ul>' }
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
    var prefix = currentEmail ? currentEmail.split('@')[0] : '';
    authGreeting.textContent = 'こんにちは、' + prefix + 'さん';
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
          var suggested = currentEmail ? currentEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') : 'user';
          supabase.from('profiles').insert({ id: session.user.id, username: suggested }).then(function (ins) {
            if (!ins.error) {
              currentUsername = suggested; authUsernameDisplay.textContent = suggested;
              authUsernameDisplay.classList.remove('auth-hidden'); setup.classList.add('auth-hidden');
              authGreeting.textContent = 'こんにちは、' + suggested + 'さん';
            } else {
              authUsernameDisplay.classList.add('auth-hidden'); setup.classList.remove('auth-hidden');
            }
          });
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
    cafeLat.value = e.latlng.lat.toFixed(6); cafeLng.value = e.latlng.lng.toFixed(6); fetchAddress(e.latlng.lat, e.latlng.lng); return;
  }
  if (!requireLogin()) return;
  if (!formPanel.classList.contains('open')) { setFormMode('add'); openForm(); }
  cafeLat.value = e.latlng.lat.toFixed(6); cafeLng.value = e.latlng.lng.toFixed(6); fetchAddress(e.latlng.lat, e.latlng.lng);
});

await fetchCafes();