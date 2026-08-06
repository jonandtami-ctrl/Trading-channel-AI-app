export function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <span className={`badge ${isLive ? 'badge-live' : 'badge-demo'}`}>
      <span className="dot" />
      {isLive ? 'live' : 'demo'}
    </span>
  );
}
