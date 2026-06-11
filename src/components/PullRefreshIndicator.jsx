export default function PullRefreshIndicator({ refreshing }) {
  if (!refreshing) return null;
  return (
    <div className="lg:hidden flex justify-center py-3">
      <div
        className="w-6 h-6 rounded-full border-2 animate-spin"
        style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }}
      />
    </div>
  );
}