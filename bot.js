/**
 * S.A.S.T.R.O v2.0 Enterprise - Real Core Engine
 * Fitur Nyata:
 * 1. Live Screen Mirroring (Auto-PIN Verified)
 * 2. Remote Mouse Click & Move (Win32 user32.dll) + Keyboard SendKeys + Ping / CMD Bebas
 * 3. Multi-Grup IT Fleet & Kode Tautan (Kontrol 1 PC, PC Terpilih, 1 Grup, atau Semua PC)
 * 4. Offline Local LAN Server (Port 4545) + Online Telegram Bot + AI Chat (Gemini/Groq/GPT/Grok)
 * 5. Wake-on-LAN (Magic Packet UDP Broadcast)
 * 6. Blokir Website (Windows Hosts), Blokir Aplikasi EXE (Watchdog), Deteksi & Uninstall Software
 */
const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const screenshot = require('screenshot-desktop');
const NodeWebcam = require('node-webcam');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const dgram = require('dgram');

const memoPath = path.join(__dirname, 'memo.json');
if (!fs.existsSync(memoPath)) {
  console.error('[ERROR] memo.json belum ada! Jalankan run.bat terlebih dahulu.');
  process.exit(1);
}

function loadMemo() { return JSON.parse(fs.readFileSync(memoPath, 'utf8')); }
function saveMemo(data) { fs.writeFileSync(memoPath, JSON.stringify(data, null, 2), 'utf8'); }

let memo = loadMemo();
const PORT = memo.port || 4545;

const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir);

const Webcam = NodeWebcam.create({
  width: 1280, height: 720, quality: 95, delay: 0,
  saveShots: true, output: 'jpeg', device: false, callbackReturn: 'location', verbose: false
});

// ============================================================================
// 1. WAKE-ON-LAN (MENGIRIM MAGIC PACKET UDP KE MAC ADDRESS TARGET)
// ============================================================================
function sendWakeOnLan(macAddress) {
  return new Promise((resolve, reject) => {
    try {
      const cleanMac = String(macAddress).replace(/[^0-9a-fA-F]/g, '');
      if (cleanMac.length !== 12) return reject(new Error('Format MAC Address harus 12 karakter hex (contoh: 00:1A:2B:3C:4D:5E)'));
      const buf = Buffer.alloc(102);
      buf.fill(0xff, 0, 6);
      for (let i = 0; i < 16; i++) {
        Buffer.from(cleanMac, 'hex').copy(buf, 6 + i * 6);
      }
      const sock = dgram.createSocket('udp4');
      sock.bind(() => {
        sock.setBroadcast(true);
        sock.send(buf, 0, buf.length, 9, '255.255.255.255', (err) => {
          sock.close();
          if (err) reject(err);
          else resolve(true);
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

// ============================================================================
// 2. KONTROL MOUSE & KEYBOARD NYATA DI WINDOWS
// ============================================================================
function clickRemoteMouse(x, y, button = 'left') {
  const downFlag = button === 'right' ? '0x08' : '0x02';
  const upFlag = button === 'right' ? '0x10' : '0x04';
  const psScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)}); Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int info);' -Name 'Win32Mouse' -Namespace 'Win32'; [Win32.Win32Mouse]::mouse_event(${downFlag}, 0, 0, 0, 0); [Win32.Win32Mouse]::mouse_event(${upFlag}, 0, 0, 0, 0);`;
  exec(`powershell -NoProfile -Command "${psScript}"`);
}

function sendRemoteKeys(text, pressEnter = true) {
  const safe = String(text).replace(/"/g, '""');
  const vbsPath = path.join(__dirname, 'temp_key.vbs');
  fs.writeFileSync(vbsPath, `Set WshShell = WScript.CreateObject("WScript.Shell")\nWshShell.SendKeys "${safe}${pressEnter ? '{ENTER}' : ''}"`);
  exec(`cscript //nologo "${vbsPath}"`, () => {
    if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
  });
}

// ============================================================================
// 3. BLOKIR WEBSITE, BLOKIR EXE, DETEKSI & UNINSTALL APLIKASI NYATA
// ============================================================================
function blockWebsiteDomain(domain) {
  const clean = String(domain).replace(/^https?:\/\//, '').split('/')[0].trim().toLowerCase();
  if (!clean) return 'Nama domain kosong.';
  const hostsFile = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
  try {
    const content = fs.readFileSync(hostsFile, 'utf8');
    if (!content.includes(clean)) {
      fs.appendFileSync(hostsFile, `\n127.0.0.1 ${clean}\n127.0.0.1 www.${clean}\n`);
    }
    memo = loadMemo();
    if (!memo.blockedDomains.includes(clean)) memo.blockedDomains.push(clean);
    saveMemo(memo);
    exec('ipconfig /flushdns');
    return `Website ${clean} berhasil diblokir di PC ${memo.pcName}.`;
  } catch (e) {
    return `Gagal menulis ke file Hosts Windows (Klik kanan run.bat -> Run as Administrator): ${e.message}`;
  }
}

function blockApplicationExe(exeName) {
  let clean = String(exeName).trim();
  if (!clean) return 'Nama file exe kosong.';
  if (!clean.toLowerCase().endsWith('.exe')) clean += '.exe';
  memo = loadMemo();
  if (!memo.blockedApps.includes(clean)) memo.blockedApps.push(clean);
  saveMemo(memo);
  exec(`taskkill /IM "${clean}" /F`);
  return `Aplikasi ${clean} berhasil diblokir & dihentikan otomatis di PC ${memo.pcName}.`;
}

// Watchdog setiap 4 detik mematikan aplikasi yang ada di daftar blokir
setInterval(() => {
  if (memo.blockedApps && memo.blockedApps.length > 0) {
    memo.blockedApps.forEach(exe => {
      exec(`taskkill /IM "${exe}" /F`);
    });
  }
}, 4000);

function listInstalledApplications(callback) {
  const ps = `powershell -NoProfile -Command "Get-ItemProperty HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* -ErrorAction SilentlyContinue | Select-Object DisplayName, DisplayVersion, UninstallString | Where-Object { $_.DisplayName -ne $null } | Sort-Object DisplayName -Unique | Select-Object -First 40 | ConvertTo-Json"`;
  exec(ps, { maxBuffer: 1024 * 1024 * 2 }, (err, stdout) => {
    try {
      const parsed = JSON.parse(stdout || '[]');
      callback(Array.isArray(parsed) ? parsed : [parsed]);
    } catch (e) {
      callback([]);
    }
  });
}

function uninstallApplication(appName, callback) {
  listInstalledApplications((apps) => {
    const found = apps.find(a => a.DisplayName && a.DisplayName.toLowerCase().includes(String(appName).toLowerCase()));
    if (found && found.UninstallString) {
      exec(found.UninstallString, (err) => {
        callback(`Perintah uninstall untuk "${found.DisplayName}" telah dijalankan di PC ${memo.pcName}.`);
      });
    } else {
      exec(`wmic product where "name like '%${appName}%'" call uninstall /nointeractive`, () => {
        callback(`Perintah uninstall WMIC untuk "${appName}" telah dikirim ke PC ${memo.pcName}.`);
      });
    }
  });
}

// ============================================================================
// 4. EKSEKUSI LOKAL DI PC INI
// ============================================================================
async function executeLocalAction(action, payload = {}) {
  memo = loadMemo();
  if (action === 'CMD') {
    return new Promise((resolve) => {
      exec(payload.command, { timeout: 20000 }, (err, stdout, stderr) => {
        resolve({ pcName: memo.pcName, output: stdout || stderr || (err ? err.message : 'Perintah berhasil dijalankan.') });
      });
    });
  }
  if (action === 'MOUSE_CLICK') {
    clickRemoteMouse(payload.x, payload.y, payload.button || 'left');
    return { pcName: memo.pcName, output: `Klik mouse pada koordinat (${payload.x}, ${payload.y})` };
  }
  if (action === 'KEYBOARD') {
    sendRemoteKeys(payload.text, payload.enter !== false);
    return { pcName: memo.pcName, output: `Mengetik di layar: "${payload.text}"` };
  }
  if (action === 'BLOCK_WEB') return { pcName: memo.pcName, output: blockWebsiteDomain(payload.domain) };
  if (action === 'BLOCK_APP') return { pcName: memo.pcName, output: blockApplicationExe(payload.exe) };
  if (action === 'UNINSTALL_APP') {
    return new Promise((resolve) => {
      uninstallApplication(payload.appName, (msg) => resolve({ pcName: memo.pcName, output: msg }));
    });
  }
  if (action === 'RENAME_PC') {
    memo.pcName = payload.newName || memo.pcName;
    if (payload.newGroup) memo.groupName = payload.newGroup;
    saveMemo(memo);
    return { pcName: memo.pcName, output: `Nama PC berhasil diubah menjadi ${memo.pcName} [Grup: ${memo.groupName}]` };
  }
  if (action === 'LOCK') {
    exec('rundll32.exe user32.dll,LockWorkStation');
    return { pcName: memo.pcName, output: 'Layar PC dikunci.' };
  }
  if (action === 'SHUTDOWN') {
    exec('shutdown /s /t 10');
    return { pcName: memo.pcName, output: 'PC akan mati (Shutdown) dalam 10 detik.' };
  }
  return { pcName: memo.pcName, output: 'Perintah selesai.' };
}

// ============================================================================
// 5. FLEET DISPATCHER (1 PC, PC TERPILIH, 1 GRUP, ATAU SEMUA PC DI JARINGAN)
// ============================================================================
function forwardToClientNode(client, action, payload) {
  return new Promise((resolve) => {
    if (client.ip === memo.localIp || client.ip === '127.0.0.1') {
      return executeLocalAction(action, payload).then(resolve);
    }
    const body = JSON.stringify({ pin: memo.security.pin, action, payload });
    const req = http.request({
      hostname: client.ip,
      port: client.port || 4545,
      path: '/api/agent/exec',
      method: 'POST',
      timeout: 10000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ pcName: client.pcName, output: 'Berhasil dijalankan.' }); }
      });
    });
    req.on('error', (err) => resolve({ pcName: client.pcName, output: 'Offline / Tidak terjangkau di LAN (' + err.message + ')' }));
    req.write(body);
    req.end();
  });
}

async function dispatchFleetCommand(targetSpec = {}, action, payload) {
  memo = loadMemo();
  const allClients = memo.clients || [];
  let selected = [];

  if (targetSpec.mode === 'all') {
    selected = allClients;
  } else if (targetSpec.mode === 'group' && targetSpec.groupName) {
    selected = allClients.filter(c => c.groupName.toLowerCase() === String(targetSpec.groupName).toLowerCase());
  } else if (targetSpec.mode === 'single' && targetSpec.pcName) {
    selected = allClients.filter(c => c.pcName.toLowerCase() === String(targetSpec.pcName).toLowerCase() || c.ip === targetSpec.pcName);
  } else if (Array.isArray(targetSpec.pcList) && targetSpec.pcList.length > 0) {
    selected = allClients.filter(c => targetSpec.pcList.includes(c.pcName) || targetSpec.pcList.includes(c.ip));
  }

  if (selected.length === 0) {
    const localRes = await executeLocalAction(action, payload);
    return [localRes];
  }

  return Promise.all(selected.map(c => forwardToClientNode(c, action, payload)));
}

// ============================================================================
// 6. SERVER HTTP LOKAL & LAN (TETAP JALAN MESKIPUN INTERNET MATI)
// ============================================================================
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (urlObj.pathname === '/' || urlObj.pathname === '/dashboard')) {
    const dashFile = path.join(__dirname, 'ui', 'dashboard.html');
    if (fs.existsSync(dashFile)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(dashFile, 'utf8'));
    }
  }

  if (req.method === 'GET' && urlObj.pathname === '/api/screen') {
    const reqPin = urlObj.searchParams.get('pin');
    if (reqPin !== String(memo.security.pin)) {
      res.writeHead(403);
      return res.end('PIN Mirroring Salah');
    }
    try {
      const imgBuffer = await screenshot({ format: 'jpg' });
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' });
      return res.end(imgBuffer);
    } catch (e) {
      res.writeHead(500);
      return res.end('Gagal memotret layar: ' + e.message);
    }
  }

  if (req.method === 'GET' && urlObj.pathname === '/api/status') {
    memo = loadMemo();
    const freeRam = (os.freemem() / (1024 ** 3)).toFixed(2);
    const totalRam = (os.totalmem() / (1024 ** 3)).toFixed(2);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      pcName: memo.pcName,
      role: memo.role,
      groupName: memo.groupName,
      localIp: memo.localIp,
      macAddress: memo.macAddress,
      pairCode: `${memo.pairCode}@${memo.localIp}`,
      pin: memo.security.pin,
      ram: `${(totalRam - freeRam).toFixed(1)}/${totalRam} GB`,
      groups: memo.groups || ['Grup 1', 'Grup 2'],
      clients: memo.clients || [],
      blockedDomains: memo.blockedDomains || [],
      blockedApps: memo.blockedApps || []
    }));
  }

  if (req.method === 'GET' && urlObj.pathname === '/api/apps') {
    return listInstalledApplications((apps) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ apps }));
    });
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');

        if (urlObj.pathname === '/api/pair') {
          memo = loadMemo();
          if (data.pairCode !== memo.pairCode) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: 'Kode Tautan IT salah!' }));
          }
          const info = data.pcInfo;
          if (!memo.groups.includes(info.groupName)) memo.groups.push(info.groupName);
          const idx = memo.clients.findIndex(c => c.ip === info.ip || c.pcName === info.pcName);
          const entry = { ...info, online: true, lastSeen: Date.now() };
          if (idx >= 0) memo.clients[idx] = entry;
          else memo.clients.push(entry);
          saveMemo(memo);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            ok: true,
            masterConfig: {
              assistant: memo.assistant,
              telegram: memo.telegram,
              ai: memo.ai,
              security: memo.security,
              ownerName: memo.profile.ownerName
            }
          }));
        }

        if (urlObj.pathname === '/api/agent/exec') {
          if (String(data.pin) !== String(memo.security.pin)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'PIN Salah' }));
          }
          const result = await executeLocalAction(data.action, data.payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        }

        if (urlObj.pathname === '/api/fleet/exec') {
          if (data.action === 'WOL') {
            await sendWakeOnLan(data.payload.mac);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ results: [{ pcName: 'Wake-on-LAN', output: `Magic Packet berhasil dikirim ke MAC ${data.payload.mac}` }] }));
          }
          const results = await dispatchFleetCommand(data.target, data.action, data.payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ results }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================================================');
  console.log(`🚀 [${memo.assistant.name} v2.0] AKTIF DI PC: ${memo.pcName} (${memo.role})`);
  console.log(`🌐 Buka UI Command Center (Lokal & LAN): http://${memo.localIp}:${PORT}`);
  if (memo.role === 'IT_MASTER') {
    console.log(`🔑 Kode Tautan Tim IT kamu: ${memo.pairCode}@${memo.localIp}`);
  }
  console.log('===========================================================================');
});

// ============================================================================
// 7. BOT TELEGRAM (JIKA TOKEN TERPASANG)
// ============================================================================
if (memo.telegram && memo.telegram.botToken && memo.telegram.botToken.length > 10) {
  const bot = new TelegramBot(memo.telegram.botToken, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    memo = loadMemo();

    if (memo.telegram.adminId && msg.from.id !== memo.telegram.adminId) return;
    if (!text) return;

    if (text === '/start' || text === '/menu') {
      const daftarGrup = (memo.groups || []).join(', ');
      const totalPc = (memo.clients || []).length;
      const menuText = [
        `🤖 *${memo.assistant.name} v2.0 — FLEET & COMMAND CENTER*`,
        `🖥️ PC Aktif: *${memo.pcName}* (${memo.localIp}:${PORT})`,
        `🔑 Kode Taut IT: \`${memo.pairCode}@${memo.localIp}\``,
        `🖧 Total PC di Grup: *${totalPc} PC* (${daftarGrup})`,
        ``,
        `👥 *Perintah Grup & Multi-PC:*`,
        `• /listpc - Lihat semua PC, IP, MAC & Grup`,
        `• \`/all [perintah]\` - Jalankan perintah di SEMUA PC`,
        `• \`/grup [nama_grup] | [perintah]\` - Jalankan di 1 Grup`,
        `• \`/pc [nama_pc] | [perintah]\` - Jalankan di 1 PC`,
        `• \`/namapc [nama_baru]\` - Ubah nama PC ini`,
        ``,
        `🖱️ *Mirroring, Mouse, Keyboard & Jaringan:*`,
        `• /ss - Live Frame Layar (Auto-PIN)`,
        `• /kamera - Ambil foto Webcam PC`,
        `• /anydesk - Buka AnyDesk & foto ID-nya`,
        `• \`/klik [X] [Y]\` - Klik mouse di koordinat layar`,
        `• \`/ketik [teks]\` - Ketik keyboard + Enter di PC`,
        `• \`/ping [ip/domain]\` - Ping alamat IP/Web dari PC`,
        `• \`/wol [MAC_Address]\` - Hidupkan PC via Wake-on-LAN`,
        ``,
        `🛡️ *Blokir Web, Blokir EXE & Hapus Aplikasi:*`,
        `• \`/blokirweb [domain.com]\` - Blokir situs di Windows Hosts`,
        `• \`/blokirapp [nama.exe]\` - Blokir & matikan paksa EXE`,
        `• /aplikasi - Lihat daftar aplikasi terinstall`,
        `• \`/hapusapp [nama aplikasi]\` - Uninstall aplikasi jarak jauh`
      ].join('\n');
      return bot.sendMessage(chatId, menuText, { parse_mode: 'Markdown' });
    }

    if (text === '/listpc') {
      const list = (memo.clients || []).map((c, i) =>
        `${i + 1}. *${c.pcName}* [${c.groupName}]\n   IP: \`${c.ip}\` | MAC: \`${c.mac}\``
      ).join('\n\n') || 'Belum ada PC terdaftar.';
      return bot.sendMessage(chatId, `🖧 *DAFTAR PC TERHUBUNG:*\n\n${list}`, { parse_mode: 'Markdown' });
    }

    if (text.startsWith('/namapc ')) {
      const newName = text.replace('/namapc ', '').trim();
      const res = await executeLocalAction('RENAME_PC', { newName });
      return bot.sendMessage(chatId, '✅ ' + res.output);
    }

    if (text.startsWith('/all ')) {
      const cmd = text.replace('/all ', '').trim();
      const results = await dispatchFleetCommand({ mode: 'all' }, 'CMD', { command: cmd });
      const out = results.map(r => `🖥️ *${r.pcName}:*\n\`${String(r.output).substring(0, 500)}\``).join('\n\n');
      return bot.sendMessage(chatId, out, { parse_mode: 'Markdown' });
    }

    if (text.startsWith('/grup ')) {
      const parts = text.replace('/grup ', '').split('|');
      if (parts.length < 2) return bot.sendMessage(chatId, 'Format: `/grup Grup 1 | ipconfig`', { parse_mode: 'Markdown' });
      const results = await dispatchFleetCommand({ mode: 'group', groupName: parts[0].trim() }, 'CMD', { command: parts[1].trim() });
      const out = results.map(r => `🖥️ *${r.pcName}:*\n\`${String(r.output).substring(0, 500)}\``).join('\n\n');
      return bot.sendMessage(chatId, out, { parse_mode: 'Markdown' });
    }

    if (text.startsWith('/pc ')) {
      const parts = text.replace('/pc ', '').split('|');
      if (parts.length < 2) return bot.sendMessage(chatId, 'Format: `/pc NamaPC | ping 8.8.8.8`', { parse_mode: 'Markdown' });
      const results = await dispatchFleetCommand({ mode: 'single', pcName: parts[0].trim() }, 'CMD', { command: parts[1].trim() });
      const out = results.map(r => `🖥️ *${r.pcName}:*\n\`${String(r.output).substring(0, 800)}\``).join('\n\n');
      return bot.sendMessage(chatId, out, { parse_mode: 'Markdown' });
    }

    if (text.startsWith('/ping ')) {
      const target = text.replace('/ping ', '').trim();
      const res = await executeLocalAction('CMD', { command: `ping ${target} -n 3` });
      return bot.sendMessage(chatId, `📡 *Ping (${memo.pcName}):*\n\`\`\`\n${res.output}\n\`\`\``, { parse_mode: 'Markdown' });
    }

    if (text.startsWith('/klik ')) {
      const parts = text.split(' ');
      clickRemoteMouse(Number(parts[1]) || 500, Number(parts[2]) || 500, 'left');
      return bot.sendMessage(chatId, `🖱️ Klik kiri dieksekusi di koordinat (${parts[1]}, ${parts[2]})!`);
    }

    if (text.startsWith('/ketik ')) {
      const isi = text.replace('/ketik ', '');
      sendRemoteKeys(isi, true);
      return bot.sendMessage(chatId, `⌨️ Berhasil mengetik di PC: "${isi}"`);
    }

    if (text.startsWith('/wol ')) {
      const mac = text.replace('/wol ', '').trim();
      try {
        await sendWakeOnLan(mac);
        return bot.sendMessage(chatId, `⚡ Magic Packet Wake-on-LAN dikirim ke MAC: \`${mac}\``, { parse_mode: 'Markdown' });
      } catch (e) {
        return bot.sendMessage(chatId, '❌ Error WoL: ' + e.message);
      }
    }

    if (text.startsWith('/blokirweb ')) {
      return bot.sendMessage(chatId, '🚫 ' + blockWebsiteDomain(text.replace('/blokirweb ', '')));
    }

    if (text.startsWith('/blokirapp ')) {
      return bot.sendMessage(chatId, '🚫 ' + blockApplicationExe(text.replace('/blokirapp ', '')));
    }

    if (text === '/aplikasi') {
      bot.sendMessage(chatId, '🔍 Mendeteksi daftar aplikasi terinstall di PC...');
      return listInstalledApplications((apps) => {
        const list = apps.slice(0, 25).map((a, i) => `${i + 1}. ${a.DisplayName}`).join('\n') || 'Tidak ada data.';
        bot.sendMessage(chatId, `📦 *Aplikasi Terdeteksi di ${memo.pcName}:*\n\n${list}\n\nKetik \`/hapusapp [nama]\` untuk uninstall.`, { parse_mode: 'Markdown' });
      });
    }

    if (text.startsWith('/hapusapp ')) {
      const appName = text.replace('/hapusapp ', '').trim();
      bot.sendMessage(chatId, `⏳ Menjalankan uninstaller untuk *${appName}*...`, { parse_mode: 'Markdown' });
      return uninstallApplication(appName, (resMsg) => bot.sendMessage(chatId, '🗑️ ' + resMsg));
    }

    if (text === '/anydesk') {
      bot.sendMessage(chatId, '🚀 Membuka AnyDesk dan memotret ID...');
      exec('start anydesk');
      setTimeout(async () => {
        try {
          const img = await screenshot({ format: 'jpg' });
          await bot.sendPhoto(chatId, img, { caption: '🖥️ AnyDesk aktif di layar PC!' });
        } catch (e) {}
      }, 4500);
      return;
    }

    if (text === '/kamera') {
      const camPath = path.join(__dirname, 'webcam.jpg');
      return Webcam.capture(camPath, async (err) => {
        if (err) return bot.sendMessage(chatId, '❌ Kamera tidak ditemukan: ' + err.message);
        await bot.sendPhoto(chatId, camPath, { caption: `📷 Foto Webcam [${memo.pcName}]` });
        if (fs.existsSync(camPath)) fs.unlinkSync(camPath);
      });
    }

    if (text === '/ss') {
      const img = await screenshot({ format: 'jpg' });
      return bot.sendPhoto(chatId, img, { caption: `🖥️ Live Mirror [${memo.pcName}]` });
    }
  });
}