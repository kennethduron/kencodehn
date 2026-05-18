type WhatsAppIconProps = {
  size?: number;
  className?: string;
};

export function WhatsAppIcon({ size = 20, className = "" }: WhatsAppIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.58 20.42l1.18-4.28A8.58 8.58 0 1 1 8.2 19.3l-4.62 1.12Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M3.58 20.42l1.18-4.28A8.58 8.58 0 1 1 8.2 19.3l-4.62 1.12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M8.9 7.85c.18-.4.36-.42.53-.42h.45c.14 0 .36.05.55.44.2.47.67 1.63.72 1.75.06.12.1.27.02.44-.08.17-.12.27-.25.42l-.37.44c-.12.13-.25.27-.1.52.14.25.63 1.04 1.36 1.68.94.84 1.72 1.1 1.97 1.22.25.12.4.1.55-.06.17-.2.64-.75.82-1 .18-.25.35-.2.58-.12.24.08 1.52.72 1.78.85.27.14.44.2.5.32.07.12.07.7-.16 1.36-.24.65-1.38 1.25-1.92 1.3-.5.05-1.12.07-1.8-.12-.42-.13-.95-.3-1.63-.6-2.86-1.24-4.72-4.12-4.86-4.31-.14-.2-1.16-1.54-1.16-2.95 0-1.4.73-2.1 1-2.38.25-.27.56-.35.76-.35Z"
        fill="currentColor"
      />
    </svg>
  );
}
