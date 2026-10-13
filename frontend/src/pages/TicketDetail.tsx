import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  api,
  client,
  refresh,
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

export default function TicketDetail({ user }: { user: User }) {
  const { id } = useParams();
  const ticket = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api<Ticket>("/tickets/" + id),
  });
  const [category, setCategory] = useState("Other");
  const [priority, setPriority] = useState("Medium");
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState("");
  const t = ticket.data;
  useEffect(() => {
    if (t) {
      setCategory(t.category);
      setPriority(t.priority);
    }
  }, [t?.category, t?.priority, id]);
  useEffect(() => {
    setReply("");
    setNotice("");
  }, [id]);
  const update = (data: Ticket) => {
    client.setQueryData(["ticket", id], data);
    refresh();
  };
  const override = useMutation({
    mutationFn: () =>
      api<Ticket>("/tickets/" + id, "PATCH", { category, priority }),
    onSuccess: (data) => {
      update(data);
      setNotice(
        "Classification updated. Changes are recorded in the audit log.",
      );
    },
  });
  const draft = useMutation({
    mutationFn: () => api<Ticket>("/tickets/" + id + "/drafts", "POST"),
    onSuccess: (data) => {
      update(data);
      setNotice("Draft ready. Review it below, then use it in your reply.");
    },
  });
  const send = useMutation({
    mutationFn: () =>
      api<Ticket>("/tickets/" + id + "/reply", "POST", { body: reply }),
    onSuccess: (data) => {
      update(data);
      setNotice("Reply sent. This ticket is resolved.");
    },
    onError: () => ticket.refetch(),
  });
  if (ticket.isPending) return <Loading />;
  if (!t)
    return (
      <>
        <Link className="back" to="/tickets">
          ← Tickets
        </Link>
        <ErrorMessage error={ticket.error} />
      </>
    );
  const latest = t.drafts?.[0];
  const isAgent = user.role === "agent";
  const open = t.status === "Open";
  return (
    <>
      <Link className="back" to="/tickets">
        ← Back to tickets
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">REQUEST #{t.id.slice(0, 8)}</span>
          <h1 className="detail-title">{t.title}</h1>
          <p className="muted">
            Opened {date(t.created_at)} by {t.employee.name}
          </p>
        </div>
        {badge(t.status)}
      </div>
      {notice && (
        <div role="status" className="success">
          {notice}
        </div>
      )}
      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel section">
            <h2>Original request</h2>
            <p className="prose">{t.description}</p>
            {t.attachment && (
              <div className="attachment">
                Attachment filename: {t.attachment}
              </div>
            )}
          </section>
          {t.final_reply && (
            <section className="panel section">
              <div className="section-heading">
                <h2>Support reply</h2>
                {badge("Resolved")}
              </div>
              <p className="prose">{t.final_reply}</p>
              <small className="muted">Sent {date(t.resolved_at!)}</small>
            </section>
          )}
          {isAgent && (
            <section className="panel section ai-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">✧ KNOWLEDGE-BASE ASSIST</span>
                  <h2>AI reply draft</h2>
                </div>
                {open && (
                  <button
                    onClick={() => draft.mutate()}
                    disabled={draft.isPending}
                  >
                    {draft.isPending
                      ? "Finding guidance…"
                      : latest
                        ? "Regenerate"
                        : "Generate draft"}
                  </button>
                )}
              </div>
              <ErrorMessage error={draft.error} />
              {latest ? (
                <>
                  <p className="prose">{latest.body}</p>
                  <div className="sources">
                    <strong>Sources · {latest.citations.length}</strong>
                    {latest.citations.map((c) => (
                      <details key={c.source}>
                        <summary>{c.title}</summary>
                        <p className="prose">{c.excerpt}</p>
                        <small>{c.source}</small>
                      </details>
                    ))}
                  </div>
                  {open && (
                    <button
                      className="secondary"
                      onClick={() => {
                        if (
                          !reply.trim() ||
                          window.confirm(
                            "Replace your current reply with this draft?",
                          )
                        ) {
                          setReply(latest.body);
                          setNotice(
                            "Draft copied to the editor. Review it before sending.",
                          );
                        }
                      }}
                    >
                      Use this draft ↓
                    </button>
                  )}
                </>
              ) : (
                <p className="muted">
                  Generate a suggested reply grounded in the company knowledge
                  base. You stay in control of what gets sent.
                </p>
              )}
              {(t.drafts?.length ?? 0) > 1 && (
                <details className="history">
                  <summary>Earlier drafts ({t.drafts!.length - 1})</summary>
                  {t.drafts!.slice(1).map((d) => (
                    <div key={d.id}>
                      <small>{date(d.created_at)}</small>
                      <p className="prose">{d.body}</p>
                      <small>
                        Sources:{" "}
                        {d.citations.map((c) => c.title).join(", ") || "None"}
                      </small>
                    </div>
                  ))}
                </details>
              )}
            </section>
          )}
          {isAgent && open && (
            <form
              className="panel section"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
            >
              <h2>Your reply</h2>
              <p className="muted">
                Review the draft or write your own. Sending a reply resolves the
                ticket.
              </p>
              <label className="sr-only" htmlFor="reply">
                Reply to employee
              </label>
              <textarea
                id="reply"
                rows={8}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                required
                maxLength={10000}
                placeholder="Write a helpful reply…"
              />
              <ErrorMessage error={send.error} />
              <div className="form-actions">
                <small className="muted">
                  The original AI draft is kept for comparison.
                </small>
                <button
                  className="primary"
                  disabled={send.isPending || !reply.trim()}
                >
                  {send.isPending ? "Sending…" : "Send reply & resolve →"}
                </button>
              </div>
            </form>
          )}
        </div>
        <aside className="detail-aside">
          <section className="panel section">
            <h2>Ticket details</h2>
            <div className="requester">
              <div className="avatar">{t.employee.name[0]}</div>
              <div>
                <strong>{t.employee.name}</strong>
                <small>{t.employee.email}</small>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                override.mutate();
              }}
            >
              <label>
                Category
                <select
                  disabled={!isAgent || !open}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {options(categories)}
                </select>
              </label>
              <label>
                Priority
                <select
                  disabled={!isAgent || !open}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {options(priorities)}
                </select>
              </label>
              <div className="ai-note">
                {t.classification_status === "complete" ? (
                  <>
                    ✧ AI suggested <strong>{t.ai_category}</strong> /{" "}
                    <strong>{t.ai_priority}</strong>
                    {(t.category !== t.ai_category ||
                      t.priority !== t.ai_priority) && (
                      <p>Adjusted by an agent.</p>
                    )}
                  </>
                ) : (
                  "AI classification unavailable. Other / Medium were used as defaults."
                )}
              </div>
              {isAgent && open && (
                <button
                  className="secondary full"
                  disabled={
                    override.isPending ||
                    (category === t.category && priority === t.priority)
                  }
                >
                  {override.isPending ? "Saving…" : "Save changes"}
                </button>
              )}
              <ErrorMessage error={override.error} />
            </form>
          </section>
          {isAgent && (
            <section className="panel section">
              <h2>Override history</h2>
              {t.audit?.length ? (
                <ol className="audit">
                  {t.audit.map((a, i) => (
                    <li key={i}>
                      <strong>{a.actor}</strong>
                      <p>
                        {a.field}: {a.old_value} → {a.new_value}
                      </p>
                      <small>{date(a.created_at)}</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted">
                  No changes yet. Category and priority overrides are recorded
                  here.
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
