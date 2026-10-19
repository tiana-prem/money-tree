export function SproutIcon({ size = 40 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="44" height="44" rx="15" fill="#c8ec8a" />
    <path d="M24 27V18m0 3C14 22 11 15 12 11c8-1 13 3 12 10Zm0-3c0-8 6-12 12-10 0 7-5 12-12 10Z" fill="#9edcb4" stroke="#18210f" strokeWidth="2" strokeLinejoin="round" />
    <path d="M14 27h20l-3 12H17l-3-12Z" fill="#c4b5fd" stroke="#18210f" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="21" cy="32" r="1.3" fill="#18210f"/><circle cx="27" cy="32" r="1.3" fill="#18210f"/><path d="M22 35q2 2 4 0" stroke="#18210f" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>;
}
