const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

// Config file can be chosen per project: `node server.js --env .env.proiectB`
// (defaults to .env). This lets several instances run side by side, one per project.
const envArgIndex = process.argv.indexOf('--env');
const ENV_FILE = envArgIndex !== -1 && process.argv[envArgIndex + 1]
    ? path.resolve(process.argv[envArgIndex + 1])
    : path.resolve(__dirname, '.env');

if (!fs.existsSync(ENV_FILE)) {
    console.error(`❌ Config file not found: ${ENV_FILE}`);
    process.exit(1);
}
require('dotenv').config({ path: ENV_FILE, quiet: true });

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const PROJECT_NAME = process.env.PROJECT_NAME || 'Playwright Report Viewer';
const FOLDER_PREFIX = process.env.FOLDER_PREFIX || 'playwright-report-';

const REPORTS_BASE_PATH = process.env.REPORTS_BASE_PATH;

if (!REPORTS_BASE_PATH || !fs.existsSync(REPORTS_BASE_PATH)) {
    console.error(`❌ REPORTS_BASE_PATH is missing or does not exist: ${REPORTS_BASE_PATH || '(not set)'}`);
    console.error(`   Check ${ENV_FILE}`);
    process.exit(1);
}

// --- Per-project theme: primary colour + favicon -------------------------------------------
const DEFAULT_PRIMARY = '#1d8187';
const DEFAULT_PRIMARY_DARK = '#045a63';
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function readColor(name) {
    const value = (process.env[name] || '').trim();
    if (!value) return null;
    if (!HEX_COLOR_RE.test(value)) {
        console.warn(`⚠️  ${name}="${value}" is not a hex colour (#rgb or #rrggbb) - ignored`);
        return null;
    }
    return value;
}

// Darker shade used for the background gradient end and button hover
function darken(hex, factor = 0.6) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return '#' + [0, 2, 4]
        .map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * factor).toString(16).padStart(2, '0'))
        .join('');
}

const PRIMARY_COLOR = readColor('PRIMARY_COLOR') || DEFAULT_PRIMARY;
const PRIMARY_COLOR_DARK = readColor('PRIMARY_COLOR_DARK')
    || (PRIMARY_COLOR === DEFAULT_PRIMARY ? DEFAULT_PRIMARY_DARK : darken(PRIMARY_COLOR));
// Page background gradient only; defaults to the primary colours
const BG_COLOR_START = readColor('BG_COLOR_START') || PRIMARY_COLOR;
const BG_COLOR_END = readColor('BG_COLOR_END') || PRIMARY_COLOR_DARK;

// FAVICON_PATH: absolute, or relative to this folder. Falls back to public/favicon.ico.
let FAVICON_PATH = path.join(__dirname, 'public', 'favicon.ico');
if (process.env.FAVICON_PATH) {
    const custom = path.resolve(__dirname, process.env.FAVICON_PATH);
    if (fs.existsSync(custom)) FAVICON_PATH = custom;
    else console.warn(`⚠️  FAVICON_PATH not found: ${custom} - using default favicon`);
}

// Middleware
app.use(express.json());

app.get('/theme.css', (req, res) => {
    res.type('text/css').set('Cache-Control', 'no-cache')
        .send(`:root { --primary: ${PRIMARY_COLOR}; --primary-dark: ${PRIMARY_COLOR_DARK}; `
            + `--bg-start: ${BG_COLOR_START}; --bg-end: ${BG_COLOR_END}; }\n`);
});

app.get('/favicon.ico', (req, res) => {
    // public/favicon.ico is git-ignored, so a fresh clone may have no icon at all
    if (!fs.existsSync(FAVICON_PATH)) return res.status(204).end();
    res.set('Cache-Control', 'no-cache').sendFile(FAVICON_PATH);
});

app.use(express.static('public'));
// Serve every report folder (index.html + traces/screenshots/videos) under /reports/
// Relative asset URLs in the Playwright HTML report resolve automatically this way.
app.use('/reports', express.static(REPORTS_BASE_PATH));

// Track open reports in memory
let openReports = [];

// Returns the relative path (from the report folder root) of the first PNG screenshot found,
// or null when no screenshot exists. Playwright stores screenshots in the root of the report
// folder or in a data/ subfolder, depending on version.
function getReportThumbnail(reportPath) {
    const pngRe = /\.png$/i;
    try {
        // 1. Check root of report folder
        const rootFiles = fs.readdirSync(reportPath);
        const rootPng = rootFiles.find(f => pngRe.test(f) && fs.statSync(path.join(reportPath, f)).isFile());
        if (rootPng) return rootPng;

        // 2. Check data/ subfolder
        const dataDir = path.join(reportPath, 'data');
        if (fs.existsSync(dataDir)) {
            const dataPng = fs.readdirSync(dataDir).find(f => pngRe.test(f));
            if (dataPng) return `data/${dataPng}`;
        }
    } catch { /* ignore unreadable folders */ }
    return null;
}

// Month group (<FOLDER_PREFIX>YYYY-MM) for a report stored directly in the base path.
// Uses the date in the folder name (<FOLDER_PREFIX>YYYY-MM-DD-...), otherwise the run's
// startTime from report.json, so a mistyped folder name still lands in the right month.
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FLAT_DATE_RE = new RegExp(`^${escapeRegExp(FOLDER_PREFIX)}(\\d{4})-(\\d{2})-\\d{2}`);
const flatMonthCache = new Map();

function getFlatReportMonth(folderName, reportPath) {
    const match = folderName.match(FLAT_DATE_RE);
    if (match) return `${FOLDER_PREFIX}${match[1]}-${match[2]}`;

    if (!flatMonthCache.has(reportPath)) {
        let month = `${FOLDER_PREFIX}unknown`;
        const startTime = getReportStats(reportPath)?.startTime;
        if (startTime) {
            const d = new Date(startTime);
            month = `${FOLDER_PREFIX}${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        flatMonthCache.set(reportPath, month);
    }
    return flatMonthCache.get(reportPath);
}

/**
 * Scans the reports directory and returns all report folders
 */
function scanReportsDirectory(basePath) {
    const reports = [];

    const addReport = (reportPath, month) => {
        const thumbnail = getReportThumbnail(reportPath);
        const relativePath = path.relative(basePath, reportPath).replace(/\\/g, '/');
        reports.push({
            month,
            name: path.basename(reportPath),
            path: reportPath,
            thumbnail,
            thumbnailUrl: thumbnail ? `/reports/${relativePath}/${thumbnail}` : null
        });
    };

    try {
        // Top-level folders starting with FOLDER_PREFIX are either:
        //  - month folders (<FOLDER_PREFIX>YYYY-MM) containing report folders, or
        //  - report folders placed directly in the base path (they contain index.html).
        const topFolders = fs.readdirSync(basePath)
            .filter(item => {
                const fullPath = path.join(basePath, item);
                return fs.statSync(fullPath).isDirectory() && item.startsWith(FOLDER_PREFIX);
            })
            .sort();

        topFolders.forEach(topFolder => {
            const topPath = path.join(basePath, topFolder);

            // Flat layout: the folder is itself a report
            if (fs.existsSync(path.join(topPath, 'index.html'))) {
                addReport(topPath, getFlatReportMonth(topFolder, topPath));
                return;
            }

            // Month layout: every subfolder is a report
            try {
                fs.readdirSync(topPath)
                    .filter(item => fs.statSync(path.join(topPath, item)).isDirectory())
                    .forEach(reportFolder => addReport(path.join(topPath, reportFolder), topFolder));
            } catch (err) {
                console.error(`Error reading month folder ${topFolder}:`, err.message);
            }
        });

        return reports;
    } catch (err) {
        console.error('Error scanning reports directory:', err.message);
        return [];
    }
}

// Extract a file from a ZIP buffer using built-in zlib
function extractFileFromZip(zipBuffer, filename) {
    try {
        // Find End of Central Directory record (search from end)
        let eocdOffset = -1;
        for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 65558); i--) {
            if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
                eocdOffset = i;
                break;
            }
        }
        if (eocdOffset === -1) return null;

        const numEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
        const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

        // Walk Central Directory entries
        let cdPos = cdOffset;
        for (let i = 0; i < numEntries; i++) {
            if (cdPos + 46 > zipBuffer.length) break;
            if (zipBuffer.readUInt32LE(cdPos) !== 0x02014b50) break;

            const compression = zipBuffer.readUInt16LE(cdPos + 10);
            const compressedSize = zipBuffer.readUInt32LE(cdPos + 20);
            const filenameLen = zipBuffer.readUInt16LE(cdPos + 28);
            const extraLen = zipBuffer.readUInt16LE(cdPos + 30);
            const commentLen = zipBuffer.readUInt16LE(cdPos + 32);
            const localOffset = zipBuffer.readUInt32LE(cdPos + 42);
            const fn = zipBuffer.slice(cdPos + 46, cdPos + 46 + filenameLen).toString('utf8');

            if (fn === filename) {
                // Read Local File Header to get actual data offset
                const lfhFnLen = zipBuffer.readUInt16LE(localOffset + 26);
                const lfhExtraLen = zipBuffer.readUInt16LE(localOffset + 28);
                const dataStart = localOffset + 30 + lfhFnLen + lfhExtraLen;
                const compressedData = zipBuffer.slice(dataStart, dataStart + compressedSize);

                if (compression === 0) {
                    return compressedData.toString('utf8');  // Stored
                } else if (compression === 8) {
                    return zlib.inflateRawSync(compressedData).toString('utf8');  // Deflate
                }
                return null;
            }
            cdPos += 46 + filenameLen + extraLen + commentLen;
        }
        return null;
    } catch (err) {
        return null;
    }
}

// Get test stats from a report folder's index.html (embedded ZIP) or report.json
function getReportStats(reportPath) {
    try {
        // Try standalone report.json first (Playwright sometimes creates it)
        const reportJsonPath = path.join(reportPath, 'report.json');
        if (fs.existsSync(reportJsonPath)) {
            return JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
        }

        // Extract from the ZIP embedded in index.html
        const indexPath = path.join(reportPath, 'index.html');
        if (!fs.existsSync(indexPath)) return null;

        const html = fs.readFileSync(indexPath, 'utf8');
        const marker = 'id="playwrightReportBase64">data:application/zip;base64,';
        const startIdx = html.indexOf(marker);
        if (startIdx === -1) return null;

        const dataStart = startIdx + marker.length;
        const endIdx = html.indexOf('</template>', dataStart);
        if (endIdx === -1) return null;

        const base64Data = html.slice(dataStart, endIdx).trim();
        const zipBuffer = Buffer.from(base64Data, 'base64');

        const reportJsonText = extractFileFromZip(zipBuffer, 'report.json');
        if (!reportJsonText) return null;

        return JSON.parse(reportJsonText);
    } catch (err) {
        console.error(`Error getting stats for ${reportPath}:`, err.message);
        return null;
    }
}

// API Endpoints

/**
 * GET /api/reports - Get all available reports
 */
app.get('/api/reports', (req, res) => {
    try {
        const reports = scanReportsDirectory(REPORTS_BASE_PATH);
        res.json({
            success: true,
            reports: reports,
            total: reports.length,
            basePath: REPORTS_BASE_PATH
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/open-reports - Get currently open reports
 */
app.get('/api/open-reports', (req, res) => {
    res.json({
        success: true,
        openReports: openReports
    });
});

/**
 * POST /api/open-report - Resolve a viewer URL and track the report.
 * Reports are served via the /reports static mount, so no extra process is spawned
 * and the default browser is never opened automatically.
 */
app.post('/api/open-report', (req, res) => {
    const { reportPath, reportName } = req.body;

    // Build a URL relative to our own server so all assets (traces, screenshots,
    // videos) resolve correctly via their relative paths inside index.html.
    const relativePath = path.relative(REPORTS_BASE_PATH, reportPath).replace(/\\/g, '/');
    const viewUrl = `/reports/${relativePath}/index.html`;

    const newReport = {
        name: reportName,
        path: reportPath,
        timestamp: new Date().toLocaleTimeString(),
        url: viewUrl
    };

    openReports.push(newReport);

    res.json({
        success: true,
        url: viewUrl,
        report: newReport
    });
});

/**
 * DELETE /api/open-report/:index - Remove a report from tracking
 */
app.delete('/api/open-report/:index', (req, res) => {
    const index = parseInt(req.params.index);
    
    if (index >= 0 && index < openReports.length) {
        const removed = openReports.splice(index, 1)[0];
        res.json({
            success: true,
            removed: removed
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'Report not found'
        });
    }
});

/**
 * DELETE /api/open-reports - Clear all tracked reports
 */
app.delete('/api/open-reports', (req, res) => {
    const count = openReports.length;
    openReports = [];
    res.json({
        success: true,
        cleared: count
    });
});

/**
 * GET /api/config - Get server configuration
 */
app.get('/api/config', (req, res) => {
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                addresses.push({
                    interface: name,
                    address: net.address
                });
            }
        }
    }
    
    res.json({
        success: true,
        config: {
            projectName: PROJECT_NAME,
            folderPrefix: FOLDER_PREFIX,
            reportsPath: REPORTS_BASE_PATH,
            port: PORT,
            localUrl: `http://localhost:${PORT}`,
            networkUrls: addresses.map(a => `http://${a.address}:${PORT}`)
        }
    });
});

/**
 * GET /api/stats?month=playwright-report-YYYY-MM - Get test statistics
 */
app.get('/api/stats', (req, res) => {
    try {
        const { month } = req.query;
        const allReports = scanReportsDirectory(REPORTS_BASE_PATH);

        const filteredReports = month
            ? allReports.filter(r => r.month === month)
            : allReports;

        const stats = filteredReports.map(report => {
            const data = getReportStats(report.path);
            if (!data) return null;

            return {
                name: report.name,
                month: report.month,
                path: report.path,
                passed: data.stats?.expected ?? 0,
                failed: data.stats?.unexpected ?? 0,
                flaky: data.stats?.flaky ?? 0,
                skipped: data.stats?.skipped ?? 0,
                total: data.stats?.total ?? 0,
                ok: data.stats?.ok ?? false,
                startTime: data.startTime,
                duration: data.duration
            };
        }).filter(Boolean);

        // Sort chronologically
        stats.sort((a, b) => {
            if (a.startTime && b.startTime) {
                return new Date(a.startTime) - new Date(b.startTime);
            }
            return a.name.localeCompare(b.name);
        });

        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    const networkInterfaces = os.networkInterfaces();
    console.log(`\n🎭 ${PROJECT_NAME}`);
    console.log('=====================================');
    console.log(`⚙️  Config file:  ${ENV_FILE}`);
    console.log(`📁 Reports path: ${REPORTS_BASE_PATH}`);
    console.log(`🏷️  Folder prefix: ${FOLDER_PREFIX}`);
    console.log(`🎨 Colours:      ${PRIMARY_COLOR} / ${PRIMARY_COLOR_DARK}`);
    console.log(`🌈 Background:   ${BG_COLOR_START} → ${BG_COLOR_END}`);
    console.log(`🖼️  Favicon:      ${FAVICON_PATH}`);
    console.log(`\n🌐 Server running on:`);
    console.log(`   Local:   http://localhost:${PORT}`);
    
    // Display all network addresses
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`   Network: http://${net.address}:${PORT}`);
            }
        }
    }
    
    console.log(`\n📊 Access from any device on your network!`);
    console.log(`⌨️  Press Ctrl+C to stop the server\n`);
});
