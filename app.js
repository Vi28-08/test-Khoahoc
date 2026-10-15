/* Tra cứu khóa học & lịch học — vanilla JS, không phụ thuộc thư viện.
   Dữ liệu: Google Sheets -> Apps Script (JSON). Để trống API_URL để chạy bằng dữ liệu mẫu. */
(() => {
  'use strict';

  const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbxbZ1LF1q2cryIdpuBjgexeOcsT3G6tyNiScr3jfMpJ0PPWqZrMzISSLE1fboj3pmBx/exec',              // dán URL Web App của Apps Script vào đây
    CACHE_KEY: 'kh_cache_v1',
    MEET_KEY: 'kh_meet_v1',
    STALE_MS: 60000,          // dữ liệu cũ hơn 60 giây thì tải lại ngầm
    GRACE_DAYS: 7             // quá N ngày kể từ khai giảng => "học video"
  };

  const VN = 7 * 3600e3;
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const STATE_LABEL = { off: 'Nghỉ', makeup: 'Học bù', changed: 'Đổi lịch' };

  /* ---------- tiện ích ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const nowVN = () => new Date(Date.now() + VN).toISOString();
  const todayISO = () => nowVN().slice(0, 10);
  const timeNow = () => nowVN().slice(11, 16);
  const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
  const fmtDate = iso => (iso ? iso.split('-').reverse().join('/') : '');
  const fmtShort = iso => (iso ? iso.slice(8) + '/' + iso.slice(5, 7) : '');
  const wday = iso => WD[new Date(iso + 'T00:00:00Z').getUTCDay()];
  const money = n => (Number(n) ? Number(n).toLocaleString('vi-VN') + ' đ' : 'Liên hệ');
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // Chỉ cho phép link https (và zalo.me) — dữ liệu Sheet là nội dung do người khác nhập
  const safeUrl = u => {
    try {
      const x = new URL(String(u || '').trim());
      if (x.protocol === 'https:' || (x.protocol === 'http:' && x.hostname === 'zalo.me')) return x.href;
    } catch (e) { /* bỏ qua */ }
    return '';
  };

  // Dựng DOM bằng textContent (không dùng innerHTML) để tránh chèn mã độc từ Sheet
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false || kid === '') continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- trạng thái ---------- */
  const S = {
    data: null, t: 0, dirty: true,
    q: '', level: '', mode: '', status: '',
    view: 'list', month: '', monthFor: '',
    meet: {}, courses: [], classes: [], cById: new Map(), clById: new Map(), sessByClass: new Map()
  };
  let R = { page: 'courses', id: '' };
  try { S.meet = JSON.parse(sessionStorage.getItem(CONFIG.MEET_KEY) || '{}'); } catch (e) { S.meet = {}; }

  /* ---------- nạp dữ liệu (stale-while-revalidate) ---------- */
  const readCache = () => { try { return JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY)); } catch (e) { return null; } };
  const writeCache = d => { try { localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ t: Date.now(), data: d })); } catch (e) { /* đầy bộ nhớ */ } };

  async function fetchData() {
    if (!CONFIG.API_URL) return window.SAMPLE_DATA();
    const r = await fetch(CONFIG.API_URL, { redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function load(force) {
    const cached = CONFIG.API_URL ? readCache() : null;
    if (cached && !force && !S.data) {
      setData(cached.data, cached.t);
      if (Date.now() - cached.t < CONFIG.STALE_MS) return;
    }
    try {
      const d = await fetchData();
      if (CONFIG.API_URL) writeCache(d);
      setData(d, Date.now());
      if (force) toast('Đã cập nhật dữ liệu mới nhất');
    } catch (e) {
      if (S.data) toast('Không cập nhật được, đang hiển thị dữ liệu đã lưu');
      else showError();
    }
  }

  function setData(d, t) {
    S.data = d; S.t = t; S.dirty = true;
    S.courses = d.courses || [];
    S.classes = d.classes || [];
    S.cById = new Map(S.courses.map(c => [c.id, c]));
    S.clById = new Map(S.classes.map(c => [c.id, c]));
    S.sessByClass = new Map();
    for (const s of d.sessions || []) {
      if (!S.sessByClass.has(s.classId)) S.sessByClass.set(s.classId, []);
      S.sessByClass.get(s.classId).push(s);
    }
    for (const arr of S.sessByClass.values()) arr.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    route();
  }

  function showError() {
    $('#app').replaceChildren(h('div', { class: 'panel empty' },
      h('p', null, 'Không tải được dữ liệu. Vui lòng kiểm tra kết nối mạng.'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => load(true) }, 'Thử lại')));
  }

  /* ---------- nghiệp vụ ---------- */
  const classesOf = id => S.classes.filter(c => c.courseId === id).sort((a, b) => a.start.localeCompare(b.start));

  // Cùng quy tắc với công thức Sheet cũ: >= 3 ngày sau khai giảng => học video
  function classStatus(c) {
    const d = dayDiff(todayISO(), c.start);
    if (d < 0) return { key: 'soon', label: 'Sắp khai giảng', note: d === -1 ? 'Ngày mai' : 'còn ' + (-d) + ' ngày' };
    if (d < CONFIG.GRACE_DAYS) return { key: 'live', label: 'Đang học', note: 'còn nhận ghi danh' };
    return { key: 'video', label: 'Khai giảng', note: '' };
  }
  const STATUS_ORDER = { soon: 0, live: 1, video: 2 };

  function focusClass(cls) {
    if (!cls.length) return null;
    return cls.find(c => classStatus(c).key !== 'video') || cls[cls.length - 1];
  }

  const classLabel = k => (k.label || k.pattern) + ' — KG ' + fmtShort(k.start);
  const mapsUrl = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  function sessionIsPast(s) {
    const t = todayISO();
    return s.date < t || (s.date === t && s.end < timeNow());
  }
  const meetKey = s => s.no + '|' + s.date;

  /* ---------- định tuyến theo hash ---------- */
  function route() {
    if (!S.data) return;
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    R = { page: parts[0] === 'lich' ? 'schedule' : 'courses', id: parts[1] || '' };
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === R.page));
    if (R.page === 'courses') {
      renderCourses();
      if (parts[0] === 'khoa' && parts[1]) openCourse(parts[1]); else closeDrawer();
    } else {
      closeDrawer();
      renderSchedule(R.id);
    }
    S.dirty = false;
    const u = S.data.updatedAt ? new Date(S.data.updatedAt) : new Date(S.t);
    $('#updated').textContent = 'Cập nhật lúc ' + u.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  }

  /* ---------- trang khóa học ---------- */
  function renderCourses() {
    const app = $('#app');
    if (app.dataset.page !== 'courses' || S.dirty) {
      app.dataset.page = 'courses';
      const levels = [...new Set(S.courses.map(c => c.level).filter(Boolean))];
      const sel = (key, label, opts) => h('select', {
        'aria-label': label,
        onchange: e => { S[key] = e.target.value; updateList(); }
      }, h('option', { value: '' }, label), opts.map(o => h('option', { value: o[0], selected: S[key] === o[0] }, o[1])));

      app.replaceChildren(
        h('h1', null, 'Khóa học'),
        h('div', { class: 'toolbar' },
          h('input', {
            type: 'search', placeholder: 'Tìm khóa học… (gõ không dấu cũng được)', value: S.q, 'aria-label': 'Tìm khóa học',
            oninput: debounce(e => { S.q = e.target.value; updateList(); }, 120)
          }),
          h('div', { class: 'filters' },
            sel('level', 'Mọi mức độ', levels.map(l => [l, l])),
            sel('mode', 'Mọi hình thức', [['online', 'Có Online'], ['offline', 'Có Offline']]),
            sel('status', 'Mọi trạng thái', [['soon', 'Sắp khai giảng'], ['live', 'Đang học'], ['video', 'Học video']]),
            h('button', {
              type: 'button', class: 'link', onclick: () => { S.q = S.level = S.mode = S.status = ''; S.dirty = true; renderCourses(); }
            }, 'Xóa lọc'))),
        h('p', { class: 'count', id: 'count' }),
        h('div', { class: 'grid', id: 'list' }));
    }
    updateList();
  }

  function updateList() {
    const q = norm(S.q).split(/\s+/).filter(Boolean);
    const rows = S.courses.map(c => ({ c, cls: classesOf(c.id) })).filter(({ c, cls }) => {
      if (S.level && c.level !== S.level) return false;
      if (S.mode && !cls.some(k => norm(k.mode).includes(S.mode))) return false;
      if (S.status && !cls.some(k => classStatus(k).key === S.status)) return false;
      if (q.length) {
        const hay = norm([c.name, c.level, c.audience, c.certificate, c.exam].concat(cls.map(k => [k.label, k.pattern, k.location, k.mode, k.teacher].join(' '))).join(' '));
        if (!q.every(w => hay.includes(w))) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      const fa = focusClass(a.cls), fb = focusClass(b.cls);
      const sa = fa ? STATUS_ORDER[classStatus(fa).key] : 3, sb = fb ? STATUS_ORDER[classStatus(fb).key] : 3;
      if (sa !== sb) return sa - sb;
      return (fa ? fa.start : '9').localeCompare(fb ? fb.start : '9');
    });

    $('#count').textContent = rows.length + ' khóa học';
    $('#list').replaceChildren(...(rows.length ? rows.map(r => courseCard(r.c, r.cls))
      : [h('div', { class: 'panel empty', style: 'grid-column:1/-1' }, 'Không tìm thấy khóa học phù hợp. Thử bỏ bớt bộ lọc nhé.')]));
  }

  function courseCard(c, cls) {
    const f = focusClass(cls), st = f ? classStatus(f) : null;
    const zalo = f ? safeUrl(f.zalo) : '';
    const detail = '#/khoa/' + encodeURIComponent(c.id);
    return h('article', { class: 'card' },
      h('div', { class: 'card-top' },
        st && h('span', { class: 'badge ' + st.key }, st.label),
        st && st.note && h('span', { class: 'hint' }, st.note)),
      h('h3', null, h('a', { href: detail }, c.name)),
      h('p', { class: 'meta' }, [c.level, c.sessions ? c.sessions + ' buổi' : '', c.certificate].filter(Boolean).join(' · ')),
      h('div', { class: 'price' }, money(c.fee)),
      cls.length
        ? h('ul', { class: 'classes' }, cls.map(k => h('li', null,
          h('span', null, (k.label || 'Lớp') + ' · KG ' + fmtDate(k.start) + ' · ' + k.mode),
          h('a', { href: '#/lich/' + encodeURIComponent(k.id) }, 'Lịch học'))))
        : h('p', { class: 'hint' }, 'Chưa có lớp mở. Vui lòng theo dõi thông báo.'),
      h('div', { class: 'actions' },
        h('a', { class: 'btn', href: detail }, 'Chi tiết'),
        zalo && h('a', { class: 'btn primary', href: zalo, target: '_blank', rel: 'noopener' }, 'Nhóm ghi danh Zalo')));
  }

  /* ---------- chi tiết khóa học (dialog) ---------- */
  const dlg = () => $('#drawer');
  function closeDrawer() { if (dlg().open) dlg().close(); }

  function openCourse(id) {
    const c = S.cById.get(id);
    if (!c) { location.hash = '#/'; return; }
    const pairs = [
      ['Mức độ', c.level], ['Đối tượng phù hợp', c.audience], ['Loại giấy cấp', c.certificate],
      ['Thời lượng', c.sessions ? c.sessions + ' buổi' : ''], ['Học phí', money(c.fee)],
      ['Hình thức thi', c.exam], ['Ghi chú', c.note && c.note !== '-' ? c.note : '']
    ].filter(p => p[1]);
    const link = safeUrl(c.link);

    dlg().replaceChildren(
      h('div', { class: 'dlg-head' }, h('h2', null, c.name),
        h('button', { class: 'x', type: 'button', 'aria-label': 'Đóng', onclick: () => dlg().close() }, '×')),
      h('div', { class: 'dlg-body' },
        h('dl', { class: 'kv' }, pairs.map(p => [h('dt', null, p[0]), h('dd', null, p[1])])),
        link && h('a', { class: 'btn', href: link, target: '_blank', rel: 'noopener' }, 'Xem thông tin chi tiết khóa học'),
        h('h3', null, 'Các lớp đang mở'),
        classesOf(c.id).length ? classesOf(c.id).map(classBox) : h('p', { class: 'hint' }, 'Chưa có lớp mở.')));
    if (!dlg().open) dlg().showModal();
  }

  function classBox(k) {
   const st = classStatus(k), zalo = safeUrl(k.zalo), course = S.cById.get(k.courseId) || {};
    return h('div', { class: 'cls-box' },
      h('div', { class: 'card-top' }, h('b', null, k.label || 'Lớp'), h('span', { class: 'badge ' + st.key }, st.label), st.note && h('span', { class: 'hint' }, st.note)),
      h('div', null, 'Khai giảng: ' + fmtDate(k.start)),
      k.pattern && h('div', null, 'Lịch: ' + k.pattern),
      h('div', null, 'Hình thức: ' + k.mode),
      k.teacher && h('div', null, 'Giảng viên: ' + k.teacher),
      k.location && h('div', null, 'Địa điểm: ', h('a', { href: mapsUrl(k.location), target: '_blank', rel: 'noopener' }, k.location)),
      h('div', { class: 'actions' },
           course.fee > 0 && h('button', { class: 'btn primary', type: 'button', onclick: () => window.openRegister({
              apiUrl: CONFIG.API_URL, classId: k.id, title: (course.name || '') + ' — ' + (k.label || k.id), fee: course.fee
            }) }, 'Đăng ký & thanh toán'),
        h('a', { class: 'btn primary', href: '#/lich/' + encodeURIComponent(k.id) }, 'Xem lịch học'),
        zalo && h('a', { class: 'btn', href: zalo, target: '_blank', rel: 'noopener' }, 'Đăng ký Zalo')));
  }

  /* ---------- trang lịch học ---------- */
  function renderSchedule(id) {
    const app = $('#app');
    app.dataset.page = 'schedule';
    const select = h('select', {
      id: 'classSel', 'aria-label': 'Chọn lớp',
      onchange: e => { location.hash = e.target.value ? '#/lich/' + encodeURIComponent(e.target.value) : '#/lich'; }
    }, h('option', { value: '' }, '— Chọn lớp để xem lịch —'),
      S.courses.filter(c => classesOf(c.id).length).map(c =>
        h('optgroup', { label: c.name }, classesOf(c.id).map(k => h('option', { value: k.id, selected: k.id === id }, classLabel(k))))));

    const box = h('div', { id: 'sched' });
    app.replaceChildren(h('h1', null, 'Lịch học'), h('div', { class: 'field' }, h('label', { for: 'classSel' }, 'Lớp học'), select), box);
    if (id) drawSchedule(id, box);
    else {
      const withSched = S.classes.filter(k => (S.sessByClass.get(k.id) || []).length);
      box.append(h('div', { class: 'panel empty' }, 'Chọn lớp ở trên để xem lịch từng buổi.',
        withSched.length && h('p', { class: 'hint' }, 'Đã có lịch: ' + withSched.map(k => k.id).join(', '))));
    }
  }

  function drawSchedule(id, box) {
    const k = S.clById.get(id);
    if (!k) { box.replaceChildren(h('div', { class: 'panel empty' }, 'Không tìm thấy lớp này.')); return; }
    const c = S.cById.get(k.courseId) || { name: k.courseId };
    const sessions = S.sessByClass.get(id) || [];
    const zalo = safeUrl(k.zalo);
    const st = classStatus(k);
    const redraw = () => drawSchedule(id, box);

    const header = h('div', { class: 'card head-card' },
      h('div', { class: 'card-top' }, h('span', { class: 'badge ' + st.key }, st.label), st.note && h('span', { class: 'hint' }, st.note)),
      h('h2', null, c.name + ' — ' + (k.label || k.id)),
      h('div', { class: 'meta' }, [k.pattern, k.mode, k.teacher && 'GV: ' + k.teacher].filter(Boolean).join(' · ')),
      k.location && h('div', { class: 'meta' }, 'Địa điểm: ', h('a', { href: mapsUrl(k.location), target: '_blank', rel: 'noopener' }, k.location)),
      h('div', { class: 'row' },
        /*zalo && h('a', { class: 'btn primary sm', href: zalo, target: '_blank', rel: 'noopener' }, 'Nhóm Zalo'),
        sessions.length && h('button', { class: 'btn sm', type: 'button', onclick: () => downloadICS(k, c, sessions) }, 'Tải lịch (.ics)'),*/
        h('button', {
          class: 'btn sm', type: 'button', onclick: async () => {
            try { await navigator.clipboard.writeText(location.href); toast('Đã sao chép link lịch lớp này'); } catch (e) { toast('Hãy sao chép link trên thanh địa chỉ'); }
          }
        }, 'Sao chép link')));

    if (!sessions.length) {
      box.replaceChildren(header, h('div', { class: 'panel empty' }, 'Lịch học đang được cập nhật. Vui lòng theo dõi nhóm Zalo của lớp.'));
      return;
    }

    const today = todayISO(), tnow = timeNow();
    const next = sessions.find(s => s.state !== 'off' && !sessionIsPast(s));
    const changes = sessions.filter(s => s.state !== 'normal' && s.date >= today);

    if (S.monthFor !== id) { S.monthFor = id; S.month = (next || sessions[0]).date.slice(0, 7); }

    const parts = [header];
    if (next) {
      const live = next.date === today && next.start <= addMin(tnow, 30);
      parts.push(h('div', { class: 'card next head-card' },
        h('div', { class: 'hint' }, next.date === today ? 'Buổi học hôm nay' : 'Buổi học tiếp theo'),
        h('div', { class: 'big' }, wday(next.date) + ', ' + fmtDate(next.date) + ' · ' + next.start + '–' + next.end),
        h('div', null, 'Buổi ' + next.no + (next.topic ? ': ' + next.topic : '')),
        h('div', { class: 'meta' }, [next.teacher && 'GV: ' + next.teacher, next.room && 'Phòng: ' + next.room].filter(Boolean).join(' · ')),
        next.note && h('div', { class: 'note', style: 'color:var(--changed)' }, next.note),
        h('div', { class: 'row' }, meetButton(k, next, redraw, live), gcalLink(c, k, next))));
    }
    if (changes.length) {
      parts.push(h('div', { class: 'alert', role: 'alert' }, h('b', null, 'Lưu ý thay đổi lịch (' + changes.length + ')'),
        h('ul', null, changes.map(s => h('li', null,
          'Buổi ' + s.no + ' (' + fmtShort(s.date) + '): ' + STATE_LABEL[s.state] + (s.state === 'changed' ? ' → ' + s.start + '–' + s.end : '') + (s.note ? ' — ' + s.note : ''))))));
    }

    parts.push(h('div', { class: 'seg', role: 'group', 'aria-label': 'Chế độ xem' },
      h('button', { type: 'button', class: S.view === 'list' ? 'on' : '', onclick: () => { S.view = 'list'; redraw(); } }, 'Danh sách'),
      h('button', { type: 'button', class: S.view === 'month' ? 'on' : '', onclick: () => { S.view = 'month'; redraw(); } }, 'Lịch tháng')));

    if (S.view === 'list') {
      parts.push(h('ul', { class: 'sessions' }, sessions.map(s => sessionRow(k, c, s, s === next, redraw))));
    } else {
      parts.push(monthView(sessions, redraw));
    }
    box.replaceChildren(...parts);
  }

  function addMin(hhmm, m) {
    const [hh, mm] = hhmm.split(':').map(Number); const t = hh * 60 + mm + m;
    return String(Math.min(23, Math.floor(t / 60))).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }

  function sessionRow(k, c, s, isNext, redraw) {
    const past = sessionIsPast(s);
    const cls = ['sess', past && 'past', s.state !== 'normal' && s.state, isNext && 'next', s.date === todayISO() && 'today'].filter(Boolean).join(' ');
    return h('li', { class: cls },
      h('div', { class: 'when' }, h('b', null, wday(s.date) + ', ' + fmtDate(s.date)), h('span', null, s.start + '–' + s.end)),
      h('div', { class: 'what' },
        h('div', { class: 't' }, 'Buổi ' + s.no + (s.topic ? ': ' + s.topic : '')),
        h('div', { class: 'sub' }, [s.teacher && 'GV: ' + s.teacher, s.room && 'Phòng: ' + s.room].filter(Boolean).join(' · ')),
        s.note && h('div', { class: 'note' }, s.note)),
      h('div', { class: 'side' },
        s.state !== 'normal' && h('span', { class: 'badge ' + s.state }, STATE_LABEL[s.state]),
        !past && s.state !== 'off' && meetButton(k, s, redraw, false),
        !past && s.state !== 'off' && gcalLink(c, k, s)));
  }

  /* ---------- link Meet (có thể khóa bằng mã lớp) ---------- */
  function meetButton(k, s, redraw, live) {
    if (s.state === 'off') return null;
    const url = safeUrl(s.meet || (S.meet[k.id] || {})[meetKey(s)]);
    if (url) return h('a', { class: 'btn primary sm' + (live ? ' live-now' : ''), href: url, target: '_blank', rel: 'noopener' }, 'Vào học (Meet)');
    if (k.locked) {
      return h('button', {
        class: 'btn sm', type: 'button', onclick: async () => {
          const code = window.prompt('Nhập mã lớp (xem trong nhóm Zalo) để hiện link học trực tuyến:');
          if (!code) return;
          try {
            S.meet[k.id] = await fetchMeet(k.id, code.trim());
            try { sessionStorage.setItem(CONFIG.MEET_KEY, JSON.stringify(S.meet)); } catch (e) { /* bỏ qua */ }
            toast('Đã mở link học trực tuyến'); redraw();
          } catch (e) { toast('Mã lớp chưa đúng, vui lòng thử lại'); }
        }
      }, 'Nhập mã để xem link');
    }
    return null;
  }

  async function fetchMeet(classId, code) {
    if (!CONFIG.API_URL) {
      if (code === '1234' && window.SAMPLE_MEET && window.SAMPLE_MEET[classId]) return window.SAMPLE_MEET[classId];
      throw new Error('bad code');
    }
    const u = CONFIG.API_URL + (CONFIG.API_URL.includes('?') ? '&' : '?') + 'action=meet&lop=' + encodeURIComponent(classId) + '&code=' + encodeURIComponent(code);
    const j = await (await fetch(u, { redirect: 'follow' })).json();
    if (!j.ok) throw new Error('bad code');
    return j.meet || {};
  }

  /* ---------- thêm vào lịch ---------- */
  const icsDate = (date, time) => new Date(Date.parse(date + 'T' + time + ':00Z') - VN).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

  function gcalLink(c, k, s) {
    const meet = safeUrl(s.meet || (S.meet[k.id] || {})[meetKey(s)]);
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: c.name + ' — Buổi ' + s.no,
      dates: icsDate(s.date, s.start) + '/' + icsDate(s.date, s.end),
      details: [s.topic, s.teacher && 'GV: ' + s.teacher, meet && 'Link học: ' + meet].filter(Boolean).join('\n'),
      location: s.room || k.location || meet || ''
    });
    return h('a', { class: 'btn sm', href: 'https://calendar.google.com/calendar/render?' + p, target: '_blank', rel: 'noopener' }, '+ Lịch Google');
  }

  function downloadICS(k, c, sessions) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ev = sessions.filter(s => s.state !== 'off').map(s => {
      const meet = safeUrl(s.meet || (S.meet[k.id] || {})[meetKey(s)]);
      return ['BEGIN:VEVENT',
        'UID:' + k.id + '-' + s.no + '-' + s.date + '@khoahoc',
        'DTSTAMP:' + stamp,
        'DTSTART:' + icsDate(s.date, s.start),
        'DTEND:' + icsDate(s.date, s.end),
        'SUMMARY:' + icsEsc(c.name + ' — Buổi ' + s.no + (s.state === 'makeup' ? ' (học bù)' : '')),
        'DESCRIPTION:' + icsEsc([s.topic, s.teacher && 'GV: ' + s.teacher, meet && 'Link học: ' + meet, s.note].filter(Boolean).join('\n')),
        'LOCATION:' + icsEsc(s.room || k.location || ''),
        'END:VEVENT'].join('\r\n');
    });
    const text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//KhoaHoc//Lich hoc//VI\r\nCALSCALE:GREGORIAN\r\n' + ev.join('\r\n') + '\r\nEND:VCALENDAR\r\n';
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' })), download: 'lich-' + k.id + '.ics' });
    document.body.append(a); a.click(); a.remove();
    toast('Đã tải file lịch. Mở file để thêm vào lịch điện thoại.');
  }

  /* ---------- lịch tháng ---------- */
  function monthView(sessions, redraw) {
    const [y, m] = S.month.split('-').map(Number);
    const startOff = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const shift = n => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); S.month = d.toISOString().slice(0, 7); redraw(); };
    const today = todayISO();
    const cells = [];
    for (let i = 0; i < startOff; i++) cells.push(h('div', { class: 'cell blank' }));
    for (let d = 1; d <= dim; d++) {
      const iso = S.month + '-' + String(d).padStart(2, '0');
      cells.push(h('div', { class: 'cell' + (iso === today ? ' today' : '') }, h('b', null, d),
        sessions.filter(s => s.date === iso).map(s => h('span', { class: 'chip ' + (s.state !== 'normal' ? s.state : ''), title: 'Buổi ' + s.no + (s.topic ? ': ' + s.topic : '') }, s.start + ' B' + s.no))));
    }
    return h('div', null,
      h('div', { class: 'cal-head' },
        h('button', { class: 'btn sm', type: 'button', onclick: () => shift(-1), 'aria-label': 'Tháng trước' }, '‹'),
        h('b', null, 'Tháng ' + m + '/' + y),
        h('button', { class: 'btn sm', type: 'button', onclick: () => shift(1), 'aria-label': 'Tháng sau' }, '›')),
      h('div', { class: 'cal' }, ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(x => h('div', { class: 'dow' }, x)), cells));
  }

  /* ---------- khởi động ---------- */
  dlg().addEventListener('click', e => { if (e.target === dlg()) dlg().close(); });
  dlg().addEventListener('close', () => { if (location.hash.startsWith('#/khoa')) location.hash = '#/'; });
  $('#refresh').addEventListener('click', () => load(true));
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.data && Date.now() - S.t > CONFIG.STALE_MS) load(true); });
  load();
})();
