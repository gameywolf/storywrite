// Penghost mascot. Body uses `currentColor`, so tint it with a text-* class
// (e.g. `text-ai` for orchid, `text-white` on a colored button).

interface Props {
  size?: number;
  className?: string;
  /** Adds a gentle bobbing animation. */
  floating?: boolean;
}

export default function Ghost({ size = 28, className = "", floating = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className={`${floating ? "animate-ghost-float" : ""} ${className}`}
    >
      <path
        d="M7 17C7 9.8 12.8 4 20 4C27.2 4 33 9.8 33 17L33 31L30 34L27 31L23.5 34L20 31L16.5 34L13 31L10 34L7 31Z"
        fill="currentColor"
      />
      {/* Eyes */}
      <ellipse cx="15" cy="17" rx="2.1" ry="2.7" fill="#3a2e1c" />
      <ellipse cx="25" cy="17" rx="2.1" ry="2.7" fill="#3a2e1c" />
      {/* Blush */}
      <ellipse cx="12.5" cy="22" rx="1.8" ry="1.1" fill="#fff" opacity="0.3" />
      <ellipse cx="27.5" cy="22" rx="1.8" ry="1.1" fill="#fff" opacity="0.3" />
    </svg>
  );
}
