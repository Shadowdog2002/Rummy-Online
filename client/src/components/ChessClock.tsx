interface Props {
  timeLeft: number; // ms
  isActive: boolean;
  username: string;
  clockMode?: 'turn' | 'countdown';
}

export default function ChessClock({ timeLeft, isActive, username, clockMode }: Props) {
  const seconds = timeLeft / 1000;
  const isLow = seconds <= (clockMode === 'countdown' ? 15 : 10);
  const display = seconds >= 60
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
    : seconds.toFixed(1) + 's';

  return (
    <div
      className={`
        rounded-xl px-4 py-3 flex flex-col items-center min-w-[100px]
        border-2 transition-colors
        ${isActive
          ? isLow
            ? 'bg-red-900 border-red-500 animate-pulse'
            : 'bg-yellow-900 border-yellow-400'
          : 'bg-felt-dark border-green-800 opacity-60'
        }
      `}
    >
      <span className="text-xs text-green-300 mb-1 truncate max-w-[90px] text-center">{username}</span>
      <span className={`text-2xl font-mono font-bold ${isLow && isActive ? 'text-red-400' : 'text-white'}`}>
        {display}
      </span>
      {clockMode === 'countdown' && (
        <span className="text-[10px] text-green-600 mt-0.5">total</span>
      )}
    </div>
  );
}
