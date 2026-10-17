export default function Wordmark(): JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        role="img"
        aria-label="Logo Yutria3D"
      >
        <rect x="2" y="2" width="28" height="28" rx="6" fill="#0f172a" />
        <path
          d="M11 9 L16 14 L21 9 M16 14 L16 23"
          stroke="#fff"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 21 L26 16 L21 11"
          stroke="#38bdf8"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg font-bold tracking-tight">Yutria3D</span>
    </span>
  );
}
