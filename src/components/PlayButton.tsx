"use client";

interface Props {
  isPlaying: boolean;
  disabled: boolean;
  onClick: () => void;
}

export function PlayButton({ isPlaying, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPlaying ? "Pause" : "Play"}
      className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:scale-100"
    >
      {isPlaying ? (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.66L9.54 4.3A1 1 0 0 0 8 5.14Z" />
        </svg>
      )}
    </button>
  );
}
