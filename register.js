/* Đăng ký & thanh toán: nhập thông tin -> QR của khóa + nội dung CK -> "Tôi đã chuyển tiền".
   app.js gọi window.openRegister({ apiUrl, classId, title, fee }). */
(() => {
  'use strict';

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

  const money = n => Number(n).toLocaleString('vi-VN') + ' đ';
  let dlg;
  function getDlg() {
    if (!dlg) {
      dlg = h('dialog', { id: 'regDlg', 'aria-label': 'Đăng ký khóa học' });
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
      document.body.append(dlg);
    }
    return dlg;
  }

  function note(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function copy(text, label) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text;
      document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch (x) { /* bỏ qua */ } ta.remove();
    }
    note('Đã sao chép ' + label);
  }

  // text/plain để trình duyệt không gửi preflight (Apps Script không xử lý OPTIONS)
  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Có lỗi xảy ra, vui lòng thử lại.');
    return j;
  }

  const head = (title) => h('div', { class: 'dlg-head' }, h('h2', null, title),
    h('button', { class: 'x', type: 'button', 'aria-label': 'Đóng', onclick: () => getDlg().close() }, '×'));

  /* ----- bước 1: nhập thông tin ----- */
  function formView(o) {
    const err = h('p', { class: 'reg-err', role: 'alert' });
    const name = h('input', { id: 'r_name', type: 'text', autocomplete: 'name', required: true, maxlength: 80 });
    const phone = h('input', { id: 'r_phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', required: true, placeholder: '09xxxxxxxx' });
    const email = h('input', { id: 'r_email', type: 'email', autocomplete: 'email', placeholder: 'Không bắt buộc' });
    const trap = h('input', { name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Tiếp tục thanh toán');

    const form = h('form', { class: 'reg-form', novalidate: true,
      onsubmit: async e => {
        e.preventDefault();
        if (!o.apiUrl) { err.textContent = 'Chưa kết nối máy chủ đăng ký.'; return; }
        btn.disabled = true; err.textContent = ''; btn.textContent = 'Đang xử lý…';
        try {
          const info = await post(o.apiUrl, {
            action: 'register', classId: o.classId, name: name.value, phone: phone.value, email: email.value, website: trap.value
          });
          if (info.paid) return doneView(o, 'Bạn đã đăng ký và thanh toán lớp này rồi (mã ' + info.code + ').');
          if (info.reported) return doneView(o, 'Bạn đã báo chuyển khoản cho lớp này (mã ' + info.code + '). Kế toán đang kiểm tra.');
          payView(o, info, { phone: phone.value });
        } catch (x) {
          err.textContent = x.message; btn.disabled = false; btn.textContent = 'Tiếp tục thanh toán';
        }
      } },
      h('label', { for: 'r_name' }, 'Họ và tên *'), name,
      h('label', { for: 'r_phone' }, 'Số điện thoại *'), phone,
      h('label', { for: 'r_email' }, 'Email'), email,
      h('div', { class: 'reg-trap', 'aria-hidden': 'true' }, trap),
      err, btn);

    getDlg().replaceChildren(head('Đăng ký: ' + o.title),
      h('div', { class: 'dlg-body' },
        h('p', { class: 'hint' }, 'Nhập thông tin để nhận mã QR và nội dung chuyển khoản tạm ứng.'), form));
    if (!getDlg().open) getDlg().showModal();
  }

  /* ----- bước 2: QR + nội dung CK + xác nhận ----- */
  function payView(o, info, ctx) {
    const row = (label, value, copyLabel, strong) => h('div', { class: 'pay-row' },
      h('div', null, h('div', { class: 'hint' }, label), h('div', { class: strong ? 'pay-val strong' : 'pay-val' }, value)),
      copyLabel && h('button', { class: 'btn sm', type: 'button', onclick: () => copy(copyLabel[0], copyLabel[1]) }, 'Sao chép'));

    const err = h('p', { class: 'reg-err', role: 'alert' });
    const btn = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      btn.disabled = true; err.textContent = ''; btn.textContent = 'Đang gửi…';
      try {
        await post(o.apiUrl, { action: 'confirm', code: info.code, phone: ctx.phone });
        doneView(o, 'Đã ghi nhận bạn chuyển khoản. Kế toán sẽ kiểm tra và liên hệ xác nhận. Mã đăng ký: ' + info.code);
      } catch (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = 'Tôi đã chuyển tiền'; }
    } }, 'Tôi đã chuyển tiền');

    getDlg().replaceChildren(head('Thanh toán tạm ứng'),
      h('div', { class: 'dlg-body' },
        h('p', { class: 'hint' }, o.title + ' · Mã đăng ký: ' + info.code),
        h('div', { class: 'qr' },
          h('img', { src: info.qr, alt: 'Mã QR chuyển khoản', width: 260, loading: 'eager' }),
          h('p', { class: 'hint' }, info.qrOwn ? 'Quét mã QR của khóa học bằng app ngân hàng.' : 'Quét mã bằng app ngân hàng (đã điền sẵn số tiền và nội dung).')),
        h('div', { class: 'pay-box' },
          row('Ngân hàng', info.bank),
          row('Số tài khoản', info.account, [info.account, 'số tài khoản']),
          row('Chủ tài khoản', info.owner),
          row('Số tiền tạm ứng', money(info.amount), [String(info.amount), 'số tiền'], true),
          row('Nội dung chuyển khoản (nhập đúng)', info.content, [info.content, 'nội dung chuyển khoản'], true)),
        h('p', { class: 'warn' }, 'Vui lòng nhập ĐÚNG nội dung chuyển khoản để kế toán đối chiếu nhanh. Chuyển xong hãy bấm nút bên dưới.'),
        err, btn,
        h('button', { class: 'btn', type: 'button', onclick: () => getDlg().close() }, 'Để sau')));
  }

  function doneView(o, msg) {
    getDlg().replaceChildren(head('Hoàn tất'),
      h('div', { class: 'dlg-body' }, h('p', null, msg),
        h('button', { class: 'btn primary', type: 'button', onclick: () => getDlg().close() }, 'Đóng')));
    if (!getDlg().open) getDlg().showModal();
  }

  window.openRegister = formView;
})();
