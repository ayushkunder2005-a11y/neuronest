const AuthIllustration = () => (
  <svg
    className="auth-illustration-svg"
    viewBox="0 0 520 520"
    role="img"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="deskGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f8f9ff" />
        <stop offset="100%" stopColor="#dee3ff" />
      </linearGradient>
      <linearGradient id="chairGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7667ff" />
        <stop offset="100%" stopColor="#5c55ff" />
      </linearGradient>
    </defs>

    <rect width="520" height="520" fill="none" />

    {/* subtle background */}
    <circle cx="150" cy="150" r="120" fill="#f0f3ff" />
    <circle cx="180" cy="320" r="180" fill="#eef1ff" />

    {/* shelves */}
    <rect x="20" y="80" width="180" height="8" rx="4" fill="#e0e4ff" />
    <rect x="50" y="60" width="32" height="20" rx="3" fill="#d7dbff" />
    <rect x="90" y="60" width="32" height="20" rx="3" fill="#d7dbff" />
    <rect x="130" y="60" width="32" height="20" rx="3" fill="#d7dbff" />

    <rect x="70" y="110" width="54" height="54" rx="8" fill="#ffffff" stroke="#e4e7ff" />
    <rect x="140" y="110" width="54" height="54" rx="8" fill="#ffffff" stroke="#e4e7ff" />

    {/* desk */}
    <rect x="70" y="330" width="320" height="26" rx="13" fill="#c8cff5" />
    <rect x="80" y="220" width="300" height="120" rx="18" fill="url(#deskGradient)" />
    <rect x="120" y="240" width="120" height="80" rx="10" fill="#2f2a42" />
    <rect x="130" y="250" width="100" height="60" rx="8" fill="#1e1b2e" />

    {/* keyboard */}
    <rect x="150" y="328" width="140" height="14" rx="7" fill="#fefefe" />

    {/* drawer */}
    <rect x="260" y="230" width="100" height="90" rx="12" fill="#2f2a42" />
    <rect x="270" y="242" width="80" height="16" rx="8" fill="#5c587c" />
    <rect x="270" y="268" width="80" height="16" rx="8" fill="#5c587c" />
    <rect x="270" y="294" width="80" height="16" rx="8" fill="#5c587c" />

    {/* tablet */}
    <rect x="240" y="180" width="70" height="90" rx="12" fill="#ffffff" stroke="#e0e3ff" />
    <rect x="250" y="198" width="50" height="52" rx="8" fill="#eef0ff" />

    {/* character */}
    <circle cx="205" cy="214" r="24" fill="#1f1a2c" />
    <path
      d="M190 220 C200 250 240 265 250 230"
      fill="#1f1a2c"
      stroke="#1f1a2c"
      strokeWidth="6"
    />
    <rect x="180" y="236" width="90" height="86" rx="30" fill="url(#chairGradient)" />
    <rect x="188" y="305" width="60" height="55" rx="24" fill="#1d1a30" />
    <rect x="210" y="350" width="20" height="80" rx="10" fill="#1f1a2c" />
    <rect x="235" y="350" width="20" height="80" rx="10" fill="#1f1a2c" />

    {/* plants */}
    <ellipse cx="320" cy="360" rx="36" ry="12" fill="#d0d5ff" />
    <rect x="310" y="312" width="20" height="40" rx="8" fill="#2f2a42" />
    <path
      d="M320 310 C340 280 355 240 340 230 C330 224 320 250 312 270"
      fill="#6c63ff"
    />
    <path
      d="M320 310 C300 280 285 240 300 232 C310 226 320 252 328 272"
      fill="#7385ff"
    />
  </svg>
);

export default AuthIllustration;
