export default function ProtectedLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 rounded-2xl bg-slate-200/80" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="h-28 rounded-2xl bg-slate-200/80" />
        <div className="h-28 rounded-2xl bg-slate-200/80" />
        <div className="h-28 rounded-2xl bg-slate-200/80" />
        <div className="h-28 rounded-2xl bg-slate-200/80" />
      </div>
      <div className="h-64 rounded-2xl bg-slate-200/80" />
    </div>
  );
}
