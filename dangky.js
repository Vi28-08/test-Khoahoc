/* Đăng ký & thanh toán QR — nạp trước app.js. Gọi: window.openRegister({ apiUrl, classId, title, fee }) */
(() => {
  'use strict';

  const money = n => Number(n).toLocaleString('vi-VN') + ' đ';

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

  const CSS = `
    #regdlg{width:min(460px,calc(100% - 24px));max-height:92vh;border:0;border-radius:14px;padding:16px;overflow:auto}
    #regdlg::backdrop{background:rgba(15,23,42,.55)}
    #regdlg h2{font-size:18px;margin:0 0 4px}
    #regdlg label{display:block;font-size:13px;color:#64748b;margin:10px 0 4px}
    #regdlg input{width:100%;padding:12px;font:inherit;border:1px solid #cbd5e1;border-radius:10px;box-sizing:border-box}
    #regdlg .err{color:#dc2626;font-size:14px;min-height:20px;margin:8px 0 0}
    #regdlg .row{display:flex;gap:8px;margin-top:12px}
    #regdlg .row>*{flex:1}
    #regdlg .qr{display:block;width:100%;max-width:340px;margin:10px auto;border:1px solid #e2e8f0;border-radius:10px}
    #regdlg .kv{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:15px}
    #regdlg .kv b{word-break:break-all;text-align:right}
    #regdlg .hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
  `;

  let dlg;
  function ensure() {
    if (dlg) return dlg;
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
    dlg = h('dialog', { id: 'regdlg', 'aria-label': 'Đăng ký khóa học' });
    document.body.append(dlg);
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    return dlg;
  }

  window.openRegister = function (o) {
    if (!o || !o.apiUrl) { alert('Chức năng đăng ký chỉ hoạt động khi đã kết nối Google Sheet.'); return; }
    const d = ensure();
    showForm(d, o);
    if (!d.open) d.showModal();
  };

  function showForm(d, o) {
    const err = h('p', { class: 'err', role: 'alert' });
    const name = h('input', { type: 'text', autocomplete: 'name', maxlength: 80, required: true });
    const phone = h('input', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', maxlength: 14, required: true, placeholder: '09xxxxxxxx' });
    const email = h('input', { type: 'email', autocomplete: 'email', maxlength: 120 });
    const trap = h('input', { type: 'text', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Đăng ký & lấy mã QR');

    const form = h('form', { novalidate: true },
      h('h2', null, 'Đăng ký khóa học'),
      h('div', { style: 'color:#64748b;font-size:14px' }, o.title || ''),
      o.fee ? h('div', { style: 'font-weight:700;margin-top:6px' }, 'Học phí: ' + money(o.fee)) : null,
      h('label', null, 'Họ và tên *'), name,
      h('label', null, 'Số điện thoại *'), phone,
      h('label', null, 'Email (không bắt buộc)'), email,
      trap, err,
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Đóng'), btn));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true; btn.textContent = 'Đang gửi…';
      try {
        const r = await fetch(o.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // giữ là text/plain để tránh lỗi CORS preflight
          body: JSON.stringify({ action: 'register', classId: o.classId, name: name.value, phone: phone.value, email: email.value, website: trap.value })
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'Không gửi được đăng ký.');
        showPay(d, j);
      } catch (ex) {
        err.textContent = ex.message || 'Không gửi được, vui lòng thử lại.';
        btn.disabled = false; btn.textContent = 'Đăng ký & lấy mã QR';
      }
    });
    d.replaceChildren(form);
  }

  function copyBtn(text) {
    return h('button', {
      class: 'btn', type: 'button', style: 'padding:6px 10px;margin-left:8px',
      onclick: async e => {
        try { await navigator.clipboard.writeText(text); e.target.textContent = 'Đã chép'; } catch (x) { e.target.textContent = 'Hãy chép tay'; }
      }
    }, 'Chép');
  }

  function showPay(d, j) {
    if (j.paid) {
      d.replaceChildren(
        h('h2', null, 'Đăng ký đã được xác nhận'),
        h('p', null, 'Mã đăng ký ' + j.code + ' đã được xác nhận thanh toán. Cảm ơn bạn!'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => d.close() }, 'Đóng')));
      return;
    }
    const qr = String(j.qr || '');
    const qrOk = qr.startsWith('https://img.vietqr.io/');
    d.replaceChildren(
      h('h2', null, 'Quét mã để thanh toán'),
      h('p', { style: 'margin:4px 0;color:#64748b;font-size:14px' }, 'Mở app ngân hàng, chọn quét QR. Số tiền và nội dung đã điền sẵn.'),
      qrOk ? h('img', { class: 'qr', src: qr, alt: 'Mã QR chuyển khoản', loading: 'eager' }) : null,
      h('div', { class: 'kv' }, h('span', null, 'Số tiền'), h('span', null, h('b', null, money(j.amount)), copyBtn(String(j.amount)))),
      h('div', { class: 'kv' }, h('span', null, 'Nội dung CK'), h('span', null, h('b', null, j.content), copyBtn(j.content))),
      h('div', { class: 'kv' }, h('span', null, 'Ngân hàng'), h('b', null, j.bank)),
      h('div', { class: 'kv' }, h('span', null, 'Số tài khoản'), h('span', null, h('b', null, j.account), copyBtn(j.account))),
      h('div', { class: 'kv' }, h('span', null, 'Chủ tài khoản'), h('b', null, j.owner)),
      h('p', { style: 'font-size:14px;margin:12px 0 0' },
        'Vui lòng giữ nguyên nội dung chuyển khoản ', h('b', null, j.content), ' để trung tâm xác nhận nhanh. Hãy chụp màn hình QR để dùng lại.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => d.close() }, 'Đã hiểu')));
  }
})();
