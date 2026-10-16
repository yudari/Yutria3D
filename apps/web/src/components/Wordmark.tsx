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
        <path d="M10 22 L16 10 L22 22 M12.5 18.5 H19.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-bold tracking-tight">Yutria3D</span>
    </span>
  );
}
