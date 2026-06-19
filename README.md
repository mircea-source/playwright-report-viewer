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
REPORTS_BASE_PATH=<unitate_locala>:\<calea_catre_director_rapoarte>
```

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
🎭 Playwright Report Viewer Server
=====================================
📁 Reports path: E:\GIT Repo\CETA\reports

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
<unitate_locala>:\<calea_catre_director_rapoarte>\
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

Editează `server.js`:
```javascript
const PORT = 3001; // sau alt port liber
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
