window.createVercelSocket = function(namespace) {
    const ns = namespace.replace(/^\//, '');
    const handlers = {};
    let lastSeq = 0;
    let initialized = false;

    if (ns === 'capit') {
        localStorage.setItem('tiktok_active_game', 'capit');
    } else if (ns === 'pou') {
        localStorage.setItem('tiktok_active_game', 'pou');
    }

    const playedTurns = new Set(JSON.parse(sessionStorage.getItem('played_capit_turns') || '[]'));
    const revealedTurns = new Set(JSON.parse(sessionStorage.getItem('revealed_capit_turns') || '[]'));

    const pouSnapshots = new Map();
    const pouBestOutfits = JSON.parse(localStorage.getItem('pou_best_outfits') || '{}');
    const pouBestWeapons = JSON.parse(localStorage.getItem('pou_best_weapons') || '{}');

    function syncPouCache(p, forceOverwrite = false) {
        if (!p || !p.id) return p;
        const copy = { ...p };

        if (forceOverwrite) {
            if (copy.outfit && copy.outfit !== 'standar') {
                pouBestOutfits[copy.id] = copy.outfit;
                localStorage.setItem('pou_best_outfits', JSON.stringify(pouBestOutfits));
            }
            if (copy.weapon && copy.weapon !== 'none') {
                pouBestWeapons[copy.id] = copy.weapon;
                localStorage.setItem('pou_best_weapons', JSON.stringify(pouBestWeapons));
            }
            return copy;
        }

        if (copy.outfit && copy.outfit !== 'standar') {
            pouBestOutfits[copy.id] = copy.outfit;
            localStorage.setItem('pou_best_outfits', JSON.stringify(pouBestOutfits));
        } else if (pouBestOutfits[copy.id]) {
            copy.outfit = pouBestOutfits[copy.id];
        }

        if (copy.weapon && copy.weapon !== 'none') {
            pouBestWeapons[copy.id] = copy.weapon;
            localStorage.setItem('pou_best_weapons', JSON.stringify(pouBestWeapons));
        } else if (pouBestWeapons[copy.id]) {
            copy.weapon = pouBestWeapons[copy.id];
        }
        return copy;
    }

    function getPouHash(p) {
        return `${p.name}|${p.level}|${p.hp}|${p.hunger}|${p.thirst}|${p.clean}|${p.outfit}|${p.weapon}|${p.towerFloor}|${p.inDungeon}|${p.isHidden}`;
    }

    function markTurn(setObj, key, id) {
        if (!id) return;
        setObj.add(id);
        sessionStorage.setItem(key, JSON.stringify(Array.from(setObj).slice(-50)));
    }

    function trigger(event, payload) {
        if (handlers[event]) {
            handlers[event].forEach(fn => fn(payload));
        }
    }

    function processEvents(events) {
        events.forEach(ev => {
            if (ev.event === 'portal_state' && ev.payload?.activeGame) {
                localStorage.setItem('tiktok_active_game', ev.payload.activeGame);
            }
            if (ev.event === 'portal_state' && ev.payload?.tiktokStatus?.username) {
                localStorage.setItem('tiktok_live_user', ev.payload.tiktokStatus.username);
            }
            if (ns === 'pou' && ev.payload?.player) {
                const isExplicitAction = ev.event === 'player_updated' || ev.event === 'user_show';
                ev.payload.player = syncPouCache(ev.payload.player, isExplicitAction);
                pouSnapshots.set(ev.payload.player.id, getPouHash(ev.payload.player));
            }
            if (ev.event === 'all_players_cleared') {
                pouSnapshots.clear();
                localStorage.removeItem('pou_best_outfits');
                localStorage.removeItem('pou_best_weapons');
            }
            const tid = ev.payload?.player?.turnId;
            if (ev.event === 'start_turn' && tid) {
                if (playedTurns.has(tid)) return;
                markTurn(playedTurns, 'played_capit_turns', tid);
            }
            if (ev.event === 'reveal_box' && tid) {
                if (revealedTurns.has(tid)) return;
                markTurn(revealedTurns, 'revealed_capit_turns', tid);
            }
            trigger(ev.event, ev.payload);
        });
    }

    async function poll() {
        try {
            const savedUser = localStorage.getItem('tiktok_live_user') || '';
            const savedGame = (ns === 'pou' || ns === 'capit')
                ? ns
                : (localStorage.getItem('tiktok_active_game') || 'pou');

            const url = `/api/sync?ns=${ns}&since=${lastSeq}&user=${encodeURIComponent(savedUser)}&game=${encodeURIComponent(savedGame)}&t=${Date.now()}`;

            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();

            if (data.state?.tiktokStatus?.username && !savedUser) {
                localStorage.setItem('tiktok_live_user', data.state.tiktokStatus.username);
            }

            if (!initialized) {
                initialized = true;
                lastSeq = data.seq;
                trigger('connect', {});
                if (ns === 'portal') {
                    trigger('portal_state', {
                        activeGame: data.state.activeGame || savedGame,
                        tiktokStatus: data.state.tiktokStatus
                    });
                } else if (ns === 'pou') {
                    const normalizedPlayers = {};
                    Object.entries(data.state.players || {}).forEach(([id, p]) => {
                        const np = syncPouCache(p, false);
                        normalizedPlayers[id] = np;
                        pouSnapshots.set(id, getPouHash(np));
                    });
                    trigger('init_game', { players: normalizedPlayers });
                } else if (ns === 'capit') {
                    trigger('init_state', data.state.capit);
                    trigger('tiktok_status', data.state.tiktokStatus);
                    if (data.state.capit?.currentTurn?.turnId) {
                        markTurn(playedTurns, 'played_capit_turns', data.state.capit.currentTurn.turnId);
                    }
                }
            } else {
                if (data.seq < lastSeq) {
                    lastSeq = data.seq;
                    const freshRes = await fetch(`/api/sync?ns=${ns}&since=0&user=${encodeURIComponent(savedUser)}&game=${encodeURIComponent(savedGame)}&t=${Date.now()}`, { cache: 'no-store' });
                    const freshData = await freshRes.json();
                    lastSeq = freshData.seq;
                    processEvents(freshData.events || []);
                } else {
                    lastSeq = data.seq;
                    processEvents(data.events || []);
                }

                // Fallback sinkronisasi state jika event terlewat antar kontainer
                if (ns === 'pou' && data.state?.players) {
                    Object.values(data.state.players).forEach(rawP => {
                        const p = syncPouCache(rawP, false);
                        const hash = getPouHash(p);
                        if (pouSnapshots.get(p.id) !== hash) {
                            pouSnapshots.set(p.id, hash);
                            if (!p.isHidden) {
                                trigger('player_updated', { player: p, action: 'sync', coins: 0, rewardText: '' });
                            }
                        }
                    });
                }

                if (ns === 'capit' && data.state?.capit?.currentTurn) {
                    const turn = data.state.capit.currentTurn;
                    if (turn.turnId && !playedTurns.has(turn.turnId) && !turn.isRevealing) {
                        markTurn(playedTurns, 'played_capit_turns', turn.turnId);
                        trigger('start_turn', {
                            player: turn,
                            queueLength: data.state.capit.queueLength || 0,
                            timeoutSec: 35
                        });
                    }
                }
            }
        } catch (err) {}
        setTimeout(poll, 1000);
    }

    poll();

    return {
        on(event, fn) {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(fn);
        },
        async emit(event, data) {
            if (ns === 'pou') {
                const type = event === 'test_gift' ? 'gift' : 'cmd';
                try {
                    const res = await fetch('/api/pou/action', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, ...data })
                    });
                    const resData = await res.json();
                    if (resData.players && data.id && resData.players[data.id]) {
                        const updatedP = syncPouCache(resData.players[data.id], true);
                        pouSnapshots.set(updatedP.id, getPouHash(updatedP));
                        trigger('player_updated', {
                            player: updatedP,
                            action: type === 'gift' ? 'gacha' : (data.cmd || 'join'),
                            coins: data.coins || 0,
                            rewardText: resData.rewardText || ''
                        });
                    }
                } catch (e) {}
            }
        }
    };
};

function startKeepAliveStream() {
    // Jangan jalankan stream duplikat dari tab admin agar kontainer Vercel tidak bertabrakan
    if (window.location.pathname.includes('admin.html')) return;

    const savedUser = localStorage.getItem('tiktok_live_user') || '';
    const savedGame = localStorage.getItem('tiktok_active_game') || 'pou';
    if (!savedUser) {
        setTimeout(startKeepAliveStream, 1500);
        return;
    }
    const es = new EventSource(`/api/stream?user=${encodeURIComponent(savedUser)}&game=${encodeURIComponent(savedGame)}`);
    es.onerror = () => {
        es.close();
        setTimeout(startKeepAliveStream, 1500);
    };
}
if (!window._vercelStreamStarted) {
    window._vercelStreamStarted = true;
    startKeepAliveStream();
}