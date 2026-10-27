# Nhiệm vụ — Hiệu ứng, tương tác và kịch bản nhân vật

Nguồn: `Nhiệm vụ - 3 phong cách.dc.html`, `Nhiệm vụ - Kanban tối và sáng.dc.html`, `Nhiệm vụ - Rừng tiên (Elf).dc.html`, `nature-fx.js`, và các cập nhật mở rộng.

Các nền hỗ trợ:
- **Thường**: 1b Tinh gọn (Light & Dark).
- **Sáng**: 1c Bình minh, 2b Sáng (+ mobile).
- **Tối**: 1a Cực quang, 2a Tối (+ mobile).
- **Tiên**: 3a Rừng tiên (ngày), 3b Rừng tiên đêm (+ mobile ngày/đêm).

---

## 1. Tương tác chung của bảng việc (mọi nền)

- **Sửa tại chỗ (Inline editing)**: Bấm vào ngày, mức ưu tiên hoặc biểu tượng trạng thái trực tiếp trên thẻ để đổi ngay tức thì, không cần mở hộp thoại.
- **Ngăn chi tiết (Detail Drawer)**: Bấm thẻ mở ngăn bên phải. Mọi trường sửa trực tiếp và tự lưu, không cần bấm nút "Lưu/Sửa".
- **Kéo thả Kanban**: Kéo thẻ sang cột khác để đổi trạng thái (*Cần làm* / *Đang làm* / *Xong* / *Bỏ qua*).
- **Thêm nhanh (Quick add)**: Nút `+` ở đầu mỗi cột. Hỗ trợ cú pháp NLP: gõ *“mai 9h !cao #UI”* là tự động gán ngày mai, 9 giờ sáng, ưu tiên Cao và gắn thẻ #UI.
- **Bộ lọc thời gian**: Tất cả · Hôm nay · 7 ngày tới · Quá hạn.
- **Chế độ xem đa dạng**: Danh sách · Kanban · Lịch biểu · Ngày · Tuần (Mobile thay Tuần bằng Tháng).
- **Lịch sự kiện đa năng**: Nhóm Lễ Việt Nam, Âm lịch, Quốc tế, Nhật Bản, Kỷ niệm, Geek. Ngày âm lịch hiển thị song song cạnh ngày dương.
- **Dải giờ Hôm nay**: Việc có giờ nằm trên trục giờ trực quan. Bấm ô giờ để gán việc, kéo thẻ vào giờ (bước 30 phút), hoặc thả vào vùng “Bỏ giờ” để xóa giờ.
- **Lịch sử thay đổi (Audit log)**: Ghi lại từng thay đổi trạng thái, hạn chót, ưu tiên, tạo mới... kèm mốc thời gian chi tiết.
- **Việc con (Subtasks)**: Mở/đóng danh sách việc con, tick hoàn thành từng mục kèm thanh tiến độ mini.
- **Ghi chú định dạng phong phú**: Hỗ trợ Đậm, Nghiêng, Gạch ngang, Danh sách, Checklist, Link, Code block, File đính kèm.
- **Nút Ngắm cảnh (Zen Mode)**: Biểu tượng mắt góc màn hình — ẩn mờ toàn bộ giao diện trong 0.45s để chiêm ngưỡng nền động và các nhân vật. Bấm lại để hiện giao diện.

Mobile:
- Bấm tên màn hình góc trên bên trái để chuyển nhanh giữa các màn.
- Kanban hiển thị từng cột trực quan, lướt vuốt ngang hoặc bấm tab để chuyển cột.
- Chi tiết việc, Tiện ích và Tạo việc mới mở dạng Sheet trượt mượt mà từ cạnh dưới lên.

---

## 2. Tinh chỉnh nâng cao (Tweaks)

- `showDesc`: Bật/tắt hiển thị dòng mô tả ngắn trên thẻ việc.
- `motion`: Bật/tắt toàn bộ chuyển động (tuân thủ cả `prefers-reduced-motion`). Khi tắt, nhân vật ngừng bay và nền ở trạng thái tĩnh.
- `lightSky`: Tùy chọn bầu trời nền Sáng: *Tự động* · *Bình minh* · *Hoàng hôn*. Chế độ Tự động sẽ chuyển sang Hoàng hôn từ sau 12h trưa.
- `moonDay`: Chu kỳ Mặt Trăng: `0` = tính pha trăng thật theo thuật toán Thiên văn Âm lịch, `1–30` = ép một pha trăng cụ thể để xem trước.

---

## 3. Nền Thường (Default Light & Dark)

- **1b Tinh gọn**: Tone màu tím thanh lịch. Không có hoạt ảnh nền gây phân tâm. Cột không viền nặng nề, thẻ thanh thoát tối đa. Ngăn chi tiết neo cố định bên phải mở sẵn giúp thao tác nhanh.

---

## 4. Nền Sáng (Aurora Day / Forest Day)

- **1c Bình minh**: Nền cực quang pastel êm dịu, cột kính mờ trong trẻo, thẻ bo tròn lớn, có dải giờ Hôm nay chạy theo tương tác.
- **2b Sáng**: Kế thừa 1c, thẻ có dải màu phân loại theo hạn chót (Xanh lá: đã xong, Vàng: hôm nay, Đỏ: trễ hạn).
- **Hiệu ứng nền luôn chạy**:
  - Mặt trời mọc và thở sáng chu kỳ 26s (`sunRise 26s`), đảo chiều êm dịu khi ở chế độ Hoàng hôn.
  - Các mảng mây bồng bềnh trôi, tia nắng quét nhẹ, đốm bụi nắng lơ lửng.
- **Kịch bản bay qua bầu trời ban ngày (Ngẫu nhiên)**:
  1. `jet`: Máy bay phản lực xé gió lướt qua để lại vệt khói trắng dài.
  2. `show`: Máy bay biểu diễn nhào lộn trên không.
  3. `heli`: Trực thăng tuần tra với cánh quạt quay tít.
  4. `rocket`: Tên lửa không gian phóng vút thẳng lên vũ trụ.
  5. `birds`: Đàn chim sải cánh bay di cư theo hình chữ V.
  6. `eagle`: Đại bàng dũng mãnh chao lượn trên tầng không.
  7. `balloon`: Khinh khí cầu rực rỡ sắc màu bay êm đềm.
  8. `paper`: Chiếc máy bay giấy tuổi thơ chao đảo trong gió.
  9. `banner`: Máy bay kéo băng rôn động viên ngẫu nhiên (*“Cố lên, sắp xong rồi!”*, *“Nhớ uống nước nhé”*, *“Hôm nay bạn làm tốt lắm”*, *“Xong việc rồi đi chơi!”*, và câu chào sáng sớm *“Chào buổi sáng! Chúc một ngày năng suất!”* trong khung giờ 5h–9h).
  10. `abduct`: UFO bay lượn và chiếu tia bắt cóc hài hước (xem chi tiết mục 5).

---

## 5. Nền Tối (Aurora Night)

- **1a Cực quang**: Bầu trời vũ trụ sâu thẳm, dải cực quang xanh ngọc lượn sóng ở mép trên, thẻ kính mờ phát quang viền.
- **2a Tối**: Kế thừa 1a, bổ sung đường chân trời hành tinh, sao băng, sao chổi quét ngang.
- **Hiệu ứng nền luôn chạy**:
  - Cực quang lượn sóng nhịp nhàng.
  - Sao lấp lánh (twinkle), sao băng rạch ngang bầu trời, vệt sao chổi dài.
  - Chòm sao tự động hiện mờ rồi vẽ nét nối liền (chu kỳ 150s).
  - Trăng lưỡi liềm hoặc trăng tròn biến đổi chính xác theo lịch âm.
- **Kịch bản bay đêm (Ngẫu nhiên)**:
  1. `owl`: Cú mèo vỗ cánh bay ngang qua vầng trăng, kêu *"hú… hú…"*.
  2. `bats`: Đàn dơi đêm bay rợp trời.
  3. `nplane`: Máy bay đêm với đèn tín hiệu đỏ/trắng nhấp nháy; ban đêm sau 23h kéo dải banner nhắc nhở ngủ sớm (*"Nghỉ ngơi sớm thôi~"*, *"Đừng thức khuya quá nhé!"*).
  4. `iss`: Trạm vũ trụ quốc tế ISS lướt qua quỹ đạo.
  5. `astro`: Phi hành gia lơ lửng mất trọng lực giữa các vì sao.
  6. `meteors`: Mưa sao băng rực rỡ rơi từ trên cao.
  7. `lanterns`: Đèn lồng trời ấm áp từ từ bay lên.
  8. `whale`: Cá voi lưng gù khổng lồ bơi chậm rãi giữa ngân hà.
  9. `hangnga`: Hằng Nga từ mặt trăng giáng trần ghé thăm với 1 trong 5 lời dặn: *“Ngủ sớm nha~”*, *“Làm xong task chưa?”*, *“Chúc ngủ ngon~”*, *“Trăng đẹp hông?”*, *“Mai làm tiếp nha~”*.
  10. `abduct`: UFO chiếu tia hút nhân vật:
      - **10 nạn nhân**: Bò (*“Mòooo!”*), Cừu (*“Beeee!”*), Gà (*“Cục tác!!”*), Heo (*“Ủn ỉn!!”*), Mèo cam (*“Meooo!”*), 2 mèo đánh nhau khói bụi (*“Grừừ! Meo!!”*), Người thường (*“Cứu với!!”*), Nhân viên văn phòng (*“Còn deadline mà!!”*, *“Chưa chấm công!!”*), Dev (*“Chưa push code!!”*, *“Đang deploy mà!!”*, *“Còn bug chưa fix!!”*), Shipper (*“Đơn chưa giao!!”*), Sếp (*“Ai duyệt task đây!!”*).
      - **5 kết cục bất ngờ**:
        - *Hút thành công* (26%): Bị hút vào buồng lái và UFO phóng vút đi.
        - *Được cứu* (20%): Tên lửa bắn nổ UFO với tiếng *“BÙM!”*, nạn nhân rơi tiếp đất an toàn.
        - *Rơi xuống* (20%): Nạn nhân rơi tưng trên mặt đất rồi bỏ chạy thục mạng.
        - *UFO chê trả lại* (17%): UFO trả về vì quá ồn ào hoặc sợ bị lây bug / deadline / họp hành (*“Đòi wifi mạnh hơn, trả!”*, *“Bug lây sang tàu, trả!”*, *“Bắt họp 3 tiếng, trả!”*).
        - *Tuột tay giữa chừng* (17%): UFO kêu *“Ơ… tuột rồi?!”*, nạn nhân tiếp đất thốt lên *“Hụt rồi nha!”*, *“Thoát!!”*.
  11. `dome`: UFO đáp xuống bề mặt hành tinh xa xôi (desktop).
  12. Toàn bộ các hiện tượng thiên nhiên huyền ảo (mục 7).

---

## 6. Nền Tiên (Rừng tiên — Elf Forest)

### 6.1 Cảnh nền luôn chạy
- **Ban ngày (3a)**:
  - Rừng nguyên sinh đa tầng: Tán lá rậm rạp đung đưa theo gió, thân cây cổ thụ rêu phong bám rễ sâu xuống đất.
  - Cột nắng xuyên qua kẽ lá (god rays) kết hợp các đốm nắng vàng dập dờn.
  - Dải suối ngọc uốn lượn ven rừng với các gợn sóng lăn tăn và điểm sáng lấp lánh.
  - Sương rừng nhiều lớp trôi chậm, tự hòa tan và kết tụ lại.
  - Bào tử hoa, cánh hoa và lá vàng khẽ chao liệng rơi xuống.
  - Đom đóm ban ngày phát sáng nhạt, bướm tiên dập dờn bay lượn.
  - Thẻ việc kiểu tiên: Thân thẻ ngọc bích, mép cột phủ dây leo và búp hoa nở.
- **Ban đêm (3b)**:
  - Bầu trời đêm sâu huyền ảo ẩn hiện sau tán cây rừng đại ngàn.
  - Vầng trăng ngọc phát sáng xuyên qua cành lá.
  - Bào tử nấm và lá dạ quang phát sáng xanh ngọc bích bay bổng lên trời.
  - Bầy đom đóm dạ quang bay theo bầy lập lòe ánh vàng chanh và ngọc bích.

---

### 6.2 Bấm và rê chuột lên nền (Easter Eggs & Tương tác môi trường)

1. **Bấm vào Mặt Trăng (`moonClick`)**:
   - Nhấp vào Mặt Trăng (Nền Tối & Rừng Đêm): Vầng trăng khẽ nảy rạng rỡ, chú **Thỏ Ngọc** từ sau trăng ló đầu lên vẫy đôi tai xinh xắn chào bạn: **“Chào bạn!”** rồi thụt xuống (hệ thống có cooldown 15s để chống spam).
2. **Bấm vào Mặt Suối (`waterSplash`)**:
   - Nhấp vào dải suối ở đáy màn hình: Mặt nước lập tức bắn tóe vòng sóng ánh ngọc, chú **cá Koi** búng mình nhảy vọt lên cao uốn lượn rồi lặn xuống kèm bong bóng thoại: **“Tõm! 🐟”**.
3. **Đuôi chuột dải Ngân Hà (`stardustTrail`)**:
   - Di chuột trên nền trời đêm: Đầu con trỏ để lại một vệt bụi sao lấp lánh (stardust trail) tự tan biến êm đềm sau 0.5s, tạo cảm giác ngón tay chạm vào bầu trời vô tận.
4. **Tương tác Dây leo cột Kanban (`vineHover`)**:
   - Rê chuột qua đầu các cột Kanban: Dây leo khẽ đung đưa mềm mại, bông hoa tiên trên đỉnh hé nở toả ánh hào quang nhẹ rồi từ từ khép lại.
5. **Nấm nảy boing**:
   - Bấm vào các cây nấm ở mép dưới: Nấm nhún nảy đàn hồi (squash & stretch) trong 0.65s, bắn tung 14 hạt sáng kèm chữ **“boing!”**.
6. **Bắt đom đóm theo chuột**:
   - Bấm trúng đom đóm đang bay: Đom đóm phát nổ chùm sáng, hoá lớn và **bay lượn bám theo đầu chuột suốt 6 giây**, sau đó bay vụt lên trời.
7. **Rung cây lá rơi**:
   - Bấm vào khoảng trống tán cây: Tán cây xào xạc rung lên, làm rụng một chùm 9 chiếc lá (mobile 6 lá) xoay tít rơi xuống. Ban đêm lá phát quang xanh ngọc.
8. **Rẽ sương**:
   - Rê chuột qua màn sương: Sương rừng tự động dạt ra tạo khoảng trống bán kính 150px (mobile 90px). Khi dừng chuột 250ms, sương nhẹ nhàng tụ lại.

---

### 6.3 Gamification & Thẻ việc (Card Delight)

1. **Thẻ đang làm (Doing)**:
   - 3 chú đom đóm nhỏ xinh lượn vòng lập lòe quanh viền thẻ như tiếp thêm năng lượng tập trung.
2. **Thẻ hoàn thành (Done)**:
   - Dây leo trên mép thẻ bừng nở cụm hoa 5 cánh rực rỡ kèm hoa nở góc thẻ (`bloom`).
   - Nàng tiên nhỏ phát sáng bay lượn vòng tròn rồi vút lên trời cao.
3. **Thả task vào cột Xong (`drop_done`)**:
   - Khi kéo thả thẻ hoặc tick xong: Đàn bướm 4 màu tung cánh bay túa ra từ thẻ việc bay lượn hướng lên trời cùng chùm hạt sáng may mắn.
4. **Đại tiệc ăn mừng xong hết việc (`bigCelebrate`)**:
   - Khi hoàn thành toàn bộ việc cần làm trong ngày hôm nay:
     - Luồng sáng vàng/ngọc bùng toả từ tâm màn hình.
     - Đàn đom đóm khổng lồ từ dưới bay lên kết thành **Trái Tim Phát Sáng**.
     - Băng rôn chữ vàng lấp lánh: **“Xong hết việc hôm nay!”** ngự trị trong 7 giây.
     - Ban đêm kích hoạt thêm dải cực quang rực rỡ cực đại trong 11s.
5. **Thẻ trễ hạn $\ge 3$ ngày (`late_nest`)**:
   - Mép trên thẻ rủ xuống một sợi tơ nhện mảnh đung đưa kèm **chú rùa nhỏ** bò chậm rãi trên mép thẻ. Khi rê chuột vào chú rùa sẽ hiện thì thầm khích lệ: **“Chậm mà chắc nha, làm thôi!”**.
6. **Tiến hóa Cây Chuỗi Ngày (`streak_tree` góc trái dưới)**:
   - **Từ ngày 1 đến ngày 6**: Cây mầm nhô cao dần, mỗi ngày ra thêm 1 nhánh lá non.
   - **Đạt 7 ngày**: Cây bừng nở một bông hoa hồng rực rỡ trên đỉnh.
   - **Đạt 14 ngày**: Dưới gốc chậu cây mọc thêm cụm **Nấm Phát Sáng** lung linh dạ quang.
   - **Đạt 30 ngày**: Trên cành cây xuất hiện **Chú Cú Nhỏ** đậu ngủ gật bình yên, thỉnh thoảng mở hé mắt canh chừng công việc cho bạn.

---

### 6.4 Toàn bộ Danh mục Kịch bản Ban ngày (15 kịch bản)

1. `deer`: Hươu sao thanh thoát bước đi khoan thai ngang qua màn hình.
2. `butterflies`: Đàn bướm tiên rực rỡ nối đuôi nhau lượn sóng.
3. `bluebird`: Chim xanh may mắn bay vút qua mang tin vui.
4. `mushroom`: Nấm thần thoại từ đất nhô lên toả sáng rồi thụt xuống.
5. `dandelion`: Cụm hoa bồ công anh tung bay những chiếc dù nhỏ trong gió.
6. `squirrel`: Bé sóc đuôi xù thoăn thoắt nhảy nhót kiếm hạt dẻ.
7. `sunray`: Cột nắng vàng ấm áp quét qua tán lá.
8. `squirrelchase`: Đôi sóc con tinh nghịch đuổi bắt nhau vòng quanh thân cây.
9. `frog`: **Kịch bản chuỗi liên hoàn** — Chú ếch xanh phóng lưỡi đớp chuồn chuồn, chuồn chuồn lanh chanh né thoát trêu *“Lêu lêu~”*, lưỡi ếch vô tình dính phải chiếc lá khô kéo tọt vào miệng khiến ếch nghẹn sặc kêu *“Ặc… lá!”*.
10. `rainbow`: Cầu vồng 7 sắc lung linh bắc ngang góc trời sau cơn mưa.
11. `gnome`: Chú lùn Gnome từ dưới hang nhô đầu lên ra hiệu *“Suỵt!”*.
12. `bee`: Chú ong vàng chăm chỉ bay qua làm rớt giọt mật ngọt thốt lên: *“Ối, rơi mật!”*.
13. `deernut`: Sóc trên cành nghịch ngợm ném quả sồi trúng đầu chú hươu tóe sao vàng — hươu ngơ ngác quay đầu *“?!”*, sóc trên cây khoái chí cười *“Hí hí!”*.
14. `carrier_pigeon` (Mới): Bồ câu đưa thư bay qua làm rơi một lá thư gấp hình trái tim trôi bồng bềnh; rê chuột vào phong thư sẽ mở ra lời chúc/động viên ngẫu nhiên (*“Bạn đang làm rất tốt!”*, *“Hít một hơi thật sâu nào”*, *“Cứ từ từ, việc gì cũng xong!”*).
15. `rainbow_slide` (Mới): Sau khi cầu vồng xuất hiện, bé sóc tinh nghịch trượt từ đỉnh cầu vồng xuống đất như máng trượt nước rồi đứng dậy vẫy tay reo: *“Vui quá đi~”*.

---

### 6.5 Toàn bộ Danh mục Kịch bản Ban đêm (33 kịch bản + thiên nhiên)

#### A. Cảnh không thoại (17 cảnh):
1. `lanterns`: Đèn lồng hoa đăng rực rỡ trôi lững lờ giữa trời đêm.
2. `owl`: Cú vọ dang rộng đôi cánh săn đêm.
3. `koi`: Đàn cá chép phát sáng bơi lượn như bay giữa biển sao.
4. `veins`: Mạch năng lượng địa linh phát quang chạy dọc từ lòng đất lên rễ cây.
5. `ring`: Vòng tròn nấm tiên phát quang ma thuật bừng sáng trong rừng.
6. `starfall`: Từng chùm bụi sao rơi lả tả xuống mặt đất.
7. `spirit`: Thần Rừng vĩ đại khổng lồ trầm mặc sải bước trong đêm.
8. `whale`: Cá voi thiên hà bơi lội giữa ngàn tinh tú.
9. `koistar`: Cá chép Koi bay lên đớp lấy một ngôi sao băng đang rơi.
10. `owlmiss`: Cú mèo sà xuống vồ hụt con mồi rồi chao cánh bay lên.
11. `spiritbow`: Thần Rừng dừng chân cung kính cúi chào người làm việc chăm chỉ.
12. `dragon`: Rồng xanh phương Đông uyển chuyển uốn lượn quanh các tầng mây.
13. `leafrider`: Tiên tí hon cưỡi chiếc lá bay lướt như ván trượt trên không.
14. `constel`: Chòm sao thần kỳ tự vẽ nối các vì sao thành hình cá voi hoặc rồng.
15. `kitsune`: Cáo chín đuôi chạy lướt qua kéo theo vệt lửa hồ ly ma trơi huyền ảo.
16. `fairynap`: Nàng tiên ngủ gật bồng bềnh trên cành cây, thở ra 5 bong bóng ngủ và chữ *“z”* bay lên.
17. `bloom` (Mới): **Dạ Quỳnh nở đêm** — Búp hoa ánh ngọc nhô lên từ bờ suối, từ từ hé nở xòe cánh tỏa phấn hoa lấp lánh (8s), bầy đom đóm bay tụ quanh chiêm ngưỡng rồi hoa khép cánh tan thành hạt sao bay lên trời.

#### B. Cảnh có thoại & kịch bản kịch tính (16 cảnh):
18. `whaleeat`: Cá voi thiên hà há to miệng nuốt chửng đèn lồng, nuốt xong vỗ bụng kêu: *“Ợ~”*.
19. `unicorn`: Kỳ lân trắng cúi đầu uống nước suối tiên khen: *“Nước suối tiên ngọt ghê~”*.
20. `wisp`: Đốm ma trơi bay lượn dụ dỗ: *“Theo ta nào…”*, rồi bất thình lình *“Phụt!”* biến mất.
21. `witch`: Mụ phù thủy cưỡi chổi bay vèo qua cười khoái trá: *“Hí hí hí~”*.
22. `blackcat`: Mèo đen mun mắt sáng quắc ngồi liếm lông kêu: *“Meo~”*.
23. `ent`: Người Cây cổ thụ thức giấc vươn tay ngáp dài: *“Ngáaaap~”*.
24. `foxlant`: Cáo tinh ranh cướp đèn lồng bỏ chạy *“Của ta!”* ↔ Chiếc đèn thần rượt đuổi đòi lại *“Trả đèn đây!”*.
25. `wispowl`: Ma trơi bỗng *“Phụt!”* tắt ngúm làm cú mèo lạc hướng đập cánh ngơ ngác: *“Ơ… đây là đâu?”*.
26. `witchwhale`: Phù thủy mải bay đâm sầm vào bụng cá voi khổng lồ *“Bốp!”*, rơi mất chổi la toáng: *“Ối, chổi của ta!”*.
27. `catwisp`: Mèo đen nhảy chồm vồ ma trơi bị *“Hụt!”*, đốm ma trơi lộn nhào cười chọc quê: *“Hí hí~”*.
28. `owlsinge`: Cú mèo bay sát đốm lửa bị bén cháy xém lông kêu ầm ĩ: *“Grừ!! Cháy lông rồi!”*.
29. `heal`: **Kịch bản chữa lành** — Cú mèo khóc mếu *“Huhu, cháy hết lông rồi…”* $\rightarrow$ Kỳ lân xuất hiện chạm sừng phát sáng chữa lành bộ lông $\rightarrow$ Cú vui sướng: *“Cảm ơn kỳ lân!”* *(Tự động kích hoạt sau `owlsinge` 10 giây hoặc ngẫu nhiên xuất hiện)*.
30. `witchpotion` (Mới): Phù thủy phóng chổi vội vàng làm rơi lọ thuốc độc tím xuống vỡ toé hạt sáng.
31. `catgiant` (Mới — Chuỗi liên hoàn sau `witchpotion` 6s): Mèo đen tò mò chạy lại liếm bãi thuốc $\rightarrow$ Đột ngột phình to khổng lồ gấp 2.8x ở góc màn hình, mắt rực sáng gầm vang rung chuyển: **“NGOAOOO!!”** $\rightarrow$ 3s sau hắt xì hơi một cái xẹp lép trở về hình dạng cũ rồi vụt chạy trốn.
32. `abduct_gnome` (Mới): UFO chiếu luồng sáng hút chú lùn Gnome lên trời $\rightarrow$ Chú lùn vung búa giáng mạnh *“Cốp! Cốp!”* vào bụng đĩa bay $\rightarrow$ UFO nổ điện tóe lửa xả tia nhả rơi chú lùn $\rightarrow$ Chú lùn tiếp đất phủi mông dõng dạc: **“Đừng đùa với ta!”** rồi chui tọt lại vào hang.

---

## 7. Hiện tượng thiên nhiên huyền bí (`nature-fx.js`)

Xen kẽ vào bầu trời đêm của cả **2a Tối** và **3b Rừng tiên đêm**:

1. `aurora` (20s): Ba dải cực quang lượn sóng mềm mại vắt ngang vòm trời.
2. `wish` (5.6s, mobile 4.8s): Sao ước băng qua bầu trời mang nhãn *“Bấm để ước”*. Bấm trúng sẽ nổ 18 hạt hào quang và hiện tấm thẻ **Điều Ước** với 1 trong 8 điều ước hài hước:
   - *“Ước gì deadline tự lùi một tuần”*
   - *“Ước việc tự kéo sang cột Xong”*
   - *“Ước họp năm phút là xong”*
   - *“Ước cuối tuần dài ba ngày”*
   - *“Ước inbox về số 0”*
   - *“Ước sếp duyệt ngay lần đầu”*
   - *“Ước không còn việc quá hạn”*
   - *“Ước cà phê không bao giờ nguội”*
3. `orion` (15s): Chòm sao Thợ Săn Orion tự nối các vì sao, giương cung bắn mũi tên sao nổ hạt lung linh.
4. `moonbow` (15s): Màn mưa phùn mỏng quét qua, để lộ cầu vồng trăng tỏa ánh bạc dịu kỳ.
5. `milky` (26s): Dải Ngân Hà nghiêng chậm rãi xoay tròn giữa vòm trời.
6. `dew` (8s): Giọt sương thần ngưng tụ từ đỉnh trời rơi xuống mặt đất toé sóng nước lấp lánh.
7. `silverleaf` (10s): Lốc xoáy cuốn theo muôn vàn chiếc lá bạc lướt ngang màn hình.
8. `glowdand` (13s): Bồ công anh dạ quang vươn lên từ mặt đất, cánh hoa bung bay toả sáng.
9. `moss` (12s): Thảm rêu phát quang ma thuật lan tỏa theo từng bước chân vô hình.
10. `eclipse` (18s): Hiện tượng Nguyệt thực Trăng Máu huyền bí (xác suất 1/40 đè lên kịch bản thường).

---

## 8. Nhịp điệu xuất hiện & Bối cảnh thời gian thực

- **Tần suất xuất hiện nhân vật**:
  - *Kanban tối/sáng*: Desktop 2.5–7.5s/lượt (tối đa 5 cảnh đồng thời). Mobile 4–10s/lượt (tối đa 3 cảnh).
  - *Rừng tiên*: Desktop 3–8s/lượt (tối đa 5 cảnh đồng thời). Mobile 4.5–10.5s/lượt (tối đa 3 cảnh).
  - Không bao giờ lặp lại cùng một kịch bản hai lần liên tiếp.
  - Tự động tạm dừng hoạt ảnh khi chuyển tab (`document.hidden`) hoặc khi bật chế độ giảm tải (`motion = false`).
- **Khung giờ Sáng sớm (5h00 – 9h00)**:
  - Máy bay và các nhân vật kéo banner chào buổi sáng: *“Chào buổi sáng! Chúc một ngày năng suất!”*.
- **Khung giờ Khuya muộn (sau 23h00)**:
  - **Giữ nguyên 100% tần suất nhân vật** (không bị vắng vẻ hay giảm số lượng nhân vật).
  - Máy bay đêm và các nhân vật kéo dải lụa/banner nhắc nhở giữ sức khỏe nhẹ nhàng: *“Nghỉ ngơi sớm thôi~”*, *“Đừng thức khuya quá nhé!”*, *“Ngủ sớm giữ sức khỏe nha~”*.
