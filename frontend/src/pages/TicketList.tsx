import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  api,
  categories,
  priorities,
  options,
  date,
  badge,
  ErrorMessage,
  Loading,
  type User,
  type Ticket,
} from "../shared";

export default function TicketList({ user }: { user: User }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({
    page: String(page),
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(priority ? { priority } : {}),
  });
  const tickets = useQuery({
    queryKey: ["tickets", params.toString()],
    queryFn: () =>
      api<{ items: Ticket[]; total: number }>("/tickets?" + params),
  });
  const change = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {user.role === "agent" ? "THE SUPPORT QUEUE" : "HERE TO HELP"}
          </span>
          <h1>{user.role === "agent" ? "All tickets" : "My tickets"}</h1>
          <p className="muted">
            {user.role === "agent"
              ? "A clear view of what needs your attention."
              : "Track your requests and hear back from the team."}
          </p>
        </div>
        {user.role === "employee" && (
          <Link className="primary button" to="/new">
            ＋ New request
          </Link>
        )}
      </div>
      <div className="panel">
        <div className="filters">
          <input
            className="search"
            aria-label="Search ticket titles"
            placeholder="Search ticket titles…"
            value={search}
            onChange={(e) => change(setSearch)(e.target.value)}
          />
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => change(setStatus)(e.target.value)}
          >
            <option value="">All statuses</option>
            {options(["Open", "Resolved"])}
          </select>
          <select
            aria-label="Filter category"
            value={category}
            onChange={(e) => change(setCategory)(e.target.value)}
          >
            <option value="">All categories</option>
            {options(categories)}
          </select>
          <select
            aria-label="Filter priority"
            value={priority}
            onChange={(e) => change(setPriority)(e.target.value)}
          >
            <option value="">All priorities</option>
            {options(priorities)}
          </select>
        </div>
        <ErrorMessage error={tickets.error} />
        {tickets.isPending ? (
          <Loading />
        ) : (
          tickets.data && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>REQUEST</th>
                      <th>STATUS</th>
                      <th>CATEGORY</th>
                      <th>PRIORITY</th>
                      <th>CREATED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.data.items.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link
                            className="ticket-title"
                            to={"/tickets/" + t.id}
                          >
                            {t.title}
                          </Link>
                          <small className="ticket-id">
                            #{t.id.slice(0, 8)}
                          </small>
                        </td>
                        <td>{badge(t.status)}</td>
                        <td>{t.category}</td>
                        <td>{badge(t.priority)}</td>
                        <td className="muted nowrap">{date(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!tickets.data.items.length && (
                <div className="empty">
                  <div className="empty-icon">▤</div>
                  <h3>
                    {search || status || category || priority
                      ? "No matching tickets"
                      : "A fresh start"}
                  </h3>
                  <p className="muted">
                    {search || status || category || priority
                      ? "Try adjusting your search or filters."
                      : "New support requests will appear here."}
                  </p>
                </div>
              )}
              <div className="pagination">
                <span>
                  {tickets.data.total} requests · Page {page}
                </span>
                <div>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    ← Previous
                  </button>
                  <button
                    disabled={page * 20 >= tickets.data.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </div>
      <div className="subtle-note">
        ✧ Every AI suggestion is reviewed by a person before a reply is sent.
      </div>
    </>
  );
}
