/**
 * S.A.S.T.R.O v2.0 - Wizard Setup & Tes Pesan Langsung
 * Mendukung 3 Peran:
 * [1] Mandiri (1 PC)
 * [2] Technical IT Master (Pegang Banyak PC & Buat Kode Tautan)
 * [3] Client Grup (Cukup Masukkan Kode Tautan IT, Otomatis Sinkron API/Tele/PIN)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const http = require('http');
const https = require('https');

const memoPath = path.join(__dirname, 'memo.json');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, def = '') => new Promise(r => rl.question(def ? `${q} [Default: ${def}]: ` : `${q}: `, a => r(a.trim() || def)));

function getLocalIPAndMac() {
  const nets = os.networkInterfaces();
  let ip = '127.0.0.1';
  let mac = '00:00:00:00:00:00';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ip = net.address;
        mac = net.mac || mac;
        break;
      }
    }
  }
  return { ip, mac };
}

function sendTelegramTest(token, chatId, botName, pcName, localIp) {
  return new Promise((resolve) => {
    if (!token || !chatId || Number(chatId) === 0) return resolve(false);
    const msg = JSON.stringify({
      chat_id: Number(chatId),
      text: `✅ *TES KONEKSI ${botName} v2.0 BERHASIL!*\n\n🖥️ Nama PC: *${pcName}*\n🌐 URL Kontrol LAN: \`http://${localIp}:4545\`\n\nKetik /menu untuk melihat semua daftar perintah.`,
      parse_mode: 'Markdown'
    });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(msg) }
    }, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.write(msg);
    req.end();
  });
}

function pairWithITMaster(masterIp, pairCode, pcInfo) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ pairCode, pcInfo });
    const req = http.request({
      hostname: masterIp,
      port: 4545,
      path: '/api/pair',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.ok) resolve(parsed.masterConfig);
          else reject(new Error(parsed.error || 'Kode Tautan ditolak'));
        } catch (e) {
          reject(new Error('Respons server IT tidak valid'));
        }
      });
    });
    req.on('error', (e) => reject(new Error('Gagal menghubungi IP IT Master (' + masterIp + ':4545): ' + e.message)));
    req.write(data);
    req.end();
  });
}

async function runSetup() {
  const netInfo = getLocalIPAndMac();
  console.log('===========================================================================');
  console.log('  WIZARD PENGATURAN S.A.S.T.R.O v2.0 (MANDIRI / TIM GRUP IT)');
  console.log('  IP Lokal PC Ini: ' + netInfo.ip + ' | MAC Address (WoL): ' + netInfo.mac);
  console.log('===========================================================================\n');

  const pcName = await ask('1. Beri Nama PC ini (Memudahkan identifikasi)', os.hostname());

  console.log('\n---------------------------------------------------------------------------');
  console.log('  PILIH PERAN PC INI:');
  console.log('  [1] Pemakaian Mandiri (1 PC)');
  console.log('  [2] Technical IT / Master Server (Pegang Banyak PC, Buat Grup & Kode Taut)');
  console.log('  [3] Gabung ke Grup IT (Cukup Masukkan Kode Tautan dari IT)');
  console.log('---------------------------------------------------------------------------');
  const roleChoice = await ask('2. Pilih Peran (1 / 2 / 3)', '1');

  if (roleChoice === '3') {
    console.log('\n--- GABUNG KE GRUP TECHNICAL IT ---');
    console.log('Contoh Kode Tautan: SASTRO-8899@192.168.1.10');
    const fullCode = await ask('Masukkan Kode Tautan dari IT');
    const parts = fullCode.split('@');
    const codePart = parts[0].trim();
    const ipPart = parts[1] ? parts[1].trim() : await ask('Masukkan IP Lokal PC IT Master', '192.168.1.10');
    const groupName = await ask('Masukkan ke Grup mana? (Contoh: Grup 1 / Grup 2)', 'Grup 1');

    console.log('\n[SINKRONISASI] Menghubungi PC Technical IT di ' + ipPart + ':4545...');
    try {
      const inherited = await pairWithITMaster(ipPart, codePart, {
        pcName,
        groupName,
        ip: netInfo.ip,
        mac: netInfo.mac,
        port: 4545
      });

      const clientMemo = {
        role: 'CLIENT',
        pcName,
        groupName,
        localIp: netInfo.ip,
        macAddress: netInfo.mac,
        port: 4545,
        masterIp: ipPart,
        pairCode: codePart,
        assistant: inherited.assistant,
        telegram: inherited.telegram,
        ai: inherited.ai,
        security: inherited.security,
        profile: { ownerName: inherited.ownerName || 'IT Admin', facts: [] },
        groups: [groupName],
        clients: [],
        blockedDomains: [],
        blockedApps: [],
        notes: [],
        schedules: []
      };

      fs.writeFileSync(memoPath, JSON.stringify(clientMemo, null, 2), 'utf8');
      console.log('[BERHASIL] PC "' + pcName + '" otomatis masuk ke "' + groupName + '" di server IT!');
      rl.close();
      return;
    } catch (err) {
      console.log('[PERINGATAN] Gagal terhubung ke IT Master saat ini: ' + err.message);
      console.log('Pastikan PC IT Master sedang menjalankan bot.js dan berada di jaringan LAN yang sama.');
      rl.close();
      return;
    }
  }

  const isITMaster = roleChoice === '2';
  const botName = await ask('3. Nama Sistem Asisten', 'S.A.S.T.R.O');
  const ownerName = await ask('4. Nama Panggilanmu', 'Bos');

  let pairCode = 'SASTRO-' + Math.floor(1000 + Math.random() * 9000);
  if (isITMaster) {
    pairCode = await ask('5. Buat Kode Tautan IT (Untuk diberikan ke PC anggota)', pairCode);
    console.log('\n   >>> KODE TAUTAN TIM IT KAMU: ' + pairCode + '@' + netInfo.ip + ' <<<\n');
  }

  console.log('Pilih Otak AI: [1] Gemini  [2] Groq  [3] OpenAI GPT  [4] xAI Grok');
  const aiChoice = await ask('Pilih nomor AI (1-4)', '1');
  const providerMap = { '1': 'gemini', '2': 'groq', '3': 'openai', '4': 'grok' };
  const selectedProvider = providerMap[aiChoice] || 'gemini';
  const apiKey = await ask('Masukkan API Key ' + selectedProvider.toUpperCase() + ' (Atau tekan Enter jika hanya pakai mode LAN)', 'OFFLINE_LAN');

  const botToken = await ask('Masukkan Token Bot Telegram (@BotFather) [Kosongkan jika hanya LAN]', '');
  const adminId = await ask('Masukkan Angka User ID Telegram (@userinfobot)', '0');
  const pin = await ask('Buat PIN Keamanan (Auto-PIN Mirroring & Perintah Sensitif)', '1234');

  const memoData = {
    role: isITMaster ? 'IT_MASTER' : 'STANDALONE',
    pcName,
    groupName: 'Master Server',
    localIp: netInfo.ip,
    macAddress: netInfo.mac,
    port: 4545,
    pairCode,
    assistant: { name: botName, acronym: 'System Automated Signal & Tech Remote Operator' },
    telegram: { botToken, adminId: Number(adminId) },
    ai: { provider: selectedProvider, apiKey },
    security: { pin, autoPinMirror: true, sessionMinutes: 30 },
    profile: { ownerName, facts: [] },
    groups: ['Grup 1', 'Grup 2'],
    clients: [
      {
        pcName,
        groupName: 'Master Server',
        ip: netInfo.ip,
        mac: netInfo.mac,
        port: 4545,
        online: true,
        lastSeen: Date.now()
      }
    ],
    blockedDomains: [],
    blockedApps: [],
    notes: [],
    schedules: []
  };

  fs.writeFileSync(memoPath, JSON.stringify(memoData, null, 2), 'utf8');
  console.log('\n[MENYIMPAN] File memo.json berhasil dibuat!');

  if (botToken && Number(adminId) > 0) {
    console.log('[TES PESAN] Mengirim pesan tes ke Telegram kamu...');
    const ok = await sendTelegramTest(botToken, adminId, botName, pcName, netInfo.ip);
    console.log(ok ? '[SUKSES] Pesan tes terkirim ke Telegram!' : '[INFO] Gagal kirim pesan tes, pastikan kamu sudah klik START di bot Telegrammu.');
  }

  console.log('[SELESAI] Buka http://' + netInfo.ip + ':4545 untuk mengakses UI Command Center!');
  rl.close();
}

runSetup();