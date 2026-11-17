function renderPouSVG(outfit, weapon, mouthState = "normal") {
    let bodyFill = "#b57236";
    let bodyStroke = "#5a3311";

    if (outfit === "kostum-panda") {
        bodyFill = "#ffffff";
        bodyStroke = "#111111";
    } else if (outfit === "cyber-mecha") {
        bodyFill = "#94a3b8";
        bodyStroke = "#1e293b";
    } else if (outfit === "dewa-matahari") {
        bodyFill = "#f59e0b";
        bodyStroke = "#78350f";
    }

    let clothesLayer = "";
    switch (outfit) {
        case "tuxedo-hitam":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#18181b" />
                <polygon points="48,62 60,82 72,62" fill="#ffffff" />
                <polygon points="53,66 60,71 67,66 67,73 60,69 53,73" fill="#000000" />
                <circle cx="60" cy="88" r="2" fill="#ffffff" /><circle cx="60" cy="96" r="2" fill="#ffffff" />
                <polygon points="75,78 85,78 82,73 78,75" fill="#e11d48" />
            `;
            break;
        case "baju-merah-pink":
            clothesLayer = `
                <rect x="0" y="64" width="120" height="56" fill="#dc2626" />
                <path d="M 32,64 Q 46,74 60,64 Q 74,74 88,64" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />
                <circle cx="60" cy="78" r="2" fill="#ffffff" /><circle cx="60" cy="87" r="2" fill="#ffffff" /><circle cx="60" cy="96" r="2" fill="#ffffff" />
            `;
            break;
        case "topi-koki":
            clothesLayer = `
                <rect x="0" y="64" width="120" height="56" fill="#f8fafc" />
                <path d="M 48,64 L 60,76 L 72,64" fill="none" stroke="#cbd5e1" stroke-width="2.5" />
                <circle cx="53" cy="82" r="2.2" fill="#334155" /><circle cx="67" cy="82" r="2.2" fill="#334155" />
                <circle cx="53" cy="92" r="2.2" fill="#334155" /><circle cx="67" cy="92" r="2.2" fill="#334155" />
            `;
            break;
        case "baju-pelaut":
            clothesLayer = `
                <rect x="0" y="64" width="120" height="56" fill="#ffffff" />
                <rect x="0" y="72" width="120" height="6" fill="#0284c7" />
                <rect x="0" y="84" width="120" height="6" fill="#0284c7" />
                <rect x="0" y="96" width="120" height="6" fill="#0284c7" />
                <polygon points="50,64 60,76 70,64" fill="#ef4444" />
            `;
            break;
        case "kostum-lebah":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#facc15" />
                <rect x="0" y="70" width="120" height="8" fill="#18181b" />
                <rect x="0" y="85" width="120" height="8" fill="#18181b" />
                <rect x="0" y="99" width="120" height="8" fill="#18181b" />
            `;
            break;
        case "kostum-panda":
            clothesLayer = `
                <rect x="0" y="66" width="120" height="54" fill="#111111" />
                <ellipse cx="47" cy="48" rx="13" ry="15" fill="#111111" transform="rotate(-15 47 48)" />
                <ellipse cx="73" cy="48" rx="13" ry="15" fill="#111111" transform="rotate(15 73 48)" />
            `;
            break;
        case "helm-zirah":
            clothesLayer = `
                <rect x="0" y="63" width="120" height="57" fill="#64748b" />
                <line x1="60" y1="63" x2="60" y2="108" stroke="#cbd5e1" stroke-width="3" />
                <path d="M 28,74 Q 60,84 92,74" fill="none" stroke="#cbd5e1" stroke-width="3" />
            `;
            break;
        case "jubah-sihir":
            clothesLayer = `
                <rect x="0" y="63" width="120" height="57" fill="#4c1d95" />
                <polygon points="42,76 45,83 52,83 46,87 48,94 42,89 36,94 38,87 32,83 39,83" fill="#fde047" />
                <circle cx="78" cy="84" r="5" fill="#fde047" />
            `;
            break;
        case "kostum-ninja":
            clothesLayer = `
                <rect x="0" y="56" width="120" height="64" fill="#1e293b" />
                <line x1="35" y1="62" x2="85" y2="95" stroke="#ef4444" stroke-width="5" />
                <line x1="85" y1="62" x2="35" y2="95" stroke="#ef4444" stroke-width="5" />
            `;
            break;
        case "baju-bajak-laut":
            clothesLayer = `
                <rect x="0" y="63" width="120" height="57" fill="#7f1d1d" />
                <rect x="52" y="63" width="16" height="57" fill="#f8fafc" />
                <rect x="0" y="86" width="120" height="8" fill="#18181b" />
                <rect x="54" y="84" width="12" height="12" fill="none" stroke="#facc15" stroke-width="2.5" />
            `;
            break;
        case "mahkota-emas":
        case "jubah-merah-raja":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#991b1b" />
                <rect x="0" y="62" width="120" height="8" fill="#fef08a" />
                <circle cx="42" cy="66" r="2" fill="#000" /><circle cx="60" cy="66" r="2" fill="#000" /><circle cx="78" cy="66" r="2" fill="#000" />
            `;
            break;
        case "tuxedo-sultan":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#d97706" />
                <polygon points="48,62 60,82 72,62" fill="#ffffff" />
                <polygon points="53,66 60,71 67,66 67,73 60,69 53,73" fill="#991b1b" />
                <circle cx="60" cy="88" r="2.2" fill="#fef08a" /><circle cx="60" cy="96" r="2.2" fill="#fef08a" />
            `;
            break;
        case "baju-pharaoh":
            clothesLayer = `
                <rect x="0" y="63" width="120" height="57" fill="#fef3c7" />
                <path d="M 32,63 Q 60,86 88,63" fill="#0284c7" stroke="#facc15" stroke-width="3" />
                <rect x="0" y="88" width="120" height="8" fill="#facc15" />
            `;
            break;
        case "jas-berlian":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#0369a1" />
                <polygon points="48,62 60,82 72,62" fill="#e0f2fe" />
                <polygon points="60,72 65,78 60,84 55,78" fill="#38bdf8" stroke="#ffffff" stroke-width="1" />
            `;
            break;
        case "sayap-malaikat":
            clothesLayer = `
                <rect x="0" y="63" width="120" height="57" fill="#ffffff" />
                <path d="M 30,68 Q 60,78 90,68" fill="none" stroke="#facc15" stroke-width="3" />
            `;
            break;
        case "kostum-anubis":
            clothesLayer = `
                <rect x="0" y="63" width="120" height="57" fill="#0f172a" />
                <path d="M 34,63 Q 60,84 86,63" fill="#facc15" />
                <polygon points="60,76 66,86 54,86" fill="#38bdf8" />
            `;
            break;
        case "kostum-naga-api":
            clothesLayer = `
                <rect x="0" y="64" width="120" height="56" fill="#15803d" />
                <ellipse cx="60" cy="86" rx="16" ry="20" fill="#fde047" />
            `;
            break;
        case "zirah-samurai":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#b91c1c" />
                <rect x="35" y="72" width="50" height="6" fill="#18181b" stroke="#facc15" stroke-width="1" />
                <rect x="35" y="83" width="50" height="6" fill="#18181b" stroke="#facc15" stroke-width="1" />
                <rect x="35" y="94" width="50" height="6" fill="#18181b" stroke="#facc15" stroke-width="1" />
            `;
            break;
        case "jubah-vampir":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#18181b" />
                <polygon points="36,62 60,92 84,62" fill="#991b1b" />
                <circle cx="60" cy="74" r="4" fill="#facc15" />
            `;
            break;
        case "halo-surgawi":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#fef9c3" />
                <rect x="54" y="62" width="12" height="58" fill="#facc15" />
            `;
            break;
        case "aura-listrik-thor":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#1e3a8a" />
                <circle cx="45" cy="76" r="4" fill="#94a3b8" /><circle cx="75" cy="76" r="4" fill="#94a3b8" />
                <circle cx="45" cy="90" r="4" fill="#94a3b8" /><circle cx="75" cy="90" r="4" fill="#94a3b8" />
            `;
            break;
        case "jubah-kosmik":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#0f172a" />
                <circle cx="40" cy="78" r="2" fill="#38bdf8" /><circle cx="78" cy="75" r="2.5" fill="#f472b6" />
                <ellipse cx="64" cy="88" rx="11" ry="3.5" fill="none" stroke="#a855f7" stroke-width="2" transform="rotate(-20 64 88)" />
            `;
            break;
        case "cyber-mecha":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#334155" />
                <circle cx="60" cy="82" r="9" fill="#0ea5e9" stroke="#e0f2fe" stroke-width="2.5" />
                <line x1="25" y1="74" x2="48" y2="82" stroke="#38bdf8" stroke-width="2" />
                <line x1="95" y1="74" x2="72" y2="82" stroke="#38bdf8" stroke-width="2" />
            `;
            break;
        case "dewa-matahari":
            clothesLayer = `
                <rect x="0" y="62" width="120" height="58" fill="#ea580c" />
                <circle cx="60" cy="84" r="11" fill="#fef08a" stroke="#dc2626" stroke-width="2" />
            `;
            break;
    }

    let faceAccessory = "";
    if (outfit === "tuxedo-hitam" || outfit === "tuxedo-sultan" || outfit === "jas-berlian") {
        faceAccessory = `
            <rect x="33" y="38" width="24" height="17" rx="4" fill="#09090b" stroke="#27272a" stroke-width="2" />
            <rect x="63" y="38" width="24" height="17" rx="4" fill="#09090b" stroke="#27272a" stroke-width="2" />
            <line x1="57" y1="43" x2="63" y2="43" stroke="#09090b" stroke-width="3" />
        `;
    } else if (outfit === "baju-merah-pink") {
        faceAccessory = `
            <rect x="33" y="38" width="24" height="18" rx="4" fill="rgba(255,255,255,0.2)" stroke="#ec4899" stroke-width="3.5" />
            <rect x="63" y="38" width="24" height="18" rx="4" fill="rgba(255,255,255,0.2)" stroke="#ec4899" stroke-width="3.5" />
            <line x1="57" y1="44" x2="63" y2="44" stroke="#ec4899" stroke-width="3.5" />
        `;
    } else if (outfit === "cyber-mecha") {
        faceAccessory = `
            <rect x="32" y="40" width="56" height="14" rx="5" fill="rgba(14, 165, 233, 0.45)" stroke="#38bdf8" stroke-width="2" />
        `;
    }

    let backAccessory = "";
    let headAccessory = "";

    if (outfit === "tuxedo-hitam") {
        headAccessory = `<ellipse cx="60" cy="24" rx="28" ry="6" fill="#18181b" stroke="#000" stroke-width="1.5"/><path d="M 43,24 L 46,6 Q 60,10 74,6 L 77,24 Z" fill="#18181b"/><rect x="44" y="19" width="32" height="4" fill="#fff"/>`;
    } else if (outfit === "baju-merah-pink") {
        headAccessory = `<path d="M 52,24 Q 55,10 60,7 Q 65,10 68,24 Z" fill="#84cc16" stroke="#3f6212" stroke-width="1.5"/><path d="M 46,25 Q 48,14 55,15" fill="none" stroke="#84cc16" stroke-width="4" stroke-linecap="round"/><path d="M 74,25 Q 72,14 65,15" fill="none" stroke="#84cc16" stroke-width="4" stroke-linecap="round"/>`;
    } else if (outfit === "topi-koki") {
        headAccessory = `<path d="M 42,24 C 34,12 46,4 60,8 C 74,4 86,12 78,24 Z" fill="#fff" stroke="#cbd5e1" stroke-width="2"/><rect x="44" y="20" width="32" height="5" fill="#f1f5f9"/>`;
    } else if (outfit === "baju-pelaut") {
        headAccessory = `<ellipse cx="60" cy="21" rx="20" ry="6" fill="#fff" stroke="#0284c7" stroke-width="2"/><rect x="46" y="13" width="28" height="7" rx="3" fill="#fff" stroke="#0284c7" stroke-width="1.5"/>`;
    } else if (outfit === "kostum-lebah") {
        backAccessory = `<ellipse cx="26" cy="54" rx="14" ry="8" fill="rgba(224,242,254,0.85)" stroke="#38bdf8" stroke-width="1.5" transform="rotate(-25 26 54)"/><ellipse cx="94" cy="54" rx="14" ry="8" fill="rgba(224,242,254,0.85)" stroke="#38bdf8" stroke-width="1.5" transform="rotate(25 94 54)"/>`;
        headAccessory = `<path d="M 50,24 Q 44,10 40,12 M 70,24 Q 76,10 80,12" stroke="#18181b" stroke-width="3" fill="none"/><circle cx="40" cy="12" r="3.5" fill="#facc15"/><circle cx="80" cy="12" r="3.5" fill="#facc15"/>`;
    } else if (outfit === "kostum-panda") {
        backAccessory = `<circle cx="34" cy="28" r="11" fill="#111"/><circle cx="86" cy="28" r="11" fill="#111"/>`;
    } else if (outfit === "helm-zirah") {
        headAccessory = `<path d="M 35,34 C 35,12 85,12 85,34 Z" fill="#94a3b8" stroke="#334155" stroke-width="2"/><path d="M 60,14 L 60,4" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>`;
    } else if (outfit === "jubah-sihir") {
        headAccessory = `<ellipse cx="60" cy="24" rx="32" ry="6" fill="#581c87"/><polygon points="42,24 62,2 78,24" fill="#6b21a8"/><rect x="44" y="19" width="32" height="4" fill="#facc15"/>`;
    } else if (outfit === "kostum-ninja") {
        headAccessory = `<rect x="35" y="26" width="50" height="7" rx="2" fill="#ef4444"/><polygon points="84,29 98,24 94,34" fill="#ef4444"/>`;
    } else if (outfit === "baju-bajak-laut") {
        headAccessory = `<path d="M 32,25 Q 60,4 88,25 Z" fill="#18181b"/><circle cx="60" cy="16" r="4" fill="#fff"/>`;
    } else if (outfit === "mahkota-emas" || outfit === "tuxedo-sultan" || outfit === "jubah-merah-raja" || outfit === "jas-berlian") {
        headAccessory = `<polygon points="40,24 40,10 50,17 60,7 70,17 80,10 80,24" fill="#facc15" stroke="#a16207" stroke-width="1.5"/><circle cx="60" cy="18" r="2.5" fill="#ef4444"/>`;
    } else if (outfit === "baju-pharaoh") {
        backAccessory = `<polygon points="34,26 24,72 96,72 86,26" fill="#0284c7" stroke="#facc15" stroke-width="2"/>`;
        headAccessory = `<rect x="42" y="18" width="36" height="6" fill="#facc15"/>`;
    } else if (outfit === "sayap-malaikat") {
        backAccessory = `<path d="M 28,60 C 4,35 2,75 26,80 Z" fill="#fff" stroke="#fde047" stroke-width="2"/><path d="M 92,60 C 116,35 118,75 94,80 Z" fill="#fff" stroke="#fde047" stroke-width="2"/>`;
        headAccessory = `<ellipse cx="60" cy="10" rx="18" ry="4" fill="none" stroke="#facc15" stroke-width="3"/>`;
    } else if (outfit === "kostum-anubis") {
        headAccessory = `<polygon points="44,24 48,4 54,24" fill="#1e293b" stroke="#facc15" stroke-width="1.5"/><polygon points="66,24 72,4 76,24" fill="#1e293b" stroke="#facc15" stroke-width="1.5"/><rect x="45" y="20" width="30" height="5" fill="#facc15"/>`;
    } else if (outfit === "kostum-naga-api") {
        headAccessory = `<polygon points="45,22 40,8 52,20" fill="#f97316"/><polygon points="75,22 80,8 68,20" fill="#f97316"/>`;
    } else if (outfit === "zirah-samurai") {
        headAccessory = `<path d="M 36,28 C 36,12 84,12 84,28 Z" fill="#991b1b"/><path d="M 46,16 L 36,6 M 74,16 L 84,6" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>`;
    } else if (outfit === "jubah-vampir") {
        backAccessory = `<polygon points="24,48 96,48 106,96 14,96" fill="#7f1d1d" stroke="#18181b" stroke-width="2"/>`;
    } else if (outfit === "halo-surgawi") {
        headAccessory = `<ellipse cx="60" cy="9" rx="22" ry="5" fill="none" stroke="#fef08a" stroke-width="4"/>`;
    } else if (outfit === "aura-listrik-thor") {
        backAccessory = `<circle cx="60" cy="64" r="46" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="8 5"/>`;
        headAccessory = `<polygon points="56,4 66,4 60,14 68,14 54,25 58,15 51,15" fill="#facc15"/>`;
    } else if (outfit === "jubah-kosmik") {
        headAccessory = `<circle cx="60" cy="11" r="7" fill="#a855f7" stroke="#38bdf8" stroke-width="2"/>`;
    } else if (outfit === "cyber-mecha") {
        headAccessory = `<rect x="57" y="6" width="6" height="16" fill="#38bdf8"/><circle cx="60" cy="6" r="4" fill="#ef4444"/>`;
    } else if (outfit === "dewa-matahari") {
        backAccessory = `<circle cx="60" cy="60" r="48" fill="none" stroke="#facc15" stroke-width="4" stroke-dasharray="5 7"/>`;
        headAccessory = `<circle cx="60" cy="12" r="8" fill="#fef08a" stroke="#ea580c" stroke-width="2"/>`;
    }

    let weaponLayer = "";
    switch (weapon) {
        case "sandal":
            weaponLayer = `<g transform="translate(92, 62) rotate(12)"><rect x="0" y="0" width="14" height="28" rx="7" fill="#38bdf8" stroke="#0284c7" stroke-width="2"/><path d="M 3,12 Q 7,6 11,12" fill="none" stroke="#fff" stroke-width="2"/></g>`;
            break;
        case "pisau":
            weaponLayer = `<g transform="translate(95, 48) rotate(10)"><rect x="3" y="26" width="5" height="14" fill="#78350f"/><polygon points="2,26 9,26 8,4 2,8" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/></g>`;
            break;
        case "palu":
            weaponLayer = `<g transform="translate(93, 44) rotate(12)"><rect x="7" y="16" width="5" height="32" fill="#92400e"/><rect x="0" y="4" width="20" height="13" rx="2" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/></g>`;
            break;
        case "ketapel":
            weaponLayer = `<g transform="translate(92, 52) rotate(10)"><path d="M 8,36 L 8,22 M 8,22 L 1,8 M 8,22 L 15,8" stroke="#92400e" stroke-width="4" stroke-linecap="round" fill="none"/><line x1="1" y1="9" x2="15" y2="9" stroke="#facc15" stroke-width="1.5"/></g>`;
            break;
        case "shuriken":
            weaponLayer = `<g transform="translate(98, 68)"><polygon points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/><circle cx="0" cy="0" r="2.5" fill="#0f172a"/></g>`;
            break;
        case "katana":
            weaponLayer = `<g transform="translate(95, 22) rotate(8)"><rect x="4" y="54" width="4" height="18" fill="#1e293b"/><rect x="0" y="52" width="12" height="3" fill="#facc15"/><path d="M 4,52 L 4,6 Q 6,0 8,6 L 8,52 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/></g>`;
            break;
        case "bazooka":
            weaponLayer = `<g transform="translate(86, 56) rotate(-12)"><rect x="0" y="4" width="32" height="12" rx="2" fill="#3f6212" stroke="#1a2e05" stroke-width="1.5"/><rect x="28" y="2" width="5" height="16" fill="#1a2e05"/></g>`;
            break;
        case "staff":
            weaponLayer = `<g transform="translate(96, 16) rotate(5)"><rect x="5" y="16" width="5" height="82" rx="2.5" fill="#78350f" stroke="#451a03" stroke-width="1.2"/><polygon points="7.5,0 15,10 7.5,20 0,10" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/><circle cx="7.5" cy="10" r="3" fill="#ffffff"/></g>`;
            break;
        case "laser":
            weaponLayer = `<g transform="translate(88, 56)"><rect x="0" y="2" width="26" height="12" rx="3" fill="#e2e8f0" stroke="#0284c7" stroke-width="1.5"/><rect x="22" y="5" width="10" height="6" fill="#38bdf8"/></g>`;
            break;
        case "thanos":
            weaponLayer = `<g transform="translate(90, 56)"><rect x="2" y="6" width="16" height="20" rx="4" fill="#facc15" stroke="#a16207" stroke-width="1.5"/><circle cx="6" cy="10" r="1.5" fill="#ef4444"/><circle cx="10" cy="9" r="1.5" fill="#3b82f6"/><circle cx="14" cy="10" r="1.5" fill="#22c55e"/></g>`;
            break;
        case "thor":
            weaponLayer = `<g transform="translate(92, 46) rotate(10)"><rect x="8" y="18" width="4" height="28" fill="#78350f"/><rect x="0" y="4" width="20" height="14" rx="2" fill="#94a3b8" stroke="#38bdf8" stroke-width="2"/></g>`;
            break;
        case "naga":
            weaponLayer = `<g transform="translate(90, 48)"><circle cx="10" cy="14" r="11" fill="#dc2626" stroke="#facc15" stroke-width="2"/><polygon points="4,5 2,-3 9,4" fill="#facc15"/><polygon points="16,5 18,-3 11,4" fill="#facc15"/><circle cx="13" cy="12" r="2" fill="#fef08a"/></g>`;
            break;
    }

    // EKSPRESI MATA & MULUT LUCU UNTUK MAKAN, MINUM, DAN MANDI
    let eyesSVG = `
        <ellipse cx="48" cy="48" rx="9" ry="11.5" fill="#ffffff" stroke="${bodyStroke}" stroke-width="2" />
        <circle cx="49" cy="48" r="4" fill="#111111" />
        <circle cx="50.5" cy="46.5" r="1.3" fill="#ffffff" />

        <ellipse cx="72" cy="48" rx="9" ry="11.5" fill="#ffffff" stroke="${bodyStroke}" stroke-width="2" />
        <circle cx="71" cy="48" r="4" fill="#111111" />
        <circle cx="72.5" cy="46.5" r="1.3" fill="#ffffff" />
    `;

    let mouthSVG = `<path d="M 52,68 Q 60,75 68,68" fill="none" stroke="#5a3311" stroke-width="3" stroke-linecap="round" />`;
    let mouthPropSVG = "";

    if (mouthState === "feed") {
        // Mulut mangap mengunyah + Burger Lucu nempel di mulut!
        mouthSVG = `
            <ellipse cx="60" cy="70" rx="10" ry="8" fill="#e11d48" stroke="#5a3311" stroke-width="2" />
            <ellipse cx="60" cy="73" rx="6" ry="3.5" fill="#fb7185" />
            <ellipse cx="38" cy="62" rx="5" ry="3" fill="rgba(244, 63, 94, 0.45)" />
            <ellipse cx="82" cy="62" rx="5" ry="3" fill="rgba(244, 63, 94, 0.45)" />
        `;
        mouthPropSVG = `
            <g transform="translate(52, 66)">
                <path d="M 0,6 Q 8,-2 16,6 Z" fill="#f59e0b" stroke="#78350f" stroke-width="1.2"/>
                <rect x="0" y="6" width="16" height="3" rx="1.5" fill="#22c55e"/>
                <rect x="0" y="9" width="16" height="3.5" rx="1.5" fill="#78350f"/>
                <path d="M 0,12.5 L 16,12.5 Q 8,17 0,12.5 Z" fill="#f59e0b" stroke="#78350f" stroke-width="1.2"/>
            </g>
        `;
    } else if (mouthState === "drink") {
        // Mulut monyong lucu nyedot minuman boba/jus di mulut!
        mouthSVG = `
            <circle cx="60" cy="70" r="5.5" fill="#e11d48" stroke="#5a3311" stroke-width="2" />
            <ellipse cx="38" cy="62" rx="5" ry="3" fill="rgba(56, 189, 248, 0.45)" />
            <ellipse cx="82" cy="62" rx="5" ry="3" fill="rgba(56, 189, 248, 0.45)" />
        `;
        mouthPropSVG = `
            <g transform="translate(58, 68)">
                <line x1="2" y1="2" x2="14" y2="14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
                <polygon points="8,12 24,12 21,30 11,30" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5"/>
                <rect x="7" y="10" width="18" height="3" rx="1.5" fill="#facc15"/>
            </g>
        `;
    } else if (mouthState === "clean") {
        // Mata merem senang (^ ^) + senyum lebar saat mandi!
        eyesSVG = `
            <path d="M 41,49 Q 48,41 55,49" fill="none" stroke="${bodyStroke}" stroke-width="3.2" stroke-linecap="round" />
            <path d="M 65,49 Q 72,41 79,49" fill="none" stroke="${bodyStroke}" stroke-width="3.2" stroke-linecap="round" />
            <ellipse cx="38" cy="58" rx="5" ry="3" fill="rgba(244, 114, 182, 0.5)" />
            <ellipse cx="82" cy="58" rx="5" ry="3" fill="rgba(244, 114, 182, 0.5)" />
        `;
        mouthSVG = `<path d="M 50,66 Q 60,77 70,66 Z" fill="#fb7185" stroke="#5a3311" stroke-width="2" />`;
    }

    const clipId = `clip-${Math.random().toString(36).substr(2, 6)}`;

    return `
    <svg viewBox="0 0 120 115" width="116" height="112" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <clipPath id="${clipId}">
                <path d="M 60,22 C 84,22 100,56 100,82 C 100,102 82,107 60,107 C 38,107 20,102 20,82 C 20,56 36,22 60,22 Z" />
            </clipPath>
        </defs>

        ${backAccessory}

        <path d="M 60,22 C 84,22 100,56 100,82 C 100,102 82,107 60,107 C 38,107 20,102 20,82 C 20,56 36,22 60,22 Z"
              fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="3.5" />

        <g clip-path="url(#${clipId})">
            ${clothesLayer}
        </g>

        <path d="M 60,22 C 84,22 100,56 100,82 C 100,102 82,107 60,107 C 38,107 20,102 20,82 C 20,56 36,22 60,22 Z"
              fill="none" stroke="${bodyStroke}" stroke-width="3.5" />

        ${eyesSVG}
        ${mouthSVG}
        ${faceAccessory}
        ${headAccessory}
        ${weaponLayer}
        ${mouthPropSVG}
    </svg>
    `;
}