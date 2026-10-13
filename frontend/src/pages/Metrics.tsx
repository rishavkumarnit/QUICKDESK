import { useQuery } from "@tanstack/react-query";
import { api, badge, ErrorMessage, Loading } from "../shared";

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
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE BIG PICTURE</span>
          <h1>Support insights</h1>
          <p className="muted">
            Understand the workload and where AI needs a human correction.
          </p>
        </div>
        <span className="period">All time</span>
      </div>
      <div className="stats">
        <div className="stat">
          <span>Total requests</span>
          <strong>{total}</strong>
          <small>Across all categories</small>
        </div>
        <div className="stat">
          <span>Open tickets</span>
          <strong>{m.statuses.Open}</strong>
          <small>Waiting for a resolution</small>
        </div>
        <div className="stat">
          <span>Median resolution</span>
          <strong>
            {m.median_resolution_hours === null
              ? "—"
              : m.median_resolution_hours < 1
                ? (m.median_resolution_hours * 60).toFixed(1) + "m"
                : m.median_resolution_hours.toFixed(1) + "h"}
          </strong>
          <small>Resolved tickets only</small>
        </div>
        <div className="stat">
          <span>AI category overrides</span>
          <strong>{m.category_override_percentage}%</strong>
          <small>
            {m.overridden_tickets} of {m.classified_tickets} classified tickets
          </small>
        </div>
      </div>
      <div className="metrics-grid">
        <section className="panel section">
          <h2>Requests by category</h2>
          <p className="muted">Based on the current ticket category.</p>
          {Object.entries(m.categories).map(([name, count]) => (
            <div className="bar-row" key={name}>
              <div>
                <span>{name}</span>
                <strong>{count}</strong>
              </div>
              <div className="bar-track">
                <div
                  style={{ width: (total ? (count / total) * 100 : 0) + "%" }}
                />
              </div>
            </div>
          ))}
        </section>
        <section className="panel section">
          <h2>Resolution overview</h2>
          <div className="resolution">
            <strong>
              {total ? Math.round((m.statuses.Resolved / total) * 100) : 0}
              <span>%</span>
            </strong>
            <p className="muted">of requests resolved</p>
          </div>
          <div className="status-count">
            <span>{badge("Open")}</span>
            <strong>{m.statuses.Open}</strong>
          </div>
          <div className="status-count">
            <span>{badge("Resolved")}</span>
            <strong>{m.statuses.Resolved}</strong>
          </div>
        </section>
      </div>
      <p className="subtle-note">
        Category override rate counts each ticket once if an agent ever changed
        its category. Tickets without an AI suggestion are excluded.
      </p>
    </>
  );
}
