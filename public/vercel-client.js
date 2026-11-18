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

    async function poll() {
        try {
            const savedUser = localStorage.getItem('tiktok_live_user') || '';
            const savedGame = (ns === 'pou' || ns === 'capit')
                ? ns
                : (localStorage.getItem('tiktok_active_game') || 'pou');

            const url = `/api/sync?ns=${ns}&since=${lastSeq}&user=${encodeURIComponent(savedUser)}&game=${encodeURIComponent(savedGame)}&t=${Date.now()}`;

            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();

            // Simpan username TikTok jika server sudah terhubung
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
                    trigger('init_game', { players: data.state.players || {} });
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
                } else {
                    lastSeq = data.seq;
                    data.events.forEach(ev => {
                        if (ev.event === 'portal_state' && ev.payload?.activeGame) {
                            localStorage.setItem('tiktok_active_game', ev.payload.activeGame);
                        }
                        if (ev.event === 'portal_state' && ev.payload?.tiktokStatus?.username) {
                            localStorage.setItem('tiktok_live_user', ev.payload.tiktokStatus.username);
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

                // Sinkronisasi pemain Pou langsung dari state jika ada event terlewat
                if (ns === 'pou' && data.state?.players) {
                    Object.values(data.state.players).forEach(p => {
                        if (!p.isHidden) {
                            trigger('player_updated', { player: p, action: 'sync', coins: 0, rewardText: '' });
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
                            timeoutSec: 20
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
        emit(event, data) {
            if (ns === 'pou') {
                const type = event === 'test_gift' ? 'gift' : 'cmd';
                fetch('/api/pou/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, ...data })
                });
            }
        }
    };
};

function startKeepAliveStream() {
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