# Web tra cứu khóa học & lịch học

Web tĩnh (HTML/CSS/JS), dữ liệu lấy từ Google Sheets. Nhân viên chỉ cần sửa Sheet, web tự cập nhật.

```
Google Sheets ──> Apps Script (JSON) ──> Web tĩnh ──> Học viên
```

## Chạy thử ngay
Mở `index.html` bằng trình duyệt. Khi `CONFIG.API_URL` trong `app.js` còn trống, web dùng dữ liệu mẫu (`data.sample.js`).
Mã thử cho lớp có khóa link Meet (lớp STATA-A): `1234`.

## Kết nối Google Sheet thật

1. Tạo Google Sheet có 3 tab đúng tên `KhoaHoc`, `LopHoc`, `LichHoc`. Hàng 1 là tiêu đề, đúng tên cột:

   | Tab | Các cột |
   |---|---|
   | KhoaHoc | MaKhoa, TenKhoa, MucDo, DoiTuong, LoaiGiayCap, SoBuoi, HocPhi, HinhThucThi, LinkChiTiet, GhiChu, HienThi |
   | LopHoc | MaLop, MaKhoa, NhanLop, NgayKhaiGiang, HinhThucHoc, DiaDiem, LinkZalo, LichMau, GiangVien, Thu, GioBatDau, GioKetThuc, MaTruyCap, HienThi |
   | LichHoc | MaLop, Buoi, Ngay, GioBatDau, GioKetThuc, NoiDung, GiangVien, Phong, LinkMeet, TrangThai, GhiChu |

   Lưu ý khi nhập:
   - `NgayKhaiGiang`, `Ngay`: ngày đầy đủ có năm (dd/mm/yyyy), định dạng ô là Ngày.
   - `HocPhi`, `SoBuoi`: nhập số (1300000, 10), không gõ "1.300.000" hay "10 buổi".
   - `GioBatDau`, `GioKetThuc`: định dạng ô là Giờ (18:30).
   - `Thu` trong LopHoc: các thứ học, ví dụ `2,4` (2 = Thứ 2 ... 7 = Thứ 7, 8 = Chủ nhật).
   - `TrangThai` trong LichHoc: để trống, `Nghỉ`, `Học bù` hoặc `Đổi lịch` (nên tạo dropdown bằng Data Validation).
   - Buổi học bù: thêm một dòng mới cùng số `Buoi`, `TrangThai` = `Học bù`.
   - Không cần cột trạng thái khóa học: web tự tính (trước khai giảng = Sắp khai giảng, trong 3 ngày đầu = Đang học, sau đó = Khai giảng – học video).
   - `HienThi` = FALSE để ẩn khóa/lớp khỏi web. `MaTruyCap`: nếu điền, link Meet của lớp bị ẩn và chỉ hiện khi học viên nhập đúng mã (gửi mã trong nhóm Zalo của lớp).

2. Trong Sheet: **Tiện ích mở rộng > Apps Script**, dán nội dung `apps-script/Code.gs`. Vào **Cài đặt dự án** đặt múi giờ `Asia/Ho_Chi_Minh`.
3. **Triển khai > Triển khai mới > Ứng dụng web**: Thực thi với tư cách *Tôi*, quyền truy cập *Bất kỳ ai*. Sao chép URL `/exec`.
4. Dán URL vào `CONFIG.API_URL` trong `app.js`.
5. Đưa cả thư mục lên GitHub Pages, Cloudflare Pages hoặc Netlify (miễn phí).

Mỗi khi sửa `Code.gs` phải **Triển khai > Quản lý triển khai > Chỉnh sửa > Phiên bản mới** thì URL cũ mới nhận code mới.

## Tự sinh lịch
Tải lại Sheet, vào menu **Khóa học > Tạo lịch tự động cho lớp đang chọn** (chọn một ô trong dòng của lớp ở tab LopHoc). Script thêm đủ các buổi vào LichHoc từ ngày khai giảng, `Thu` và `SoBuoi`. Sau đó chỉ sửa tay các buổi nghỉ, học bù, đổi giờ, nội dung, phòng, link Meet.

## Cập nhật nhanh
- Cache Apps Script 60 giây, tự xóa khi có người sửa Sheet.
- Trình duyệt hiện dữ liệu đã lưu ngay, tải bản mới ngầm; tự tải lại khi học viên quay lại tab; có nút "Làm mới" ở chân trang.

## Bảo mật
- Dữ liệu Sheet được dựng bằng `textContent`, link chỉ nhận `https://` (và `http://zalo.me`).
- JSON công khai nên không đưa SĐT, ghi chú nội bộ vào các cột trên. Link Meet của lớp có `MaTruyCap` không nằm trong JSON công khai.
- Mã truy cập chỉ ngăn người ngoài, không thay thế quyền vào phòng Meet (nên bật "Yêu cầu xin tham gia" trong Meet nếu cần chặt hơn).

## Cấu trúc thư mục
```
index.html        giao diện
style.css         kiểu dáng (mobile-first)
app.js            logic (tra cứu, lọc, lịch, .ics)
data.sample.js    dữ liệu mẫu
apps-script/Code.gs   API đọc Google Sheet
```
