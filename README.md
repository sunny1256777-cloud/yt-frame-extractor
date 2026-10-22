# 🎬 YouTube Frame Extractor Chrome Extension

Ye ek Chrome Extension hai jo YouTube video se **har second ka 1 frame (1 FPS)** nikaal kar unhe ek single **ZIP file** me pack karke download kar deta hai.

Agar 1 minute (60 seconds) ki video hai, toh lagbhag **60 frames** (har second ka 1 frame) milenge ek single click me.

---

## 🚀 Features
- **1-Click Extraction**: Ek click me video ke saare frames `.zip` file me download ho jaate hain.
- **Customizable Frame Rate**:
  - Default: **1 frame per second (1 FPS)**
  - Options for: 2 FPS (har 0.5 sec), 0.5 FPS (har 2 sec), ya custom interval.
- **Custom Time Range**: Poori video ya kisi specific part (e.g., 0 to 60 seconds) ke frames nikaal sakte ho.
- **In-Page Floating Button**: YouTube player ke paas floating "Extract Frames" button milta hai.
- **Audio Auto-Mute**: Fast scrubbing ke dauran audio mute rehta hai taaki koi disturbance na ho.
- **JPG & PNG Support**: High quality JPG (smaller ZIP) ya Lossless PNG.
- **Offline & Safe**: Saara processing aapke browser me locally hota hai (JSZip bundled).

---

## 🛠 Chrome me Kaise Install Karein (3 Steps):

1. Chrome browser open karein aur address bar me type karein:
   ```text
   chrome://extensions/
   ```
2. Top right corner me **"Developer mode"** toggle ko **ON** karein.
3. Top left me **"Load unpacked"** button par click karein aur is folder ko select karein:
   ```text
   C:\Users\Hp\.gemini\antigravity\scratch\yt-frame-extractor
   ```

---

## 🎯 Kaise Use Karein:
1. Kisi bhi YouTube video (`https://www.youtube.com/watch?v=...`) ko open karein.
2. Extension icon (toolbar me) par click karein ya screen ke bottom-right me **"Extract Frames"** floating button dabayein.
3. **"Extract Frames & Download ZIP"** par click karein.
4. Frames capture hone ke baad automatically `.zip` file download ho jaayegi!
