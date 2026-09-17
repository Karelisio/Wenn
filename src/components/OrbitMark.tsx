/** Marque Wenn (anneau + point) — même dessin que l'icône de l'app. */
export default function OrbitMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#F6C9DC" />
      <circle cx="50" cy="50" r="26" fill="none" stroke="#E0577E" strokeWidth="6.5" />
      <circle cx="67" cy="31" r="9" fill="#A13A5C" />
    </svg>
  );
}
