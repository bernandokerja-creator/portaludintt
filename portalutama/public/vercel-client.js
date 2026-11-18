// Pengganti socket.io untuk Vercel Serverless (HTTP Polling Real-Time)
window.createVercelSocket = function(namespace) {
    const ns = namespace.replace(/^\//, '');
    const handlers = {};
    let lastSeq = 0;
    let initialized = false;

    function trigger(event, payload) {
        if (handlers[event]) {
            handlers[event].forEach(fn => fn(payload));
        }
    }

    async function poll() {
        try {
            const res = await fetch(`/api/sync?ns=${ns}&since=${lastSeq}`);
            const data = await res.json();

            if (!initialized) {
                initialized = true;
                lastSeq = data.seq;
                trigger('connect', {});
                if (ns === 'portal') {
                    trigger('portal_state', {
                        activeGame: data.state.activeGame,
                        tiktokStatus: data.state.tiktokStatus
                    });
                } else if (ns === 'pou') {
                    trigger('init_game', { players: data.state.players || {} });
                } else if (ns === 'capit') {
                    trigger('init_state', data.state.capit);
                    trigger('tiktok_status', data.state.tiktokStatus);
                }
            } else {
                lastSeq = data.seq;
                data.events.forEach(ev => trigger(ev.event, ev.payload));
            }
        } catch (err) {
            // Abaikan error jaringan sesaat
        }
        setTimeout(poll, 900);
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