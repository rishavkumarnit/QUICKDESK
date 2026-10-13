import { useQuery } from "@tanstack/react-query";
import { api, badge, ErrorMessage, Loading, ui } from "../shared";

type MetricData = {
  statuses: Record<string, number>;
  categories: Record<string, number>;
  median_resolution_hours: number | null;
  category_override_percentage: number;
  classified_tickets: number;
  overridden_tickets: number;
};
export default function Metrics() {
  const metrics = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api<MetricData>("/metrics"),
  });
  if (metrics.isPending) return <Loading />;
  if (!metrics.data) return <ErrorMessage error={metrics.error} />;
  const m = metrics.data;
  const total = Object.values(m.statuses).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className={ui.pageHeading}>
        <div>
          <span className={ui.eyebrow}>THE BIG PICTURE</span>
          <h1 className={ui.heading}>Support insights</h1>
          <p className={ui.muted}>
            Understand the workload and where AI needs a human correction.
          </p>
        </div>
        <span className="rounded-md border border-[#e1e7eb] px-4 py-[9px] text-xs text-[#7d8990]">
          All time
        </span>
      </div>
      <div className="mb-[26px] grid grid-cols-2 gap-2.5 min-[1101px]:grid-cols-4 min-[1101px]:gap-[18px]">
        <div className={`${ui.panel} p-[18px] min-[801px]:p-[22px]`}>
          <span className="text-[11px] text-[#7d8b95]">Total requests</span>
          <strong className="my-[15px] block text-[28px] font-semibold tracking-[-1px] min-[801px]:text-[33px]">
            {total}
          </strong>
          <small className="text-[10px] text-[#96a1a9]">
            Across all categories
          </small>
        </div>
        <div className={`${ui.panel} p-[18px] min-[801px]:p-[22px]`}>
          <span className="text-[11px] text-[#7d8b95]">Open tickets</span>
          <strong className="my-[15px] block text-[28px] font-semibold tracking-[-1px] min-[801px]:text-[33px]">
            {m.statuses.Open}
          </strong>
          <small className="text-[10px] text-[#96a1a9]">
            Waiting for a resolution
          </small>
        </div>
        <div className={`${ui.panel} p-[18px] min-[801px]:p-[22px]`}>
          <span className="text-[11px] text-[#7d8b95]">Median resolution</span>
          <strong className="my-[15px] block text-[28px] font-semibold tracking-[-1px] min-[801px]:text-[33px]">
            {m.median_resolution_hours === null
              ? "—"
              : m.median_resolution_hours < 1
                ? (m.median_resolution_hours * 60).toFixed(1) + "m"
                : m.median_resolution_hours.toFixed(1) + "h"}
          </strong>
          <small className="text-[10px] text-[#96a1a9]">
            Resolved tickets only
          </small>
        </div>
        <div className={`${ui.panel} p-[18px] min-[801px]:p-[22px]`}>
          <span className="text-[11px] text-[#7d8b95]">
            AI category overrides
          </span>
          <strong className="my-[15px] block text-[28px] font-semibold tracking-[-1px] min-[801px]:text-[33px]">
            {m.category_override_percentage}%
          </strong>
          <small className="text-[10px] text-[#96a1a9]">
            {m.overridden_tickets} of {m.classified_tickets} classified tickets
          </small>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 min-[801px]:grid-cols-[1.4fr_1fr]">
        <section className={`${ui.panel} p-6`}>
          <h2 className={ui.sectionHeading}>Requests by category</h2>
          <p className={ui.muted}>Based on the current ticket category.</p>
          {Object.entries(m.categories).map(([name, count]) => (
            <div className="mt-[26px] text-xs" key={name}>
              <div className="mb-[9px] flex justify-between">
                <span>{name}</span>
                <strong>{count}</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-lg bg-[#f0f4f2]">
                <div
                  className="h-full rounded-lg bg-[#60937c]"
                  style={{ width: (total ? (count / total) * 100 : 0) + "%" }}
                />
              </div>
            </div>
          ))}
        </section>
        <section className={`${ui.panel} p-6`}>
          <h2 className={ui.sectionHeading}>Resolution overview</h2>
          <div className="py-7 text-center">
            <strong className="text-7xl font-medium tracking-[-4px] text-[#326e5c]">
              {total ? Math.round((m.statuses.Resolved / total) * 100) : 0}
              <span className="text-[32px] tracking-normal">%</span>
            </strong>
            <p className="text-[11px] text-[#75818c]">of requests resolved</p>
          </div>
          <div className="flex justify-between border-t border-[#edf0f2] py-[15px] text-sm">
            <span>{badge("Open")}</span>
            <strong>{m.statuses.Open}</strong>
          </div>
          <div className="flex justify-between border-t border-[#edf0f2] py-[15px] text-sm">
            <span>{badge("Resolved")}</span>
            <strong>{m.statuses.Resolved}</strong>
          </div>
        </section>
      </div>
      <p className={ui.note}>
        Category override rate counts each ticket once if an agent ever changed
        its category. Tickets without an AI suggestion are excluded.
      </p>
    </>
  );
}
