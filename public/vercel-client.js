window.createVercelSocket = function(namespace) {
    const ns = namespace.replace(/^\//, '');
    const handlers = {};
    let lastSeq = 0;
    let initialized = false;

    // Jika membuka halaman Capit, otomatis kunci localStorage ke 'capit'
    if (ns === 'capit') {
        localStorage.setItem('tiktok_active_game', 'capit');
    }

    const playedTurns = new Set(JSON.parse(sessionStorage.getItem('played_capit_turns') || '[]'));
    function markTurnPlayed(id) {
        if (!id) return;
        playedTurns.add(id);
        sessionStorage.setItem('played_capit_turns', JSON.stringify(Array.from(playedTurns).slice(-50)));
    }

    function trigger(event, payload) {
        if (handlers[event]) {
            handlers[event].forEach(fn => fn(payload));
        }
    }

    async function poll() {
        try {
            const savedUser = localStorage.getItem('tiktok_live_user') || '';
            const savedGame = ns === 'capit' ? 'capit' : (localStorage.getItem('tiktok_active_game') || '');
            const url = `/api/sync?ns=${ns}&since=${lastSeq}&user=${encodeURIComponent(savedUser)}&game=${encodeURIComponent(savedGame)}`;

            const res = await fetch(url);
            const data = await res.json();

            if (!initialized) {
                initialized = true;
                lastSeq = data.seq;
                trigger('connect', {});
                if (ns === 'portal') {
                    trigger('portal_state', {
                        activeGame: savedGame || data.state.activeGame,
                        tiktokStatus: data.state.tiktokStatus
                    });
                } else if (ns === 'pou') {
                    trigger('init_game', { players: data.state.players || {} });
                } else if (ns === 'capit') {
                    trigger('init_state', data.state.capit);
                    trigger('tiktok_status', data.state.tiktokStatus);
                    if (data.state.capit?.currentTurn?.turnId) {
                        markTurnPlayed(data.state.capit.currentTurn.turnId);
                    }
                }
            } else {
                if (data.seq < lastSeq) {
                    lastSeq = data.seq;
                } else {
                    lastSeq = data.seq;
                    data.events.forEach(ev => {
                        if (ev.event === 'start_turn' && ev.payload?.player?.turnId) {
                            if (playedTurns.has(ev.payload.player.turnId)) return;
                            markTurnPlayed(ev.payload.player.turnId);
                        }
                        trigger(ev.event, ev.payload);
                    });
                }

                if (ns === 'capit' && data.state?.capit?.currentTurn) {
                    const turn = data.state.capit.currentTurn;
                    if (turn.turnId && !playedTurns.has(turn.turnId) && !turn.isRevealing) {
                        markTurnPlayed(turn.turnId);
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
    const savedGame = localStorage.getItem('tiktok_active_game') || 'capit';
    if (!savedUser) {
        setTimeout(startKeepAliveStream, 2000);
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