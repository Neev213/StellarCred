// A clean draw-on checkmark in a ring. `run` triggers the animation (use on a
// confirmed transaction); otherwise it renders in its resting drawn state.

export function Check({ size = 56, run = false }: { size?: number; run?: boolean }) {
  return (
    <svg
      className={`check ${run ? "run" : "static"}`}
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden="true"
    >
      <circle cx="28" cy="28" r="24" />
      <path d="M18 28.5l7 7 13.5-14" />
    </svg>
  );
}
