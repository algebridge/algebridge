import React from "react";

export function FurnitureSvgIcon({ id }: { id: string }) {
  const s = "#1e293b";
  const w = 2.5;

  switch (id) {
    case "rug":
      return (<><ellipse cx="50" cy="58" rx="44" ry="28" fill="#b45309" stroke={s} strokeWidth={w} /><ellipse cx="50" cy="58" rx="32" ry="18" fill="#d97706" stroke={s} strokeWidth={1.5} /><path d="M28 58 Q50 42 72 58" fill="none" stroke="#92400e" strokeWidth={2} /><circle cx="35" cy="55" r="4" fill="#fbbf24" opacity="0.6" /><circle cx="65" cy="55" r="4" fill="#fbbf24" opacity="0.6" /></>);
    case "plant":
      return (<><rect x="34" y="64" width="32" height="20" rx="4" fill="#ea580c" stroke={s} strokeWidth={w} /><ellipse cx="50" cy="44" rx="30" ry="24" fill="#22c55e" stroke={s} strokeWidth={w} /><circle cx="36" cy="38" r="10" fill="#4ade80" stroke={s} strokeWidth={1.5} /><circle cx="64" cy="36" r="11" fill="#16a34a" stroke={s} strokeWidth={1.5} /><circle cx="50" cy="28" r="8" fill="#86efac" stroke={s} strokeWidth={1} /></>);
    case "lamp":
      return (<><rect x="45" y="58" width="10" height="28" fill="#64748b" stroke={s} strokeWidth={w} /><path d="M22 58 L78 58 L66 22 L34 22 Z" fill="#fde047" stroke={s} strokeWidth={w} /><ellipse cx="50" cy="72" rx="20" ry="5" fill="#fef08a" opacity="0.5" /></>);
    case "poster":
      return (<><rect x="20" y="15" width="60" height="70" rx="4" fill="#fef3c7" stroke={s} strokeWidth={w} /><rect x="26" y="22" width="48" height="50" fill="#fff" stroke={s} strokeWidth={1.5} /><text x="50" y="44" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#2563eb">x=?</text><line x1="30" y1="55" x2="70" y2="55" stroke="#94a3b8" strokeWidth={2} /></>);
    case "chair":
      return (<><rect x="26" y="50" width="48" height="10" rx="4" fill="#a16207" stroke={s} strokeWidth={w} /><rect x="30" y="60" width="9" height="26" fill="#78716c" stroke={s} strokeWidth={w} /><rect x="61" y="60" width="9" height="26" fill="#78716c" stroke={s} strokeWidth={w} /><rect x="24" y="26" width="52" height="26" rx="8" fill="#eab308" stroke={s} strokeWidth={w} /><rect x="24" y="26" width="52" height="10" rx="8" fill="#fbbf24" opacity="0.5" /></>);
    case "bookshelf":
      return (<><rect x="18" y="12" width="64" height="76" rx="4" fill="#92400e" stroke={s} strokeWidth={w} /><line x1="18" y1="34" x2="82" y2="34" stroke={s} strokeWidth={2} /><line x1="18" y1="56" x2="82" y2="56" stroke={s} strokeWidth={2} />{["#ef4444","#3b82f6","#22c55e","#a855f7","#f97316","#eab308"].map((c,i)=>(<rect key={i} x={24+(i%3)*18} y={18+Math.floor(i/3)*22} width="12" height="14" fill={c} stroke={s} strokeWidth={1}/>))}</>);
    case "desk":
      return (<><rect x="12" y="48" width="76" height="10" rx="3" fill="#a16207" stroke={s} strokeWidth={w} /><rect x="18" y="58" width="8" height="24" fill="#78716c" stroke={s} strokeWidth={2} /><rect x="74" y="58" width="8" height="24" fill="#78716c" stroke={s} strokeWidth={2} /><rect x="30" y="28" width="40" height="22" rx="3" fill="#1e293b" stroke={s} strokeWidth={w} /><rect x="34" y="32" width="32" height="14" fill="#38bdf8" stroke={s} strokeWidth={1} /><circle cx="62" cy="22" r="8" fill="#fde047" stroke={s} strokeWidth={2} /><line x1="62" y1="30" x2="62" y2="48" stroke={s} strokeWidth={2} /></>);
    case "bed":
      return (<><rect x="14" y="42" width="72" height="38" rx="10" fill="#93c5fd" stroke={s} strokeWidth={w} /><rect x="14" y="42" width="72" height="14" rx="10" fill="#bfdbfe" stroke={s} strokeWidth={1.5} /><ellipse cx="28" cy="52" rx="10" ry="8" fill="#fff" stroke={s} strokeWidth={1.5} /><ellipse cx="72" cy="52" rx="10" ry="8" fill="#fff" stroke={s} strokeWidth={1.5} /><rect x="14" y="72" width="8" height="14" fill="#78716c" stroke={s} strokeWidth={1.5} /><rect x="78" y="72" width="8" height="14" fill="#78716c" stroke={s} strokeWidth={1.5} /></>);
    case "tv":
      return (<><rect x="16" y="20" width="68" height="48" rx="5" fill="#1e293b" stroke={s} strokeWidth={w} /><rect x="22" y="26" width="56" height="36" rx="2" fill="#38bdf8" stroke={s} strokeWidth={1.5} /><text x="50" y="48" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="bold">π</text><rect x="40" y="68" width="20" height="10" fill="#64748b" stroke={s} strokeWidth={1.5} /></>);
    case "telescope":
      return (<><rect x="43" y="62" width="14" height="24" fill="#64748b" stroke={s} strokeWidth={w} /><rect x="18" y="32" width="58" height="16" rx="8" fill="#475569" stroke={s} strokeWidth={w} transform="rotate(-18 47 40)" /><circle cx="74" cy="24" r="12" fill="#94a3b8" stroke={s} strokeWidth={w} /><circle cx="74" cy="24" r="6" fill="#cbd5e1" /></>);
    case "arcade":
      return (<><rect x="20" y="16" width="60" height="70" rx="8" fill="#7c3aed" stroke={s} strokeWidth={w} /><rect x="28" y="24" width="44" height="32" rx="4" fill="#1e293b" stroke={s} strokeWidth={1.5} /><text x="50" y="44" textAnchor="middle" fontSize="10" fill="#4ade80">PLAY</text><circle cx="38" cy="72" r="7" fill="#ef4444" stroke={s} strokeWidth={2} /><circle cx="62" cy="72" r="7" fill="#22c55e" stroke={s} strokeWidth={2} /></>);
    case "piano":
      return (<><rect x="12" y="32" width="76" height="52" rx="5" fill="#0f172a" stroke={s} strokeWidth={w} /><rect x="18" y="40" width="64" height="22" fill="#fff" stroke={s} strokeWidth={1} />{[0,1,2,3,4,5,6,7].map(i=>(<rect key={i} x={22+i*7.5} y={40} width={5} height={22} fill="#fff" stroke="#000" strokeWidth={0.5}/>))}<rect x="12" y="78" width="76" height="10" fill="#92400e" stroke={s} strokeWidth={1.5} /></>);
    case "aquarium":
      return (<><rect x="16" y="22" width="68" height="54" rx="5" fill="#0ea5e9" stroke={s} strokeWidth={w} opacity={0.75} /><ellipse cx="36" cy="46" rx="10" ry="6" fill="#f97316" stroke={s} strokeWidth={1.5} /><ellipse cx="60" cy="40" rx="8" ry="5" fill="#a855f7" stroke={s} strokeWidth={1.5} /><ellipse cx="48" cy="55" rx="6" ry="4" fill="#fde047" stroke={s} strokeWidth={1} /><rect x="16" y="72" width="68" height="10" fill="#64748b" stroke={s} strokeWidth={1.5} /></>);
    case "throne":
      return (<><rect x="30" y="50" width="40" height="28" rx="4" fill="#eab308" stroke={s} strokeWidth={w} /><rect x="22" y="28" width="56" height="26" rx="6" fill="#ca8a04" stroke={s} strokeWidth={w} /><circle cx="50" cy="20" r="12" fill="#fde047" stroke={s} strokeWidth={w} /><text x="50" y="24" textAnchor="middle" fontSize="10" fill="#92400e">x</text><rect x="18" y="36" width="10" height="20" fill="#a16207" stroke={s} strokeWidth={2} /><rect x="72" y="36" width="10" height="20" fill="#a16207" stroke={s} strokeWidth={2} /></>);
    case "rocket":
      return (<><path d="M50 8 L68 72 L50 60 L32 72 Z" fill="#ef4444" stroke={s} strokeWidth={w} /><circle cx="50" cy="32" r="12" fill="#38bdf8" stroke={s} strokeWidth={w} /><circle cx="50" cy="32" r="6" fill="#bae6fd" /><path d="M32 72 L20 86 L36 76 Z" fill="#f97316" stroke={s} strokeWidth={2} /><path d="M68 72 L80 86 L64 76 Z" fill="#f97316" stroke={s} strokeWidth={2} /></>);
    case "beanbag":
      return (<><ellipse cx="50" cy="60" rx="40" ry="32" fill="#8b5cf6" stroke={s} strokeWidth={w} /><ellipse cx="50" cy="52" rx="30" ry="20" fill="#a78bfa" stroke={s} strokeWidth={1.5} /><ellipse cx="42" cy="48" rx="8" ry="5" fill="#c4b5fd" opacity="0.6" /></>);
    case "clock":
      return (<><circle cx="50" cy="50" r="36" fill="#fef3c7" stroke={s} strokeWidth={w} /><circle cx="50" cy="50" r="4" fill={s} /><line x1="50" y1="50" x2="50" y2="22" stroke={s} strokeWidth={3} strokeLinecap="round" /><line x1="50" y1="50" x2="70" y2="50" stroke={s} strokeWidth={2.5} strokeLinecap="round" />{[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>(<line key={a} x1={50+32*Math.sin(a*Math.PI/180)} y1={50-32*Math.cos(a*Math.PI/180)} x2={50+28*Math.sin(a*Math.PI/180)} y2={50-28*Math.cos(a*Math.PI/180)} stroke={s} strokeWidth={1.5}/>))}</>);
    case "whiteboard":
      return (<><rect x="12" y="16" width="76" height="58" rx="4" fill="#f8fafc" stroke={s} strokeWidth={w} /><text x="50" y="40" textAnchor="middle" fontSize="13" fill="#2563eb" fontWeight="bold">y=mx+b</text><line x1="20" y1="52" x2="80" y2="52" stroke="#cbd5e1" strokeWidth={2} /><rect x="38" y="74" width="24" height="12" fill="#94a3b8" stroke={s} strokeWidth={1.5} /></>);
    case "globe":
      return (<><circle cx="50" cy="40" r="32" fill="#38bdf8" stroke={s} strokeWidth={w} /><ellipse cx="50" cy="40" rx="32" ry="12" fill="none" stroke="#166534" strokeWidth={2} /><line x1="50" y1="8" x2="50" y2="72" stroke="#166534" strokeWidth={2} /><rect x="40" y="72" width="20" height="14" fill="#64748b" stroke={s} strokeWidth={1.5} /></>);
    case "hammock":
      return (<><line x1="12" y1="18" x2="12" y2="78" stroke="#92400e" strokeWidth={5} /><line x1="88" y1="18" x2="88" y2="78" stroke="#92400e" strokeWidth={5} /><path d="M12 28 Q50 78 88 28" fill="#f472b6" stroke={s} strokeWidth={w} /><ellipse cx="50" cy="50" rx="22" ry="10" fill="#fbcfe8" stroke={s} strokeWidth={1.5} /></>);
    case "robot":
      return (<><rect x="28" y="28" width="44" height="38" rx="8" fill="#94a3b8" stroke={s} strokeWidth={w} /><circle cx="40" cy="44" r="6" fill="#38bdf8" stroke={s} strokeWidth={2} /><circle cx="60" cy="44" r="6" fill="#38bdf8" stroke={s} strokeWidth={2} /><rect x="36" y="56" width="28" height="5" rx="2" fill="#1e293b" /><rect x="36" y="66" width="12" height="22" fill="#64748b" stroke={s} strokeWidth={2} /><rect x="52" y="66" width="12" height="22" fill="#64748b" stroke={s} strokeWidth={2} /><rect x="38" y="18" width="24" height="12" rx="4" fill="#64748b" stroke={s} strokeWidth={2} /></>);
    case "chandelier":
      return (<><line x1="50" y1="6" x2="50" y2="22" stroke={s} strokeWidth={3} /><ellipse cx="50" cy="28" rx="28" ry="10" fill="#fde047" stroke={s} strokeWidth={w} />{[32,50,68].map(x=>(<g key={x}><line x1={x} y1="28" x2={x} y2="42" stroke={s} strokeWidth={1.5}/><circle cx={x} cy="48" r="7" fill="#fef08a" stroke={s} strokeWidth={2}/></g>))}</>);
    case "dragon-statue":
      return (<><ellipse cx="50" cy="58" rx="32" ry="28" fill="#22c55e" stroke={s} strokeWidth={w} /><circle cx="64" cy="36" r="20" fill="#4ade80" stroke={s} strokeWidth={w} /><circle cx="70" cy="32" r="5" fill="#ef4444" /><path d="M72 36 L90 28 L82 44 Z" fill="#22c55e" stroke={s} strokeWidth={2} /><path d="M30 50 Q20 30 28 20" fill="none" stroke="#166534" strokeWidth={3} /></>);
    case "portal":
      return (<><ellipse cx="50" cy="50" rx="38" ry="38" fill="#6366f1" stroke={s} strokeWidth={w} opacity={0.5} /><ellipse cx="50" cy="50" rx="26" ry="26" fill="#a855f7" stroke={s} strokeWidth={2.5} /><ellipse cx="50" cy="50" rx="12" ry="12" fill="#e879f9" stroke={s} strokeWidth={2} /><ellipse cx="50" cy="50" rx="4" ry="4" fill="#fff" /></>);
    case "trophy-case":
      return (<><rect x="18" y="16" width="64" height="72" rx="4" fill="#92400e" stroke={s} strokeWidth={w} /><rect x="24" y="22" width="52" height="44" fill="#38bdf8" stroke={s} strokeWidth={1.5} opacity={0.4} /><path d="M40 48 L48 32 L56 48 L52 58 Z" fill="#eab308" stroke={s} strokeWidth={2} /><rect x="42" y="58" width="16" height="8" fill="#ca8a04" stroke={s} strokeWidth={1} /></>);
    case "snack-bar":
      return (<><rect x="18" y="32" width="64" height="48" rx="6" fill="#f97316" stroke={s} strokeWidth={w} /><rect x="26" y="40" width="48" height="22" fill="#fff" stroke={s} strokeWidth={1.5} /><circle cx="36" cy="74" r="6" fill="#ef4444" stroke={s} strokeWidth={2} /><circle cx="64" cy="74" r="6" fill="#fbbf24" stroke={s} strokeWidth={2} /></>);
    case "calculator-bot":
      return (<><rect x="24" y="22" width="52" height="58" rx="8" fill="#334155" stroke={s} strokeWidth={w} /><rect x="30" y="28" width="40" height="16" fill="#4ade80" stroke={s} strokeWidth={1.5} /><text x="50" y="40" textAnchor="middle" fontSize="9" fill="#000" fontWeight="bold">42</text>{[0,1,2,3,4,5,6,7,8].map(i=>(<rect key={i} x={30+(i%3)*14} y={50+Math.floor(i/3)*12} width={11} height={9} rx={2} fill="#64748b" stroke={s} strokeWidth={0.5}/>))}</>);
    case "yoga-mat":
      return (<><rect x="18" y="38" width="64" height="32" rx="10" fill="#14b8a6" stroke={s} strokeWidth={w} /><circle cx="50" cy="54" r="12" fill="#5eead4" stroke={s} strokeWidth={2} opacity={0.5} /><line x1="30" y1="46" x2="70" y2="46" stroke="#0d9488" strokeWidth={1} opacity={0.5} /></>);
    case "lava-lamp":
      return (<><rect x="38" y="68" width="24" height="12" rx="4" fill="#64748b" stroke={s} strokeWidth={w} /><rect x="40" y="20" width="20" height="50" rx="10" fill="#1e293b" stroke={s} strokeWidth={w} opacity={0.6} /><ellipse cx="50" cy="55" rx="8" ry="12" fill="#ef4444" opacity={0.8} /><ellipse cx="50" cy="35" rx="6" ry="10" fill="#a855f7" opacity={0.8} /></>);
    case "homework-station":
      return (<><rect x="14" y="50" width="72" height="8" fill="#a16207" stroke={s} strokeWidth={w} /><rect x="20" y="58" width="6" height="22" fill="#78716c" stroke={s} strokeWidth={1.5} /><rect x="74" y="58" width="6" height="22" fill="#78716c" stroke={s} strokeWidth={1.5} /><rect x="24" y="28" width="52" height="24" fill="#fef3c7" stroke={s} strokeWidth={w} /><line x1="30" y1="36" x2="70" y2="36" stroke="#94a3b8" strokeWidth={1.5} /><line x1="30" y1="44" x2="60" y2="44" stroke="#94a3b8" strokeWidth={1.5} /><rect x="58" y="22" width="14" height="10" fill="#ef4444" stroke={s} strokeWidth={1} /></>);
    case "candy-machine":
      return (<><rect x="28" y="20" width="44" height="62" rx="22" fill="#ef4444" stroke={s} strokeWidth={w} /><rect x="34" y="28" width="32" height="24" rx="4" fill="#38bdf8" stroke={s} strokeWidth={1.5} opacity={0.6} /><circle cx="42" cy="62" r="5" fill="#fde047" stroke={s} strokeWidth={1} /><circle cx="58" cy="58" r="5" fill="#22c55e" stroke={s} strokeWidth={1} /><rect x="42" y="72" width="16" height="8" rx="2" fill="#64748b" stroke={s} strokeWidth={1} /></>);
    case "cloud-couch":
      return (<><ellipse cx="50" cy="58" rx="42" ry="22" fill="#93c5fd" stroke={s} strokeWidth={w} /><ellipse cx="30" cy="52" rx="18" ry="14" fill="#bfdbfe" stroke={s} strokeWidth={2} /><ellipse cx="70" cy="52" rx="18" ry="14" fill="#bfdbfe" stroke={s} strokeWidth={2} /><ellipse cx="50" cy="48" rx="22" ry="12" fill="#dbeafe" stroke={s} strokeWidth={1.5} /></>);
    case "disco-ball":
      return (<><line x1="50" y1="8" x2="50" y2="22" stroke={s} strokeWidth={2} /><circle cx="50" cy="48" r="30" fill="#cbd5e1" stroke={s} strokeWidth={w} />{[0,1,2,3,4,5].map(i=>(<line key={i} x1={50+30*Math.cos(i*Math.PI/3)} y1={48+30*Math.sin(i*Math.PI/3)} x2={50+30*Math.cos((i+1)*Math.PI/3)} y2={48+30*Math.sin((i+1)*Math.PI/3)} stroke={s} strokeWidth={1} opacity={0.4}/>))}<circle cx="38" cy="40" r="4" fill="#fff" opacity={0.7} /></>);
    case "neon-sign":
      return (<><rect x="10" y="30" width="80" height="36" rx="6" fill="#1e293b" stroke={s} strokeWidth={w} /><text x="50" y="54" textAnchor="middle" fontSize="14" fill="#f472b6" fontWeight="bold">MATH!</text><rect x="10" y="30" width="80" height="36" rx="6" fill="none" stroke="#a855f7" strokeWidth={2} opacity={0.6} /></>);
    case "science-lab":
      return (<><rect x="16" y="50" width="68" height="10" fill="#64748b" stroke={s} strokeWidth={w} /><rect x="22" y="58" width="6" height="20" fill="#475569" stroke={s} strokeWidth={1.5} /><rect x="72" y="58" width="6" height="20" fill="#475569" stroke={s} strokeWidth={1.5} />{[{x:28,c:"#22c55e"},{x:44,c:"#38bdf8"},{x:60,c:"#f472b6"}].map(({x,c})=>(<g key={x}><rect x={x} y="24" width="12" height="28" rx="3" fill={c} stroke={s} strokeWidth={1.5} opacity={0.7}/><ellipse cx={x+6} cy="20" rx="4" ry="6" fill={c} opacity={0.5}/></g>))}</>);
    case "golden-calculator":
      return (<><rect x="26" y="18" width="48" height="64" rx="8" fill="#eab308" stroke={s} strokeWidth={w} /><rect x="32" y="24" width="36" height="18" fill="#fef08a" stroke={s} strokeWidth={1.5} /><text x="50" y="37" textAnchor="middle" fontSize="10" fill="#92400e" fontWeight="bold">∞</text>{[0,1,2,3,4,5,6,7,8].map(i=>(<rect key={i} x={32+(i%3)*13} y={48+Math.floor(i/3)*11} width={10} height={8} rx={2} fill="#ca8a04" stroke={s} strokeWidth={0.5}/>))}</>);
    case "unicorn-statue":
      return (<><ellipse cx="50" cy="62" rx="28" ry="22" fill="#f472b6" stroke={s} strokeWidth={w} /><path d="M58 40 L72 18 L64 38 Z" fill="#fde047" stroke={s} strokeWidth={2} /><circle cx="56" cy="44" r="16" fill="#fbcfe8" stroke={s} strokeWidth={w} /><circle cx="62" cy="40" r="3" fill="#1e293b" /><path d="M38 50 Q28 30 34 18" fill="none" stroke="#a855f7" strokeWidth={3} /></>);
    case "dragon-egg":
      return (<><ellipse cx="50" cy="55" rx="26" ry="34" fill="#6366f1" stroke={s} strokeWidth={w} /><ellipse cx="42" cy="45" rx="8" ry="12" fill="#a78bfa" opacity={0.5} /><path d="M38 30 Q50 18 62 30" fill="none" stroke="#c4b5fd" strokeWidth={2} /><circle cx="50" cy="28" r="4" fill="#fde047" opacity={0.8} /></>);
    case "infinity-pool":
      return (<><rect x="10" y="40" width="80" height="40" rx="8" fill="#0ea5e9" stroke={s} strokeWidth={w} /><rect x="14" y="44" width="72" height="32" rx="6" fill="#38bdf8" stroke={s} strokeWidth={1} opacity={0.6} /><path d="M10 52 Q50 42 90 52" fill="none" stroke="#fff" strokeWidth={2} opacity={0.5} /><ellipse cx="50" cy="78" rx="42" ry="6" fill="#0284c7" opacity={0.4} /></>);
    case "time-machine":
      return (<><ellipse cx="50" cy="52" rx="36" ry="28" fill="#64748b" stroke={s} strokeWidth={w} /><ellipse cx="50" cy="52" rx="24" ry="18" fill="#94a3b8" stroke={s} strokeWidth={2} /><circle cx="50" cy="52" r="10" fill="#38bdf8" stroke={s} strokeWidth={2} /><rect x="46" y="18" width="8" height="16" fill="#475569" stroke={s} strokeWidth={2} /><circle cx="50" cy="14" r="6" fill="#fde047" stroke={s} strokeWidth={2} /></>);
    default:
      return (<><rect x="20" y="20" width="60" height="60" rx="10" fill="#e2e8f0" stroke={s} strokeWidth={w} /><text x="50" y="58" textAnchor="middle" fontSize="22">📦</text></>);
  }
}
