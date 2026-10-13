/* Dữ liệu mẫu để chạy thử khi CONFIG.API_URL trong app.js còn để trống.
   Ngày được tính tương đối so với hôm nay nên demo luôn có đủ các trạng thái. */
window.SAMPLE_DATA = function () {
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const addTo = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
  const add = n => addTo(today, n);
  const CTU = 'Trường Kinh tế, Khu II, Đại học Cần Thơ, đường 3/2, Phường Xuân Khánh, Quận Ninh Kiều, Thành phố Cần Thơ';

  const courses = [
    { id: 'SPSS', name: 'Phân tích số liệu bằng SPSS', level: 'Cơ bản', audience: 'Sinh viên, học viên cao học, người làm nghiên cứu', certificate: 'Chứng nhận do Đại học Cần Thơ cấp', sessions: 10, fee: 1300000, exam: 'Tự luận', link: 'https://docs.google.com/document/d/1pLoDG0CjsoagqLSCfNbMB5P2dOn-kl7uao7uu78zf2k/edit', note: '' },
    { id: 'STATA', name: 'Phân tích dữ liệu bằng STATA', level: 'Cơ bản', audience: 'Người làm kinh tế lượng, nghiên cứu', certificate: 'Chứng nhận do Đại học Cần Thơ cấp', sessions: 6, fee: 1500000, exam: 'Thực hành', link: '', note: '' },
    { id: 'KTT', name: 'Kế toán trưởng', level: 'Nâng cao', audience: 'Kế toán viên, kế toán tổng hợp', certificate: 'Chứng chỉ bồi dưỡng kế toán trưởng', sessions: 20, fee: 4500000, exam: 'Tự luận + thực hành', link: '', note: 'Học viên cần có kinh nghiệm kế toán' },
    { id: 'EXCEL', name: 'Excel nâng cao cho kế toán', level: 'Nâng cao', audience: 'Nhân viên văn phòng, kế toán', certificate: 'Chứng nhận hoàn thành khóa học', sessions: 8, fee: 1200000, exam: 'Thực hành', link: '', note: '' },
    { id: 'PY', name: 'Phân tích dữ liệu với Python', level: 'Cơ bản', audience: 'Người mới bắt đầu với dữ liệu', certificate: 'Chứng nhận do Đại học Cần Thơ cấp', sessions: 12, fee: 2200000, exam: 'Dự án cuối khóa', link: '', note: '' }
  ];

  const classes = [
    { id: 'SPSS-A', courseId: 'SPSS', label: 'Lớp tối', start: add(5), mode: 'Online/Offline', location: CTU, zalo: 'http://zalo.me/g/uvozqs059', pattern: 'Tối T2, T4 (18:30–21:00)', teacher: 'GV. Nguyễn Văn A', locked: false },
    { id: 'SPSS-B', courseId: 'SPSS', label: 'Lớp cuối tuần', start: add(40), mode: 'Online', location: '', zalo: 'http://zalo.me/g/uvozqs059', pattern: 'Sáng T7 (8:00–11:30)', teacher: 'GV. Nguyễn Văn A', locked: false },
    { id: 'STATA-A', courseId: 'STATA', label: 'Lớp tối', start: add(-1), mode: 'Online', location: '', zalo: 'http://zalo.me/g/uvozqs059', pattern: 'Tối T2, T4, T6 (18:30–20:30)', teacher: 'GV. Trần Thị B', locked: true },
    { id: 'KTT-A', courseId: 'KTT', label: 'Lớp tối', start: add(-20), mode: 'Offline', location: CTU, zalo: 'http://zalo.me/g/uvozqs059', pattern: 'Tối T3, T5 (18:30–21:00)', teacher: 'GV. Lê Văn C', locked: false },
    { id: 'EXCEL-A', courseId: 'EXCEL', label: 'Lớp tối', start: add(12), mode: 'Offline', location: CTU, zalo: 'http://zalo.me/g/uvozqs059', pattern: 'Tối T3, T5 (18:30–21:00)', teacher: 'GV. Phạm Thị D', locked: false },
    { id: 'EXCEL-B', courseId: 'EXCEL', label: 'Lớp cuối tuần', start: add(26), mode: 'Online', location: '', zalo: 'http://zalo.me/g/uvozqs059', pattern: 'Chiều T7 (14:00–17:30)', teacher: 'GV. Phạm Thị D', locked: false },
    { id: 'PY-A', courseId: 'PY', label: 'Lớp tối', start: add(25), mode: 'Online', location: '', zalo: 'http://zalo.me/g/uvozqs059', pattern: 'Tối T3, T5 (19:00–21:00)', teacher: 'GV. Hoàng Văn E', locked: false }
  ];

  // Sinh buổi học theo thứ (0=CN ... 6=T7); over[no] ghi đè từng buổi (nghỉ, đổi giờ...)
  function gen(classId, start, days, t1, t2, n, topics, teacher, room, meet, over) {
    const out = []; let d = start, no = 0; over = over || {};
    while (no < n) {
      if (days.includes(new Date(d + 'T00:00:00Z').getUTCDay())) {
        no++;
        out.push(Object.assign({ classId, no, date: d, start: t1, end: t2, topic: topics[no - 1] || '', teacher, room, meet, state: 'normal', note: '' }, over[no] || {}));
      }
      d = addTo(d, 1);
    }
    return out;
  }

  const spssTopics = ['Giới thiệu SPSS, nhập dữ liệu', 'Mã hóa và làm sạch dữ liệu', 'Thống kê mô tả', 'Kiểm định độ tin cậy Cronbach’s Alpha', 'Phân tích nhân tố khám phá EFA', 'Tương quan Pearson', 'Hồi quy tuyến tính', 'Kiểm định T-test', 'Phân tích ANOVA', 'Tổng kết và trình bày kết quả'];
  const spss = gen('SPSS-A', add(5), [1, 3], '18:30', '21:00', 10, spssTopics, 'GV. Nguyễn Văn A', 'Phòng B2-101', 'https://meet.google.com/abc-defg-hij', {
    3: { state: 'off', note: 'Giảng viên bận công tác, sẽ học bù' },
    5: { state: 'changed', start: '19:00', end: '21:30', note: 'Dời sang 19:00 do trùng lịch phòng' }
  });
  spss.push({ classId: 'SPSS-A', no: 3, date: add(23), start: '18:30', end: '21:00', topic: spssTopics[2], teacher: 'GV. Nguyễn Văn A', room: 'Phòng B2-101', meet: 'https://meet.google.com/abc-defg-hij', state: 'makeup', note: 'Học bù buổi 3' });

  const stataTopics = ['Làm quen STATA', 'Quản lý dữ liệu', 'Thống kê mô tả', 'Hồi quy OLS', 'Dữ liệu bảng', 'Tổng kết'];
  const stata = gen('STATA-A', add(-1), [1, 3, 5], '18:30', '20:30', 6, stataTopics, 'GV. Trần Thị B', '', '', {});
  const stataMeet = {};
  stata.forEach(s => { stataMeet[s.no + '|' + s.date] = 'https://meet.google.com/stt-demo-room'; });

  const excel = gen('EXCEL-A', add(12), [2, 4], '18:30', '21:00', 8,
    ['Hàm tra cứu nâng cao', 'PivotTable', 'Power Query', 'Hàm mảng động', 'Dashboard báo cáo', 'Macro cơ bản', 'Tự động hóa báo cáo', 'Ôn tập'],
    'GV. Phạm Thị D', 'Phòng máy 2', '', {});

  // Link Meet được giữ kín cho lớp có "locked": mã mẫu để thử là 1234
  window.SAMPLE_MEET = { 'STATA-A': stataMeet };

  return { updatedAt: new Date().toISOString(), courses, classes, sessions: [].concat(spss, stata, excel) };
};
