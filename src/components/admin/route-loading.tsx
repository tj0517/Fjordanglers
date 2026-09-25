/**
 * Route-level loading state for every admin panel segment (FA-1.31).
 *
 * Rendered by each `src/app/admin/**\/loading.tsx` while the segment's page
 * is still fetching on the server. Pure presentation — no data access.
 * `role="status"` + `aria-busy` so the pending state is announced and
 * targetable in tests / screenshots.
 */
export function AdminRouteLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      data-testid="admin-route-loading"
      className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1300px] animate-pulse cursor-progress"
    >
      <div className="mb-6">
        <div className="h-2.5 w-20 rounded bg-primary/10 mb-3" />
        <div className="h-8 w-64 rounded bg-primary/15 mb-2" />
        <div className="h-3.5 w-40 rounded bg-primary/10" />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
            <div className="h-3.5 w-1/4 rounded bg-primary/10" />
            <div className="h-3.5 w-1/3 rounded bg-primary/10" />
            <div className="h-3.5 w-1/6 rounded bg-primary/10 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
