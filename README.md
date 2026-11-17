# Playwright Report Viewer - Web Edition

Aplicație web locală pentru vizualizarea și analiza rapoartelor Playwright, cu grafice statistice și acces din rețeaua locală.

## 🌟 Funcționalități Principale

- 📊 **Grafic statistici lunare** - trend de rezultate (Passed / Failed / Flaky / Skipped) pentru luna selectată
- 🖱️ **Click pe bara din grafic** → deschide direct raportul corespunzător
- 📂 **Scanare automată** - detectează rapoartele fără regenerare manuală
- 🌐 **Acces multi-dispozitiv** - din orice device din rețeaua locală
- ⚡ **Deschidere instantanee** - rapoartele se deschid în același browser, fără procese externe
- 🔍 **Trace viewer & atașamente** - screenshot-uri, videoclipuri și trace-uri disponibile complet

---

## 🚀 Quick Start

### 1. Instalare dependențe

```bash
npm install
```

### 2. Configurare cale rapoarte

Editează fișierul `.env` și setează calea către directorul cu rapoarte:

```env
REPORTS_BASE_PATH=D:\Proiecte\Portal\reports
# Opționale (valori implicite)
PORT=3000
PROJECT_NAME=Playwright Report Viewer
FOLDER_PREFIX=playwright-report-
# Temă: culoarea principală (fundal + butoane); nuanța închisă se calculează dacă lipsește
PRIMARY_COLOR=#1d8187
PRIMARY_COLOR_DARK=#045a63
# Favicon: cale absolută sau relativă la folderul viewer-ului (implicit public\favicon.ico)
FAVICON_PATH=favicons\proiect.ico
```

Vezi și `.env.example`.

### Mai multe proiecte (câte o instanță pe proiect)

Creează câte un fișier de configurare pentru fiecare proiect, cu port diferit, de ex. `.env.magazin`:

```env
REPORTS_BASE_PATH=D:\Proiecte\Magazin\reports
PORT=3001
PROJECT_NAME=Magazin Report Viewer
PRIMARY_COLOR=#7b2cbf
FAVICON_PATH=favicons\magazin.ico
```

Pornește instanța cu:

```bash
node server.js --env .env.magazin
# sau: start-server.bat --env .env.magazin
```

Fișierele `.env.*` sunt în `.gitignore` (căile sunt specifice fiecărui calculator).

### 3. Pornire server

```bash
npm start
```

Sau dublu-click pe **`start-server.bat`**.

### 4. Accesare

| | URL |
|---|---|
| Local | `http://localhost:3000` |
| Din rețea | `http://[IP-ul-tău]:3000` (afișat în consolă la pornire) |

---

## 📱 Acces din Rețeaua Locală

```
🎭 Playwright Report Viewer
=====================================
⚙️  Config file:  D:\Tools\playwright-report-viewer\.env
📁 Reports path: D:\Proiecte\Portal\reports
🏷️  Folder prefix: playwright-report-
🎨 Colours:      #1d8187 / #045a63
🖼️  Favicon:      D:\Tools\playwright-report-viewer\public\favicon.ico

🌐 Server running on:
   Local:   http://localhost:3000
   Network: http://192.168.1.100:3000

📊 Access from any device on your network!
```

---

## 📊 Grafic Statistici

Când selectezi o lună din filtrul **Luna**, apare automat un grafic stacked-bar cu toate rulările din luna respectivă:

- **Axa X** - data și ora fiecărei rulări (din `report.json` → `startTime`)
- **Verde** - teste trecute (Passed)
- **Roșu** - teste eșuate (Failed)
- **Galben** - teste flaky
- **Gri** - teste sărite (Skipped)
- **Tooltip** - afișează numele folderului, totalul testelor și durata rulării
- **Click pe un stacked-bar** - deschide raportul respectiv direct în browser

---

## 📂 Structura Rapoarte Așteptată

```
D:\Proiecte\Portal\reports\
├── playwright-report-2026-01\
│   ├── playwright-report-2026-01-15-EN-STAGE\
│   │   └── index.html
│   └── playwright-report-2026-01-28-EN-DEV\
│       ├── index.html
│       ├── data\
│       │   └── *.zip         ← trace files
│       └── *.png             ← screenshots
├── playwright-report-2026-02\
│   └── playwright-report-2026-02-02-EN-DEV-nop-\
│       └── index.html
```

Sunt acceptate și rapoarte puse direct în director, fără folder de lună
(ex. `reports\playwright-report-2026-11-17-Stage-GA\index.html`). Luna se deduce din numele
folderului (`<prefix>YYYY-MM-DD-...`) sau, dacă numele nu conține o dată validă, din `startTime` din `report.json`.

Rapoartele pot conține un singur `index.html` (toate datele embedded ca ZIP în base64) sau fișiere suplimentare (traces, screenshots, videoclipuri).

---

## 🔧 API Endpoints

| Endpoint | Metodă | Descriere |
|----------|--------|-----------|
| `/api/reports` | GET | Listează toate rapoartele scanate |
| `/api/stats?month=playwright-report-YYYY-MM` | GET | Statistici pentru luna specificată |
| `/api/open-report` | POST | Înregistrează un raport deschis, returnează URL-ul viewer-ului |
| `/api/open-reports` | GET | Rapoartele urmărite curent |
| `/api/open-report/:index` | DELETE | Scoate un raport din listă |
| `/api/open-reports` | DELETE | Golește lista de rapoarte urmărite |
| `/api/config` | GET | Configurare server (port, IP-uri rețea) |
| `/reports/**` | GET | Servire statică fișiere raport (index.html, traces, screenshots, videoclipuri) |

---

## 📂 Structura Proiectului

```
playwright-report-viewer/
├── server.js          # Express server - API + static serving
├── package.json       # Dependențe npm (express, dotenv, nodemon)
├── .env               # Configurare locală (REPORTS_BASE_PATH)
├── start-server.bat   # Pornire rapidă
├── public/
│   └── index.html     # SPA - viewer, filtru luni, grafic statistici
└── README.md
```

---

## 🛠️ Troubleshooting

### Port 3000 ocupat?

Setează alt port în fișierul de configurare (`.env` sau cel dat cu `--env`):
```env
PORT=3001
```

### Nu găsește rapoarte?

Verifică că `REPORTS_BASE_PATH` din `.env` este corect:
- Folosește `\` simplu pentru backslash în Windows (nu `\\`)
- Exemplu: `REPORTS_BASE_PATH=C:\Playwright\reports`
- Folderele de lună trebuie să înceapă cu `playwright-report-`

### Graficul nu apare?

- Selectează o lună specifică din dropdown (nu "Toate lunile")
- Dacă statisticile nu se încarcă, verifică că fiecare subfolder conține `index.html`

### Trace viewer nu funcționează?

Raportul este servit static din `/reports/`. Dacă trace-urile nu se deschid, verifică că fișierele `.zip` există în folderul raportului (sunt generate doar când testele eșuează cu `use: { trace: 'on-first-retry' }`).

### Eroare "Cannot find module 'express'"?

```bash
npm install
```

---

## 📝 Scripts npm

```bash
npm start        # Pornește serverul
npm run dev      # Pornește cu auto-restart (nodemon)
```

---

## 🔐 Securitate

⚠️ Serverul rulează pe `0.0.0.0` (accesibil din rețea locală). Pentru acces doar local, editează `server.js`:

```javascript
app.listen(PORT, 'localhost', () => {
```

---

**Vezi istoricul de rapoarte multiple fără conflicte de porturi. 🎭**
