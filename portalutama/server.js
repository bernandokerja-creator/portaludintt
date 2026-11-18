const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= LOAD TIKTOK-LIVE-CONNECTOR (ESM) =================
let TikTokLiveConnection = null;
let WebcastEvent = null;

async function initTikTokLibrary() {
    if (!TikTokLiveConnection || !WebcastEvent) {
        const mod = await import('tiktok-live-connector');
        TikTokLiveConnection = mod.TikTokLiveConnection || mod.default?.TikTokLiveConnection;
        WebcastEvent = mod.WebcastEvent || mod.default?.WebcastEvent || {
            GIFT: 'gift',
            CHAT: 'chat'
        };
    }
}

// ================= NAMESPACE TERPISAH =================
const portalIO = io.of('/portal');
const pouIO = io.of('/pou');
const capitIO = io.of('/capit');

// ================= STATE PORTAL & TIKTOK LIVE =================
let activeGame = 'pou'; // Pilihan: 'pou' atau 'capit'
let tiktokConnection = null;
let tiktokStatus = { connected: false, username: '' };

function broadcastPortalState() {
    portalIO.emit('portal_state', { activeGame, tiktokStatus });
    capitIO.emit('tiktok_status', tiktokStatus);
}

// ================= HELPER USER TIKTOK =================
function normalizeId(id) {
    return String(id || '').replace(/^@/, '').trim().toLowerCase();
}

function extractUserInfo(data) {
    const u = data.user || data.common?.user || data;
    let rawId = data.userId ?? u.userId ?? u.id ?? '';
    if (typeof rawId === 'object' && rawId !== null) rawId = rawId.toString();

    const uniqueId = normalizeId(data.uniqueId ?? u.uniqueId ?? u.displayId ?? '');
    const secUid = String(data.secUid ?? u.secUid ?? '').trim();
    const nickname = String(data.nickname ?? u.nickname ?? uniqueId ?? '').trim();
    const profilePictureUrl =
        data.profilePictureUrl ?? u.profilePictureUrl ?? u.avatarThumb?.urlList?.[0] ?? '';

    return { userId: String(rawId).trim(), secUid, uniqueId, nickname, profilePictureUrl };
}

// ================= KONEKSI PUSAT TIKTOK LIVE =================
async function connectTikTok(username) {
    const cleanUser = normalizeId(username);
    if (!cleanUser) return;

    await initTikTokLibrary();

    if (tiktokConnection) {
        try { tiktokConnection.disconnect(); } catch (e) {}
    }

    tiktokConnection = new TikTokLiveConnection(cleanUser, { processInitialData: false });

    tiktokConnection.connect().then(state => {
        console.log(`[TIKTOK] Terhubung ke @${cleanUser} (Room: ${state.roomId})`);
        tiktokStatus = { connected: true, username: cleanUser };
        broadcastPortalState();
    }).catch(err => {
        console.error('[TIKTOK] Gagal terhubung:', err.message || err);
        tiktokStatus = { connected: false, username: cleanUser, error: err.message || 'Gagal terhubung' };
        broadcastPortalState();
    });

    // EVENT GIFT -> DIARAHKAN KE GAME YANG SEDANG AKTIF
    tiktokConnection.on(WebcastEvent.GIFT, data => {
        const giftType = data.giftType ?? data.gift?.type ?? data.giftDetails?.giftType;
        if (giftType === 1 && !data.repeatEnd) return;

        const diamondCount = data.diamondCount ?? data.gift?.diamond_count ?? data.giftDetails?.diamondCount ?? 1;
        const repeatCount = data.repeatCount || 1;
        const totalCoins = diamondCount * repeatCount;
        const giftName = data.giftName ?? data.gift?.name ?? data.giftDetails?.giftName ?? '';
        const userInfo = extractUserInfo(data);

        if (activeGame === 'pou') {
            handlePouGift(userInfo.uniqueId, userInfo.nickname, totalCoins, giftName);
        } else if (activeGame === 'capit') {
            enqueueCapitPlayer({ ...userInfo, coins: totalCoins });
        }
    });

    // EVENT CHAT -> DIARAHKAN KE GAME YANG SEDANG AKTIF
    tiktokConnection.on(WebcastEvent.CHAT, data => {
        const comment = String(data.comment ?? data.content ?? data.text ?? '').trim();
        const chatUser = extractUserInfo(data);

        if (activeGame === 'pou') {
            handlePouChat(chatUser.uniqueId, chatUser.nickname, comment);
        } else if (activeGame === 'capit') {
            handleCapitChat(chatUser, comment);
        }
    });
}

// =========================================================================
// BAGIAN A: LOGIKA GAME POU
// =========================================================================
const POU_FILE = path.join(__dirname, 'players.json');
let playersData = {};

if (fs.existsSync(POU_FILE)) {
    try { playersData = JSON.parse(fs.readFileSync(POU_FILE, 'utf8')); } catch (e) { playersData = {}; }
}

function getRandomNeedDuration() { return Math.floor(Math.random() * (180 - 150 + 1)) + 150; }
function getBossMaxHp(floor) { return Math.floor(100 + Math.pow(floor, 1.62) * 14); }
function savePlayerData() { fs.writeFileSync(POU_FILE, JSON.stringify(playersData, null, 2), 'utf8'); }

Object.keys(playersData).forEach(id => {
    const p = playersData[id];
    if (typeof p.hunger !== 'number') p.hunger = 100;
    if (typeof p.thirst !== 'number') p.thirst = 100;
    if (typeof p.clean !== 'number') p.clean = 100;
    if (!p.hungerDuration) p.hungerDuration = getRandomNeedDuration();
    if (!p.thirstDuration) p.thirstDuration = getRandomNeedDuration();
    if (!p.cleanDuration) p.cleanDuration = getRandomNeedDuration();
});

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const idleTimers = {};

function resetIdleTimer(id) {
    const player = playersData[id];
    if (!player) return;
    player.isHidden = false;
    clearTimeout(idleTimers[id]);
    idleTimers[id] = setTimeout(() => {
        if (playersData[id]) {
            if (playersData[id].inDungeon) { resetIdleTimer(id); return; }
            playersData[id].isHidden = true;
            savePlayerData();
            pouIO.emit('pou_hidden', { id });
        }
    }, IDLE_TIMEOUT_MS);
}

setInterval(() => {
    let updatedList = [];
    Object.keys(playersData).forEach(id => {
        const p = playersData[id];
        if (p.isHidden) return;
        const prevH = Math.round(p.hunger), prevT = Math.round(p.thirst), prevC = Math.round(p.clean);
        p.hunger = Math.max(0, p.hunger - (100 / (p.hungerDuration || 165)) * 2);
        p.thirst = Math.max(0, p.thirst - (100 / (p.thirstDuration || 165)) * 2);
        p.clean  = Math.max(0, p.clean  - (100 / (p.cleanDuration  || 165)) * 2);
        if (Math.round(p.hunger) !== prevH || Math.round(p.thirst) !== prevT || Math.round(p.clean) !== prevC) {
            updatedList.push({ id: p.id, hunger: Math.round(p.hunger), thirst: Math.round(p.thirst), clean: Math.round(p.clean) });
        }
    });
    if (updatedList.length > 0) pouIO.emit('needs_tick', updatedList);
}, 2000);

const weaponData = {
    sandal: { name: "Sandal Swallow 🩴 (1.5x)", mult: 1.5 },
    pisau: { name: "Pisau Dapur 🔪 (2.0x)", mult: 2.0 },
    palu: { name: "Palu Besi 🔨 (2.8x)", mult: 2.8 },
    ketapel: { name: "Ketapel Raksasa 🏹 (3.5x)", mult: 3.5 },
    shuriken: { name: "Shuriken Ninja 🥷 (4.5x)", mult: 4.5 },
    katana: { name: "Katana Samurai ⚔️ (6.0x)", mult: 6.0 },
    bazooka: { name: "Bazooka Peledak 🚀 (7.5x)", mult: 7.5 },
    staff: { name: "Tongkat Staff Sihir 🪄 (9.5x)", mult: 9.5 },
    laser: { name: "Laser Sci-Fi 💥 (13.0x)", mult: 13.0 },
    thanos: { name: "Sarung Tangan Thanos 🤌 (18.0x)", mult: 18.0 },
    thor: { name: "Palu Petir Thor ⚡ (24.0x)", mult: 24.0 },
    naga: { name: "Naga Api Dewa 🐉 (35.0x)", mult: 35.0 }
};

const fashionData = {
    "1-20": [
        { id: "tuxedo-hitam", name: "Setelan Tuxedo & Topi Fedora 🎩" },
        { id: "baju-merah-pink", name: "Gaun Merah & Kacamata Pink 👗" },
        { id: "topi-koki", name: "Seragam Koki Kerajaan 👨‍🍳" },
        { id: "baju-pelaut", name: "Seragam Pelaut & Topi Kelasi ⚓" },
        { id: "kostum-lebah", name: "Kostum Lebah Madu 🐝" }
    ],
    "21-40": [
        { id: "kostum-panda", name: "Kostum Panda Klasik 🐼" },
        { id: "helm-zirah", name: "Zirah Ksatria Baja 🪖" },
        { id: "jubah-sihir", name: "Jubah Penyihir Bintang 🧙‍♂️" },
        { id: "kostum-ninja", name: "Kostum Ninja Bayangan 🥷" },
        { id: "baju-bajak-laut", name: "Jaket Kapten Bajak Laut 🏴‍☠️" }
    ],
    "41-60": [
        { id: "mahkota-emas", name: "Mahkota Emas Raja 👑" },
        { id: "tuxedo-sultan", name: "Tuxedo Emas Sultan 🧥" },
        { id: "jubah-merah-raja", name: "Jubah Merah Kaisar 💃" },
        { id: "baju-pharaoh", name: "Setelan Pharaoh Mesir 🏺" },
        { id: "jas-berlian", name: "Jas Berlian Biru 💎" }
    ],
    "61-80": [
        { id: "sayap-malaikat", name: "Sayap Emas Malaikat 🪽" },
        { id: "kostum-anubis", name: "Topeng & Jubah Anubis 𓀀" },
        { id: "kostum-naga-api", name: "Kostum Naga Api 🐉" },
        { id: "zirah-samurai", name: "Zirah Samurai Shogun 👹" },
        { id: "jubah-vampir", name: "Jubah Vampir Drakula 🧛" }
    ],
    "81-100": [
        { id: "halo-surgawi", name: "Halo Surgawi 😇" },
        { id: "aura-listrik-thor", name: "Aura Petir Dewa Thor ⚡" },
        { id: "jubah-kosmik", name: "Jubah Kosmik Galaxy 🌌" },
        { id: "cyber-mecha", name: "Zirah Cyber Mecha 🤖" },
        { id: "dewa-matahari", name: "Jubah Dewa Matahari ☀️" }
    ]
};

function handlePouJoin(id, nickname) {
    if (!playersData[id]) {
        playersData[id] = {
            id, name: nickname, level: 1, xp: 0, hp: 100, maxHp: 100,
            hunger: 100, thirst: 100, clean: 100,
            hungerDuration: getRandomNeedDuration(), thirstDuration: getRandomNeedDuration(), cleanDuration: getRandomNeedDuration(),
            outfit: "standar", weapon: "none", towerFloor: 1,
            bossHp: getBossMaxHp(1), bossMaxHp: getBossMaxHp(1),
            inDungeon: false, isHidden: false
        };
        resetIdleTimer(id);
        savePlayerData();
        pouIO.emit('player_updated', { player: playersData[id], action: 'join', coins: 0, rewardText: '' });
    } else {
        playersData[id].name = nickname;
        resetIdleTimer(id);
        savePlayerData();
        pouIO.emit('user_show', { id, nickname, player: playersData[id] });
    }
}

function handlePouChat(id, nickname, rawComment) {
    const comment = rawComment.toLowerCase().trim();
    if (comment === 'ee' || comment === 'eek') return handlePouJoin(id, nickname);
    if ((comment === 'shw' || comment === 'show') && playersData[id]) {
        resetIdleTimer(id); savePlayerData();
        pouIO.emit('user_show', { id, nickname, player: playersData[id] });
    }
    if (comment === 'dgn' && playersData[id]) {
        resetIdleTimer(id); startAutoDungeon(id);
    }
    if (comment === 'costume' || comment === 'baju') {
        pouIO.emit('show_costume_catalog');
    }
}

function handlePouGift(id, nickname, coins, giftName = "") {
    const gName = giftName.toLowerCase();
    if (!playersData[id]) {
        if (gName.includes('heart') || gName.includes('love') || gName.includes('join')) {
            handlePouJoin(id, nickname);
        }
        return;
    }
    const player = playersData[id];
    resetIdleTimer(id);
    let actionType = 'join', rewardText = "";
    const fillAmount = Math.ceil((100 / 3) * Math.max(1, coins));

    if (gName.includes('rose') || gName.includes('mawar')) {
        actionType = 'feed';
        player.hunger = Math.min(100, Math.round((player.hunger || 0) + fillAmount));
        player.hungerDuration = getRandomNeedDuration();
        player.hp = Math.min(player.maxHp, player.hp + (25 * Math.max(1, coins)));
    } else if (gName.includes('kopi') || gName.includes('coffee')) {
        actionType = 'drink';
        player.thirst = Math.min(100, Math.round((player.thirst || 0) + fillAmount));
        player.thirstDuration = getRandomNeedDuration();
        player.hp = Math.min(player.maxHp, player.hp + (20 * Math.max(1, coins)));
    } else if (gName.includes('tiktok')) {
        actionType = 'clean';
        player.clean = Math.min(100, Math.round((player.clean || 0) + fillAmount));
        player.cleanDuration = getRandomNeedDuration();
    } else if (gName.includes('parfum') || gName.includes('perfume') || coins === 20) {
        actionType = 'gacha';
        let tier = player.level > 80 ? "81-100" : player.level > 60 ? "61-80" : player.level > 40 ? "41-60" : player.level > 20 ? "21-40" : "1-20";
        const sel = fashionData[tier][Math.floor(Math.random() * fashionData[tier].length)];
        player.outfit = sel.id;
        rewardText = `Parfume Gacha Baju [Lv.${tier}]: ${sel.name}`;
    } else if (coins >= 5) {
        actionType = 'gacha';
        const list = coins >= 500 ? ["thanos", "thor", "naga"] : coins >= 100 ? ["bazooka", "staff", "laser"] : coins >= 10 ? ["ketapel", "shuriken", "katana"] : ["sandal", "pisau", "palu"];
        player.weapon = list[Math.floor(Math.random() * list.length)];
        rewardText = `Senjata (${coins}c): ${weaponData[player.weapon].name}`;
    }

    savePlayerData();
    pouIO.emit('player_updated', { player, action: actionType, coins, rewardText });
}

function startAutoDungeon(id) {
    const player = playersData[id];
    if (!player || player.inDungeon) return;
    resetIdleTimer(id);
    const maxB = getBossMaxHp(player.towerFloor);
    player.hp = player.maxHp; player.bossMaxHp = maxB; player.bossHp = maxB; player.inDungeon = true;
    pouIO.emit('dungeon_status', { id, status: 'started', player });

    const dungeonInterval = setInterval(() => {
        if (!playersData[id] || !player.inDungeon) { clearInterval(dungeonInterval); return; }
        const wInfo = weaponData[player.weapon] || { mult: 1 };
        const playerDmg = Math.floor((15 + (player.level * 12)) * wInfo.mult);
        const bossDmg = Math.floor(10 + (player.towerFloor * 4.2));
        player.bossHp = Math.max(0, player.bossHp - playerDmg);
        player.hp = Math.max(0, player.hp - bossDmg);

        let floorCleared = false, playerDied = false, leveledUp = false;
        if (player.bossHp <= 0) {
            floorCleared = true;
            player.xp += 45 + (player.towerFloor * 15);
            while (player.xp >= player.level * 50) {
                player.xp -= player.level * 50;
                player.level += 1; player.maxHp += 35; player.hp = player.maxHp; leveledUp = true;
            }
            if (player.towerFloor >= 100) {
                player.inDungeon = false; player.hp = player.maxHp; player.bossHp = getBossMaxHp(100);
                resetIdleTimer(id); clearInterval(dungeonInterval);
            } else {
                player.towerFloor += 1;
                player.bossMaxHp = getBossMaxHp(player.towerFloor);
                player.bossHp = player.bossMaxHp;
            }
        } else if (player.hp <= 0) {
            player.inDungeon = false; player.hp = player.maxHp;
            player.bossMaxHp = getBossMaxHp(player.towerFloor); player.bossHp = player.bossMaxHp;
            playerDied = true; resetIdleTimer(id); clearInterval(dungeonInterval);
        }
        savePlayerData();
        pouIO.emit('tower_tick', { player, playerDmg, bossDmg, floorCleared, playerDied, leveledUp });
    }, 1250);
}

pouIO.on('connection', (socket) => {
    socket.emit('init_game', { players: playersData });
    socket.on('test_gift', (data) => handlePouGift(data.id, data.nickname, data.coins, data.giftName));
    socket.on('test_cmd', (data) => {
        if ((data.cmd === 'ee' || data.cmd === 'eek') && data.id) handlePouJoin(data.id, data.nickname || data.id);
        else if (data.cmd === 'shw' && playersData[data.id]) { resetIdleTimer(data.id); savePlayerData(); pouIO.emit('user_show', { id: data.id, nickname: playersData[data.id].name, player: playersData[data.id] }); }
        else if (data.cmd === 'dgn' && playersData[data.id]) startAutoDungeon(data.id);
        else if (data.cmd === 'throne' && playersData[data.id]) { resetIdleTimer(data.id); savePlayerData(); pouIO.emit('set_throne', { id: data.id, player: playersData[data.id] }); }
        else if (data.cmd === 'levelup1' && playersData[data.id]) { resetIdleTimer(data.id); playersData[data.id].level += 1; playersData[data.id].maxHp += 35; playersData[data.id].hp = playersData[data.id].maxHp; savePlayerData(); pouIO.emit('player_updated', { player: playersData[data.id], action: 'join', coins: 0, rewardText: '' }); }
        else if (data.cmd === 'levelup10' && playersData[data.id]) { resetIdleTimer(data.id); playersData[data.id].level += 10; playersData[data.id].maxHp += 350; playersData[data.id].hp = playersData[data.id].maxHp; savePlayerData(); pouIO.emit('player_updated', { player: playersData[data.id], action: 'join', coins: 0, rewardText: '' }); }
        else if (data.cmd === 'delete_player' && playersData[data.id]) { clearTimeout(idleTimers[data.id]); delete idleTimers[data.id]; delete playersData[data.id]; savePlayerData(); pouIO.emit('player_deleted', { id: data.id }); }
        else if (data.cmd === 'clear_all') { Object.keys(idleTimers).forEach(k => clearTimeout(idleTimers[k])); playersData = {}; savePlayerData(); pouIO.emit('all_players_cleared'); }
    });
});

// =========================================================================
// BAGIAN B: LOGIKA GAME GACHA CAPIT
// =========================================================================
const CAPIT_FILE = path.join(__dirname, 'challenges.json');
const PICK_TIMEOUT_MS = 20000;
let gameConfig = { activeTheme: 'candy', tiers: [] };

if (fs.existsSync(CAPIT_FILE)) {
    try { gameConfig = JSON.parse(fs.readFileSync(CAPIT_FILE, 'utf8')); } catch (e) {}
}
function saveCapitConfig() { fs.writeFileSync(CAPIT_FILE, JSON.stringify(gameConfig, null, 2)); }

function parseBoxChoice(text) {
    const stripped = String(text || '').trim().toLowerCase().replace(/^(#|no\.?|nomor|peti|kotak|pilih)\s*/i, '');
    const match = stripped.match(/^0*(10|[1-9])(?:\D|$)/);
    return match ? parseInt(match[1], 10) : null;
}

let queue = [];
let currentTurn = null;
let turnTimer = null;

function determineTier(coins) {
    const sorted = [...gameConfig.tiers].sort((a, b) => b.minCoins - a.minCoins);
    for (const t of sorted) { if (coins >= t.minCoins) return t; }
    return sorted[sorted.length - 1];
}

function enqueueCapitPlayer(user) {
    const tierObj = determineTier(user.coins);
    let pool = [...tierObj.challenges];
    while (pool.length < 10) pool = pool.concat(tierObj.challenges);
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 10);

    queue.push({
        userId: String(user.userId || ''),
        secUid: String(user.secUid || ''),
        uniqueId: normalizeId(user.uniqueId),
        nickname: user.nickname,
        profilePictureUrl: user.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nickname)}`,
        coins: user.coins,
        tier: tierObj,
        boxes: shuffled,
        isRevealing: false
    });
    capitIO.emit('queue_update', { queueLength: queue.length, currentTurn });
    processNextCapitTurn();
}

function processNextCapitTurn() {
    if (currentTurn || queue.length === 0) return;
    currentTurn = queue.shift();
    capitIO.emit('start_turn', { player: currentTurn, queueLength: queue.length, timeoutSec: PICK_TIMEOUT_MS / 1000 });
    turnTimer = setTimeout(() => {
        if (currentTurn && !currentTurn.isRevealing) executeCapitBoxOpen(Math.floor(Math.random() * 10) + 1, true);
    }, PICK_TIMEOUT_MS);
}

function executeCapitBoxOpen(boxNumber, isAuto = false) {
    if (!currentTurn || currentTurn.isRevealing) return;
    currentTurn.isRevealing = true;
    clearTimeout(turnTimer);
    capitIO.emit('reveal_box', { boxNumber, challengeText: currentTurn.boxes[boxNumber - 1], player: currentTurn, isAuto });
    setTimeout(() => {
        currentTurn = null;
        capitIO.emit('turn_ended', { queueLength: queue.length });
        processNextCapitTurn();
    }, 9000);
}

function handleCapitChat(chatUser, comment) {
    if (!currentTurn || currentTurn.isRevealing) return;
    const isSame =
        (currentTurn.userId && chatUser.userId && currentTurn.userId === chatUser.userId) ||
        (currentTurn.uniqueId && chatUser.uniqueId && currentTurn.uniqueId === chatUser.uniqueId) ||
        (currentTurn.nickname && chatUser.nickname && currentTurn.nickname.toLowerCase() === chatUser.nickname.toLowerCase());
    if (!isSame) return;

    const boxNum = parseBoxChoice(comment);
    if (boxNum !== null) executeCapitBoxOpen(boxNum, false);
}

// API ROUTES UNTUK PORTAL & CAPIT
app.get('/api/config', (req, res) => res.json(gameConfig));
app.post('/api/config', (req, res) => { gameConfig = req.body; saveCapitConfig(); capitIO.emit('config_updated', gameConfig); res.json({ success: true }); });
app.post('/api/theme', (req, res) => { gameConfig.activeTheme = req.body.theme; saveCapitConfig(); capitIO.emit('theme_changed', req.body.theme); res.json({ success: true }); });
app.post('/api/connect-tiktok', (req, res) => { connectTikTok(req.body.username); res.json({ success: true }); });
app.post('/api/set-active-game', (req, res) => {
    if (req.body.game === 'pou' || req.body.game === 'capit') {
        activeGame = req.body.game;
        broadcastPortalState();
    }
    res.json({ success: true, activeGame });
});
app.post('/api/simulate-gift', (req, res) => {
    enqueueCapitPlayer({ userId: 'sim_' + Date.now(), secUid: '', uniqueId: req.body.nickname.toLowerCase(), nickname: req.body.nickname || 'Sultan_Test', profilePictureUrl: '', coins: parseInt(req.body.coins, 10) || 1 });
    res.json({ success: true });
});
app.post('/api/simulate-pick', (req, res) => {
    const num = parseBoxChoice(String(req.body.boxNumber));
    if (num) executeCapitBoxOpen(num, false);
    res.json({ success: true });
});
app.post('/api/skip-turn', (req, res) => {
    clearTimeout(turnTimer); currentTurn = null; capitIO.emit('turn_ended', { queueLength: queue.length }); processNextCapitTurn(); res.json({ success: true });
});

portalIO.on('connection', (socket) => socket.emit('portal_state', { activeGame, tiktokStatus }));
capitIO.on('connection', (socket) => {
    socket.emit('init_state', { config: gameConfig, currentTurn, queueLength: queue.length });
    socket.emit('tiktok_status', tiktokStatus);
});

const PORT = 3000;
initTikTokLibrary().then(() => {
    server.listen(PORT, () => {
        console.log(`==================================================`);
        console.log(`🚀 PORTAL UTAMA : http://localhost:${PORT}`);
        console.log(`==================================================`);
    });
});