# CoCorn - Modern Screen Recorder & Capture Tool

<p align="center">
  <strong>CoCorn</strong> — Zamonaviy, qulay va kuchli ekran yozib oluvchi va screenshot vositasi (macOS & Windows).
</p>

---

## 🚀 Asosiy Imkoniyatlar (Key Features)

1. **🖥️ Butun Ekran va Alohida Dastur (Full Screen & Window Capture):**
   - **Butun ekran (Display):** macOS Desktop Spaces, Mission Control va to'liq ekrandagi dasturlar orasida erkin o'tganda ham uzluksiz, qotmasdan yozish.
   - **Alohida dastur (Window):** Kerakli aniq bir dastur oynasini tanlab yozish imkoniyati.
   - Ko'p monitorli tizimlar (Multi-display) to'liq qo'llab-quvvatlanadi.

2. **⚡ Smart Auto-Zoom (Kamerani avtomatik yaqinlashtirish):**
   - Kursorni biror funksiya yoki ob'ekt ustiga olib borganda silliq (cinematic) yaqinlashish (zoom in).
   - Kursor siljiganda yana asl holatga qaytish (zoom out).
   - Hech qanday qotish va sakrashlarsiz, doimiy ravishda 1.0x dan pastga tushib ketmaydi.

3. **📸 Tezkor Screenshot Vositalari:**
   - Ekranning ixtiyoriy sohasini erkin qirqib olish (Snip tool).
   - Screenshot olinishi bilanoq avtomatik xotiraga (Clipboard) nusxalanadi va fayl sifatida saqlash mumkin.
   - Toza tasvir — ekran qirqilayotgan paytda ortiqcha interfeyslar kadrga tushmaydi.

4. **✏️ Ekranga Chizish va Belgilash (Live Annotation):**
   - Yozish jarayonida to'g'ridan-to'g'ri ekranga qalam bilan chizish, strelkalar, to'rtburchaklar va doiralar qo'yish.
   - Ranglar va chiziq qalinligini tanlash.

5. **📹 Aylana Veb-kamera (Floating Camera Bubble):**
   - Ekranning istalgan joyiga erkin surish (Drag & Drop).
   - 3 xil o'lcham (Kichik - 140px, O'rtacha - 200px, Katta - 280px).
   - Kamerani oynasimon akslantirish (Mirror).
   - Barcha oynalar ustida turish (`alwaysOnTop`).

6. **🎬 Kichik Boshqaruv Paneli (Mini Bar) va Menu Bar:**
   - Ekranning pastki qismida paydo bo'ladigan ixcham va qulay mini-panel.
   - Mac menyu panelida (Tray Icon) doimiy turish va bir zumda ochish.

7. **🎞️ Yuqori Sifatli Video va Audio:**
   - O'rnatilgan FFmpeg yordamida **H.264 MP4 (CRF 19, YUV420p)** formatiga o'tkazish.
   - Apple QuickTime Player, Safari, Windows Media Player, iOS va veb-brauzerlar bilan 100% mos keladi.
   - Audio va video sinxronlashuvi (`aresample=async`).
   - WebM formatida tezkor saqlash va vaqt shkalasi bo'yicha to'liq o'tkazish (cues remux).

8. **⌨️ Sozlanuvchi Global Qaynoq Tugmalar (Shortcuts):**
   - Boshlash / To'xtatish: `Cmd/Ctrl + Shift + R`
   - Pauza / Davom ettirish: `Cmd/Ctrl + Shift + P`
   - Screenshot olish: `Cmd/Ctrl + Shift + S`
   - Chizish vositasini ochish: `Cmd/Ctrl + Shift + D`
   - Auto-Zoom almashtirish: `Cmd/Ctrl + Shift + Z`

---

## 🛠️ O'rnatish va Ishga Tushirish

### 1. Ishlab chiquvchi rejimida ishga tushirish (Development)

```bash
git clone https://github.com/hakimbek-qa/cocorn.git
cd cocorn
npm install
npm start
```

### 2. O'rnatuvchi fayllarni yig'ish (Build & Package)

**macOS uchun (.dmg):**
```bash
npm run dist -- --mac dmg --arm64
```

**Windows uchun (.exe setup va portable):**
```bash
npm run dist -- --win nsis portable --x64
```

---

## ⚙️ macOS Ruxsatlari (Permissions)

Dastur mukammal ishlashi uchun macOS tizimida ruxsat berilganligiga ishonch hosil qiling:
- **Screen Recording:** *System Settings -> Privacy & Security -> Screen Recording*
- **Camera:** *System Settings -> Privacy & Security -> Camera*
- **Microphone:** *System Settings -> Privacy & Security -> Microphone*

---

## 📄 Litsenziya (License)

Ushbu loyiha [MIT](LICENSE) litsenziyasi asosida ochiq manbali (open-source) qilib tarqatiladi.

## 👤 Muallif (Author)

**Hakimbek Boboyev**
- Email: [hakimbekboboyev@gmail.com](mailto:hakimbekboboyev@gmail.com)
- GitHub: [@hakimbek-qa](https://github.com/hakimbek-qa)
