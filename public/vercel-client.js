window.createVercelSocket = function(namespace) {
    const ns = namespace.replace(/^\//, '');
    const handlers = {};
    let lastSeq = 0;
    let initialized = false;

    if (ns === 'capit') {
        localStorage.setItem('tiktok_active_game', 'capit');
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
            const savedGame = ns === 'capit' ? 'capit' : (localStorage.getItem('tiktok_active_game') || '');
            const url = `/api/sync?ns=${ns}&since=${lastSeq}&user=${encodeURIComponent(savedUser)}&game=${encodeURIComponent(savedGame)}&t=${Date.now()}`;

            const res = await fetch(url, { cache: 'no-store' });
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
                        markTurn(playedTurns, 'played_capit_turns', data.state.capit.currentTurn.turnId);
                    }
                }
            } else {
                if (data.seq < lastSeq) {
                    lastSeq = data.seq;
                } else {
                    lastSeq = data.seq;
                    data.events.forEach(ev => {
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