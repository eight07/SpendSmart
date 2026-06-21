export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              SpendSmart
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Monthly spending planner
            </h1>
          </div>
          <div className="hidden rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-right sm:block">
            <p className="text-xs font-medium text-emerald-700">Powered by</p>
            <p className="text-sm font-semibold text-emerald-950">
              RandomForestLog
            </p>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Enter plain monthly amounts and get a ready-to-use category forecast.
        </p>
      </div>
    </header>
  );
}
