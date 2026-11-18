const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
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

// ================= EVENT BUS PENGGANTI SOCKET.IO =================
let eventSeq = 0;
let eventLog = [];

function emitEvent(namespace, event, payload) {
    eventSeq++;
    eventLog.push({ seq: eventSeq, namespace, event, payload, ts: Date.now() });
    if (eventLog.length > 100) eventLog.shift();
}

// ================= STATE PORTAL & TIKTOK LIVE =================
let activeGame = 'pou';
let tiktokConnection = null;
let isConnecting = false;
let lastConnectAttempt = 0;
let tiktokStatus = { connected: false, username: '' };

const processedMsgIds = new Set();
const recentGiftSignatures = new Map();

function isDuplicateOrStaleEvent(data, prefix = 'evt') {
    const rawMsgId = data.msgId || data.common?.msgId || data.messageId || '';
    const msgId = rawMsgId ? `${prefix}_${String(rawMsgId)}` : '';

    if (msgId) {
        if (processedMsgIds.has(msgId)) return true;
        processedMsgIds.add(msgId);
        if (processedMsgIds.size > 500) {
            const first = processedMsgIds.values().next().value;
            processedMsgIds.delete(first);
        }
    }

    const createTime = Number(data.createTime || data.common?.createTime || 0);
    if (createTime > 0) {
        const msgMs = createTime < 1e12 ? createTime * 1000 : createTime;
        if (Date.now() - msgMs > 35000) {
            return true;
        }
    }

    return false;
}

function broadcastPortalState() {
    emitEvent('portal', 'portal_state', { activeGame, tiktokStatus });
    emitEvent('capit', 'tiktok_status', tiktokStatus);
}

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

// ================= KONEKSI TIKTOK LIVE =================
async function connectTikTok(username) {
    const cleanUser = normalizeId(username);
    if (!cleanUser) return { connected: false, error: 'Username kosong' };

    if (isConnecting) return tiktokStatus;
    if (tiktokStatus.connected && tiktokStatus.username === cleanUser) return tiktokStatus;
    if (Date.now() - lastConnectAttempt < 15000 && tiktokStatus.username === cleanUser) {
        return tiktokStatus;
    }

    isConnecting = true;
    lastConnectAttempt = Date.now();
    await initTikTokLibrary();

    if (tiktokConnection) {
        try {
            tiktokConnection.removeAllListeners();
            tiktokConnection.disconnect();
        } catch (e) {}
        tiktokConnection = null;
    }

    const conn = new TikTokLiveConnection(cleanUser, {
        processInitialData: false,
        signApiKey: process.env.SIGN_API_KEY
    });
    tiktokConnection = conn;

    try {
        const state = await conn.connect();
        console.log(`[TIKTOK] Terhubung ke @${cleanUser} (Room: ${state.roomId})`);
        tiktokStatus = { connected: true, username: cleanUser };
        broadcastPortalState();
    } catch (err) {
        console.error('[TIKTOK] Gagal terhubung:', err.message || err);
        tiktokStatus = { connected: false, username: cleanUser, error: err.message || 'Gagal terhubung' };
        broadcastPortalState();
        isConnecting = false;
        return tiktokStatus;
    }

    conn.on('disconnected', () => {
        if (tiktokConnection === conn) {
            tiktokStatus.connected = false;
            broadcastPortalState();
        }
    });

    // EVENT GIFT (ANTI-SPAM & ANTI-REPLAY)
    conn.on(WebcastEvent.GIFT, data => {
        if (tiktokConnection !== conn) return;

        const giftType = data.giftType ?? data.gift?.type ?? data.giftDetails?.giftType;
        if (giftType === 1 && data.repeatEnd === false) return;

        if (isDuplicateOrStaleEvent(data, 'gift')) return;

        const unitCoins = Number(
            data.diamondCount ||
            data.giftDetails?.diamondCount ||
            data.gift?.diamond_count ||
            data.gift?.diamondCount ||
            data.extendedGiftInfo?.diamond_count ||
            data.extendedGiftInfo?.diamondCount ||
            1
        );
        const repeatCount = Number(data.repeatCount || data.comboCount || 1);
        const totalCoins = Math.max(1, unitCoins * repeatCount);

        const giftName = String(
            data.giftName ||
            data.giftDetails?.giftName ||
            data.gift?.name ||
            data.extendedGiftInfo?.name ||
            ''
        );
        const userInfo = extractUserInfo(data);

        const sigKey = `${userInfo.uniqueId}_${giftName}_${totalCoins}`;
        const lastSigTime = recentGiftSignatures.get(sigKey) || 0;
        if (Date.now() - lastSigTime < 5000) return;
        recentGiftSignatures.set(sigKey, Date.now());

        console.log(`[GIFT VALID] @${userInfo.uniqueId} kirim ${giftName} (${totalCoins} koin) | Game: ${activeGame}`);

        if (activeGame === 'pou') {
            handlePouGift(userInfo.uniqueId, userInfo.nickname, totalCoins, giftName);
        } else if (activeGame === 'capit') {
            enqueueCapitPlayer({ ...userInfo, coins: totalCoins });
        }
    });

    // EVENT CHAT
    conn.on(WebcastEvent.CHAT, data => {
        if (tiktokConnection !== conn) return;
        if (isDuplicateOrStaleEvent(data, 'chat')) return;

        const comment = String(data.comment ?? data.content ?? data.text ?? '').trim();
        const chatUser = extractUserInfo(data);

        if (activeGame === 'pou') {
            handlePouChat(chatUser.uniqueId, chatUser.nickname, comment);
        } else if (activeGame === 'capit') {
            handleCapitChat(chatUser, comment);
        }
    });

    isConnecting = false;
    return tiktokStatus;
}

// =========================================================================
// BAGIAN A: LOGIKA GAME POU
// =========================================================================
const POU_FILE = path.join(__dirname, 'players.json');
let playersData = {};

try {
    if (fs.existsSync(POU_FILE)) {
        playersData = JSON.parse(fs.readFileSync(POU_FILE, 'utf8'));
    }
} catch (e) {
    playersData = {};
}

function getRandomNeedDuration() { return Math.floor(Math.random() * (180 - 150 + 1)) + 150; }
function getBossMaxHp(floor) { return Math.floor(100 + Math.pow(floor, 1.62) * 14); }

function savePlayerData() {
    try {
        fs.writeFileSync(POU_FILE, JSON.stringify(playersData, null, 2), 'utf8');
    } catch (e) {}
}

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
            emitEvent('pou', 'pou_hidden', { id });
        }
    }, IDLE_TIMEOUT_MS);
}

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

function ensurePouPlayer(id, nickname) {
    const cleanId = normalizeId(id);
    if (!playersData[cleanId]) {
        playersData[cleanId] = {
            id: cleanId, name: nickname || cleanId, level: 1, xp: 0, hp: 100, maxHp: 100,
            hunger: 100, thirst: 100, clean: 100,
            hungerDuration: getRandomNeedDuration(), thirstDuration: getRandomNeedDuration(), cleanDuration: getRandomNeedDuration(),
            outfit: "standar", weapon: "none", towerFloor: 1,
            bossHp: getBossMaxHp(1), bossMaxHp: getBossMaxHp(1),
            inDungeon: false, isHidden: false
        };
    } else if (nickname) {
        playersData[cleanId].name = nickname;
    }
    return playersData[cleanId];
}

function handlePouJoin(id, nickname) {
    const cleanId = normalizeId(id);
    const isNew = !playersData[cleanId];
    const player = ensurePouPlayer(cleanId, nickname);
    resetIdleTimer(cleanId);
    savePlayerData();

    if (isNew) {
        emitEvent('pou', 'player_updated', { player, action: 'join', coins: 0, rewardText: '' });
    } else {
        emitEvent('pou', 'user_show', { id: cleanId, nickname: player.name, player });
    }
}

function handlePouChat(id, nickname, rawComment) {
    const cleanId = normalizeId(id);
    const comment = rawComment.toLowerCase().trim();
    console.log(`[POU CHAT] @${cleanId}: "${comment}"`);

    if (comment === 'ee' || comment === 'eek') {
        return handlePouJoin(cleanId, nickname);
    }
    if (comment === 'shw' || comment === 'show') {
        const player = ensurePouPlayer(cleanId, nickname);
        resetIdleTimer(cleanId);
        savePlayerData();
        emitEvent('pou', 'user_show', { id: cleanId, nickname: player.name, player });
    }
    if (comment === 'dgn' || comment === 'dungeon') {
        ensurePouPlayer(cleanId, nickname);
        resetIdleTimer(cleanId);
        startAutoDungeon(cleanId);
    }
    if (comment === 'costume' || comment === 'baju') {
        emitEvent('pou', 'show_costume_catalog', {});
    }
}

function handlePouGift(id, nickname, coins, giftName = "") {
    const cleanId = normalizeId(id);
    const gName = giftName.toLowerCase();
    const numCoins = Number(coins) || 1;

    // Otomatis buat data pemain jika belum ada di memori kontainer aktif agar gacha/gift tidak pernah gagal
    if (!playersData[cleanId]) {
        if (gName.includes('heart') || gName.includes('love') || gName.includes('join') || numCoins >= 5 || gName.includes('parfum') || gName.includes('rose') || gName.includes('kopi') || gName.includes('tiktok')) {
            ensurePouPlayer(cleanId, nickname);
        } else {
            return "";
        }
    }

    const player = playersData[cleanId];
    if (nickname) player.name = nickname;
    resetIdleTimer(cleanId);

    let actionType = 'join', rewardText = "";
    const fillAmount = Math.ceil((100 / 3) * Math.max(1, numCoins));

    if (gName.includes('rose') || gName.includes('mawar')) {
        actionType = 'feed';
        player.hunger = Math.min(100, Math.round((player.hunger || 0) + fillAmount));
        player.hungerDuration = getRandomNeedDuration();
        player.hp = Math.min(player.maxHp, player.hp + (25 * Math.max(1, numCoins)));
    } else if (gName.includes('kopi') || gName.includes('coffee')) {
        actionType = 'drink';
        player.thirst = Math.min(100, Math.round((player.thirst || 0) + fillAmount));
        player.thirstDuration = getRandomNeedDuration();
        player.hp = Math.min(player.maxHp, player.hp + (20 * Math.max(1, numCoins)));
    } else if (gName.includes('tiktok')) {
        actionType = 'clean';
        player.clean = Math.min(100, Math.round((player.clean || 0) + fillAmount));
        player.cleanDuration = getRandomNeedDuration();
    } else if (gName.includes('parfum') || gName.includes('perfume') || numCoins === 20) {
        actionType = 'gacha';
        let tier = player.level > 80 ? "81-100" : player.level > 60 ? "61-80" : player.level > 40 ? "41-60" : player.level > 20 ? "21-40" : "1-20";
        const sel = fashionData[tier][Math.floor(Math.random() * fashionData[tier].length)];
        player.outfit = sel.id;
        rewardText = `Parfume Gacha Baju [Lv.${tier}]: ${sel.name}`;
    } else if (numCoins >= 5 || gName.includes('senjata')) {
        actionType = 'gacha';
        const list = numCoins >= 500
            ? ["thanos", "thor", "naga"]
            : numCoins >= 100
                ? ["bazooka", "staff", "laser"]
                : numCoins >= 10
                    ? ["ketapel", "shuriken", "katana"]
                    : ["sandal", "pisau", "palu"];
        player.weapon = list[Math.floor(Math.random() * list.length)];
        rewardText = `Senjata (${numCoins}c): ${weaponData[player.weapon].name}`;
    }

    savePlayerData();
    emitEvent('pou', 'player_updated', { player, action: actionType, coins: numCoins, rewardText });
    return rewardText;
}

function executePouCmd(data) {
    const cleanId = normalizeId(data.id);
    if ((data.cmd === 'ee' || data.cmd === 'eek') && cleanId) {
        handlePouJoin(cleanId, data.nickname || cleanId);
    } else if ((data.cmd === 'shw' || data.cmd === 'show') && cleanId) {
        const player = ensurePouPlayer(cleanId, data.nickname || cleanId);
        resetIdleTimer(cleanId);
        savePlayerData();
        emitEvent('pou', 'user_show', { id: cleanId, nickname: player.name, player });
    } else if ((data.cmd === 'dgn' || data.cmd === 'dungeon') && cleanId) {
        ensurePouPlayer(cleanId, data.nickname || cleanId);
        startAutoDungeon(cleanId);
    } else if (data.cmd === 'throne' && cleanId) {
        const player = ensurePouPlayer(cleanId, data.nickname || cleanId);
        resetIdleTimer(cleanId);
        savePlayerData();
        emitEvent('pou', 'set_throne', { id: cleanId, player });
    } else if (data.cmd === 'levelup1' && cleanId) {
        const player = ensurePouPlayer(cleanId, data.nickname || cleanId);
        resetIdleTimer(cleanId);
        player.level += 1;
        player.maxHp += 35;
        player.hp = player.maxHp;
        savePlayerData();
        emitEvent('pou', 'player_updated', { player, action: 'join', coins: 0, rewardText: '' });
    } else if (data.cmd === 'levelup10' && cleanId) {
        const player = ensurePouPlayer(cleanId, data.nickname || cleanId);
        resetIdleTimer(cleanId);
        player.level += 10;
        player.maxHp += 350;
        player.hp = player.maxHp;
        savePlayerData();
        emitEvent('pou', 'player_updated', { player, action: 'join', coins: 0, rewardText: '' });
    } else if (data.cmd === 'delete_player' && cleanId) {
        clearTimeout(idleTimers[cleanId]);
        delete idleTimers[cleanId];
        delete playersData[cleanId];
        savePlayerData();
        emitEvent('pou', 'player_deleted', { id: cleanId });
    } else if (data.cmd === 'clear_all') {
        Object.keys(idleTimers).forEach(k => clearTimeout(idleTimers[k]));
        playersData = {};
        savePlayerData();
        emitEvent('pou', 'all_players_cleared', {});
    }
}

function startAutoDungeon(id) {
    const cleanId = normalizeId(id);
    const player = playersData[cleanId];
    if (!player || player.inDungeon) return;
    resetIdleTimer(cleanId);
    const maxB = getBossMaxHp(player.towerFloor);
    player.hp = player.maxHp; player.bossMaxHp = maxB; player.bossHp = maxB; player.inDungeon = true;
    emitEvent('pou', 'dungeon_status', { id: cleanId, status: 'started', player });

    const dungeonInterval = setInterval(() => {
        if (!playersData[cleanId] || !player.inDungeon) { clearInterval(dungeonInterval); return; }
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
                resetIdleTimer(cleanId); clearInterval(dungeonInterval);
            } else {
                player.towerFloor += 1;
                player.bossMaxHp = getBossMaxHp(player.towerFloor);
                player.bossHp = player.bossMaxHp;
            }
        } else if (player.hp <= 0) {
            player.inDungeon = false; player.hp = player.maxHp;
            player.bossMaxHp = getBossMaxHp(player.towerFloor); player.bossHp = player.bossMaxHp;
            playerDied = true; resetIdleTimer(cleanId); clearInterval(dungeonInterval);
        }
        savePlayerData();
        emitEvent('pou', 'tower_tick', { player, playerDmg, bossDmg, floorCleared, playerDied, leveledUp });
    }, 1250);
}

// =========================================================================
// BAGIAN B: LOGIKA GAME GACHA CAPIT
// =========================================================================
const CAPIT_FILE = path.join(__dirname, 'challenges.json');
const PICK_TIMEOUT_MS = 35000;
let gameConfig = { activeTheme: 'candy', tiers: [] };

try {
    if (fs.existsSync(CAPIT_FILE)) {
        gameConfig = JSON.parse(fs.readFileSync(CAPIT_FILE, 'utf8'));
    }
} catch (e) {}

function saveCapitConfig() {
    try {
        fs.writeFileSync(CAPIT_FILE, JSON.stringify(gameConfig, null, 2));
    } catch (e) {}
}

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
        turnId: 'turn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
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
    emitEvent('capit', 'queue_update', { queueLength: queue.length, currentTurn });
    processNextCapitTurn();
}

function processNextCapitTurn() {
    if (currentTurn || queue.length === 0) return;
    currentTurn = queue.shift();
    emitEvent('capit', 'start_turn', { player: currentTurn, queueLength: queue.length, timeoutSec: PICK_TIMEOUT_MS / 1000 });
    turnTimer = setTimeout(() => {
        if (currentTurn && !currentTurn.isRevealing) executeCapitBoxOpen(Math.floor(Math.random() * 10) + 1, true);
    }, PICK_TIMEOUT_MS);
}

function executeCapitBoxOpen(boxNumber, isAuto = false) {
    if (!currentTurn || currentTurn.isRevealing) return;
    currentTurn.isRevealing = true;
    clearTimeout(turnTimer);
    emitEvent('capit', 'reveal_box', { boxNumber, challengeText: currentTurn.boxes[boxNumber - 1], player: currentTurn, isAuto });
    setTimeout(() => {
        currentTurn = null;
        emitEvent('capit', 'turn_ended', { queueLength: queue.length });
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

// ================= SSE STREAM KEEP-ALIVE VERCEL =================
app.get('/api/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const savedUser = normalizeId(req.query.user || '');
    const savedGame = req.query.game || '';
    if (savedGame === 'pou' || savedGame === 'capit') {
        activeGame = savedGame;
    }

    if (savedUser && (!tiktokStatus.connected || tiktokStatus.username !== savedUser) && !isConnecting) {
        await connectTikTok(savedUser);
    }

    const keepAlive = setInterval(() => {
        res.write(`data: ${JSON.stringify({ ts: Date.now(), connected: tiktokStatus.connected })}\n\n`);
    }, 2000);

    setTimeout(() => {
        clearInterval(keepAlive);
        res.end();
    }, 55000);

    req.on('close', () => clearInterval(keepAlive));
});

// ================= ENDPOINT SYNC =================
app.get('/api/sync', (req, res) => {
    const since = parseInt(req.query.since || '0', 10);
    const ns = req.query.ns || '';
    const savedGame = req.query.game || '';

    if (ns === 'capit' || ns === 'pou') {
        activeGame = ns;
    } else if (savedGame === 'pou' || savedGame === 'capit') {
        activeGame = savedGame;
    }

    const events = eventLog.filter(e => e.seq > since && (!ns || e.namespace === ns));
    res.json({
        seq: eventSeq,
        events,
        state: {
            activeGame,
            tiktokStatus,
            players: playersData,
            capit: { config: gameConfig, currentTurn, queueLength: queue.length }
        }
    });
});

// ================= API ROUTES =================
app.get('/api/config', (req, res) => res.json(gameConfig));
app.post('/api/config', (req, res) => { gameConfig = req.body; saveCapitConfig(); emitEvent('capit', 'config_updated', gameConfig); res.json({ success: true }); });
app.post('/api/theme', (req, res) => { gameConfig.activeTheme = req.body.theme; saveCapitConfig(); emitEvent('capit', 'theme_changed', req.body.theme); res.json({ success: true }); });

app.post('/api/connect-tiktok', async (req, res) => {
    const status = await connectTikTok(req.body.username);
    res.json({ success: status.connected, status });
});

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
    clearTimeout(turnTimer); currentTurn = null; emitEvent('capit', 'turn_ended', { queueLength: queue.length }); processNextCapitTurn(); res.json({ success: true });
});

app.get('/api/pou/players', (req, res) => {
    res.json({ players: playersData });
});

app.post('/api/pou/action', (req, res) => {
    const { type } = req.body;
    let rewardText = '';
    if (type === 'gift') {
        rewardText = handlePouGift(req.body.id, req.body.nickname, req.body.coins, req.body.giftName);
    } else if (type === 'cmd') {
        executePouCmd(req.body);
    }
    res.json({ success: true, rewardText, players: playersData });
});

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    initTikTokLibrary().then(() => {
        app.listen(PORT, () => console.log(`🚀 Server lokal: http://localhost:${PORT}`));
    });
}

module.exports = app;