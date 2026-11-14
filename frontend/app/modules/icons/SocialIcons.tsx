
type IconProps = { size?: number; className?: string };

export function IconInstagram({ size = 18, className }: IconProps) {
  /* A fixed id, not useId(). useId is only stable across server and client
     while both render the same tree in the same order, and this icon is
     rendered from several places (site header, villa header, the mobile
     menu) — the counter drifted and hydration reported a mismatch on the
     gradient id, which React does not patch up, so the fill could end up
     pointing at an id that is not in the document.
     The gradient is a constant, so every instance can share one definition:
     url(#…) resolves to the first, and all of them are identical. */
  const id = "ig-grad";
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
      <defs>
        <radialGradient id={`${id}-1`} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="5.5" fill={`url(#${id}-1)`} />
      <rect x="4.7" y="4.7" width="14.6" height="14.6" rx="3.8" stroke="#fff" strokeWidth="1.6" fill="none" />
      <circle cx="12" cy="12" r="3.4" stroke="#fff" strokeWidth="1.6" fill="none" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="#fff" />
    </svg>
  );
}

export function IconFacebook({ size = 18, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M16.671 15.469l.55-3.585h-3.44v-2.328c0-.982.481-1.939 2.022-1.939h1.567V4.536s-1.421-.243-2.78-.243c-2.836 0-4.69 1.718-4.69 4.828v2.733H6.72v3.585h3.18v8.66a12.7 12.7 0 003.92 0v-8.66h2.85z" />
    </svg>
  );
}

export function IconLine({ size = 18, className }: IconProps) {
  return (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
      <rect width="24" height="24" rx="5" fill="#06C755" />
      <path fill="#fff" transform="translate(2.4, 3.6) scale(0.8)" d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

/** Threads — the @ loop, drawn to sit at the same optical weight as the others. */
export function IconThreads({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12.2 21c-3.1 0-5.4-1-6.9-3C4 16.3 3.3 14 3.3 11.9v0C3.3 9.7 4 7.4 5.3 5.7 6.8 3.7 9.1 2.7 12.2 2.7h.01c2.4 0 4.4.6 5.9 1.8 1.4 1.1 2.3 2.7 2.8 4.7l-1.9.5c-.8-3.4-2.9-5-6.8-5h-.01c-2.5 0-4.2.7-5.3 2.2-1 1.3-1.5 3.2-1.5 5.1s.5 3.8 1.5 5.1c1.1 1.5 2.8 2.2 5.3 2.2h.01c2.2 0 3.7-.5 4.9-1.7 1.4-1.4 1.4-3.1 1-4.1-.3-.6-.8-1.1-1.4-1.5-.2 1.1-.5 2-1.1 2.7-.7 1-1.8 1.5-3.2 1.5-1 0-2-.3-2.7-.9-.8-.7-1.3-1.7-1.3-2.8 0-2.2 1.8-3.7 4.5-3.7.9 0 1.8.1 2.5.3 0-.6-.2-1.1-.5-1.5-.4-.5-1-.7-1.8-.7-.9 0-1.6.3-2 .9l-1.6-1.1c.8-1.2 2.1-1.8 3.6-1.8 1.4 0 2.5.5 3.3 1.4.7.8 1 1.9 1.1 3.2 1.2.6 2.1 1.4 2.6 2.5.8 1.6.8 4.2-1.4 6.4-1.6 1.6-3.6 2.3-6.3 2.3zm.2-9.6c-1.6 0-2.6.7-2.6 1.8 0 .6.3 1 .6 1.3.4.3.9.5 1.5.5.8 0 1.3-.3 1.7-.8.4-.6.6-1.4.7-2.4-.6-.2-1.2-.4-1.9-.4z"
        fill="currentColor"
      />
    </svg>
  );
}

/** TikTok — the note-and-shadow mark. */
export function IconTikTok({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.6 2h-3.1v13.1a2.4 2.4 0 1 1-2.4-2.4c.2 0 .4 0 .6.1V9.6a5.6 5.6 0 1 0 4.9 5.5V8.6c1 .8 2.3 1.3 3.6 1.3V6.8a3.9 3.9 0 0 1-3.6-4.8z"
        fill="currentColor"
      />
    </svg>
  );
}
