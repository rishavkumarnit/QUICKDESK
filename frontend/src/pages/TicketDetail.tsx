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
  ui,
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
        <Link className={ui.back} to="/tickets">
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
      <Link className={ui.back} to="/tickets">
        ← Back to tickets
      </Link>
      <div className={ui.pageHeading}>
        <div>
          <span className={ui.eyebrow}>REQUEST #{t.id.slice(0, 8)}</span>
          <h1 className="mb-3 max-w-[780px] break-words text-[25px] leading-[1.2] font-semibold tracking-[-1px] min-[801px]:text-[29px]">
            {t.title}
          </h1>
          <p className={ui.muted}>
            Opened {date(t.created_at)} by {t.employee.name}
          </p>
        </div>
        {badge(t.status)}
      </div>
      {notice && (
        <div
          role="status"
          className="my-3.5 break-words rounded-md bg-[#eaf5ee] px-4 py-3 text-xs leading-relaxed text-[#32694b]"
        >
          {notice}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 min-[801px]:grid-cols-[minmax(0,1fr)_260px] min-[1101px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-[22px]">
          <section className={`${ui.panel} p-6`}>
            <h2 className={ui.sectionHeading}>Original request</h2>
            <p className={ui.prose}>{t.description}</p>
            {t.attachment && (
              <div className="break-words rounded-[5px] bg-[#f6f8fa] p-3 text-[11px] text-[#768997]">
                Attachment filename: {t.attachment}
              </div>
            )}
          </section>
          {t.final_reply && (
            <section className={`${ui.panel} p-6`}>
              <div className="mb-[18px] flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold tracking-[-0.3px]">
                  Support reply
                </h2>
                {badge("Resolved")}
              </div>
              <p className={ui.prose}>{t.final_reply}</p>
              <small className="text-xs text-[#75818c]">
                Sent {date(t.resolved_at!)}
              </small>
            </section>
          )}
          {isAgent && (
            <section className={`${ui.panel} border-[#d4e4dc] p-6`}>
              <div className="mb-[18px] flex items-center justify-between gap-3">
                <div>
                  <span className={`${ui.eyebrow} text-[9px]`}>
                    ✧ KNOWLEDGE-BASE ASSIST
                  </span>
                  <h2 className="text-[17px] font-semibold tracking-[-0.3px]">
                    AI reply draft
                  </h2>
                </div>
                {open && (
                  <button
                    className={ui.button}
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
                  <p className={ui.prose}>{latest.body}</p>
                  <div className="my-5 border-t border-[#e8eeeb] pt-3.5 text-[11px] text-[#607e6e]">
                    <strong>Sources · {latest.citations.length}</strong>
                    {latest.citations.map((c) => (
                      <details
                        className="mt-3 rounded-md bg-[#f7faf8] p-3"
                        key={c.source}
                      >
                        <summary className="font-medium">{c.title}</summary>
                        <p className={`${ui.prose} mt-3 text-xs`}>
                          {c.excerpt}
                        </p>
                        <small>{c.source}</small>
                      </details>
                    ))}
                  </div>
                  {open && (
                    <button
                      className={ui.secondary}
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
                <p className={ui.muted}>
                  Generate a suggested reply grounded in the company knowledge
                  base. You stay in control of what gets sent.
                </p>
              )}
              {(t.drafts?.length ?? 0) > 1 && (
                <details className="mt-5 text-xs text-[#708277]">
                  <summary className="font-medium">
                    Earlier drafts ({t.drafts!.length - 1})
                  </summary>
                  {t.drafts!.slice(1).map((d) => (
                    <div
                      className="mt-4 border-t border-[#e1eae5] pt-4"
                      key={d.id}
                    >
                      <small>{date(d.created_at)}</small>
                      <p className={ui.prose}>{d.body}</p>
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
              className={`${ui.panel} p-6`}
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
            >
              <h2 className={ui.sectionHeading}>Your reply</h2>
              <p className={ui.muted}>
                Review the draft or write your own. Sending a reply resolves the
                ticket.
              </p>
              <label className="sr-only" htmlFor="reply">
                Reply to employee
              </label>
              <textarea
                className={`${ui.field} mt-0 resize-y leading-[1.7]`}
                id="reply"
                rows={8}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                required
                maxLength={10000}
                placeholder="Write a helpful reply…"
              />
              <ErrorMessage error={send.error} />
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
                <small className="text-xs text-[#75818c]">
                  The original AI draft is kept for comparison.
                </small>
                <button
                  className={ui.primary}
                  disabled={send.isPending || !reply.trim()}
                >
                  {send.isPending ? "Sending…" : "Send reply & resolve →"}
                </button>
              </div>
            </form>
          )}
        </div>
        <aside className="order-first flex min-w-0 flex-col gap-[22px] min-[801px]:order-none">
          <section className={`${ui.panel} p-5 min-[801px]:p-6`}>
            <h2 className={ui.sectionHeading}>Ticket details</h2>
            <div className="my-3 flex gap-2.5 min-[801px]:mt-5 min-[801px]:mb-[26px]">
              <div className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full bg-[#e6edea] text-[11px] font-bold text-[#466458]">
                {t.employee.name[0]}
              </div>
              <div>
                <strong className="block text-xs">{t.employee.name}</strong>
                <small className="mt-[3px] block break-words text-[10px] text-[#88939a]">
                  {t.employee.email}
                </small>
              </div>
            </div>
            <form
              className="flex flex-wrap gap-3 min-[801px]:block"
              onSubmit={(e) => {
                e.preventDefault();
                override.mutate();
              }}
            >
              <label
                className={`${ui.label} min-w-[110px] flex-1 min-[801px]:mb-[22px]`}
              >
                Category
                <select
                  className={ui.field}
                  disabled={!isAgent || !open}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {options(categories)}
                </select>
              </label>
              <label
                className={`${ui.label} min-w-[110px] flex-1 min-[801px]:mb-[22px]`}
              >
                Priority
                <select
                  className={ui.field}
                  disabled={!isAgent || !open}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {options(priorities)}
                </select>
              </label>
              <div className="my-4 w-full rounded-md bg-[#f1f7f4] p-3.5 text-[11px] leading-[1.7] text-[#587e6d]">
                {t.classification_status === "complete" ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        ✧ AI suggested <strong>{t.ai_category}</strong> /{" "}
                        <strong>{t.ai_priority}</strong>
                      </span>
                      {t.ai_confidence !== null && (
                        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[#326b58] ring-1 ring-[#d7e7df]">
                          {Math.round(t.ai_confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    {t.ai_confidence !== null && (
                      <>
                        <div
                          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dceae3]"
                          role="progressbar"
                          aria-label="AI category confidence"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(t.ai_confidence * 100)}
                        >
                          <div
                            className="h-full rounded-full bg-[#4c8874] transition-[width] duration-500"
                            style={{ width: `${t.ai_confidence * 100}%` }}
                          />
                        </div>
                        <small className="mt-1.5 block text-[9px] text-[#789087]">
                          Model-reported category confidence
                        </small>
                      </>
                    )}
                    {(t.category !== t.ai_category ||
                      t.priority !== t.ai_priority) && (
                      <p className="mt-1 mb-0">Adjusted by an agent.</p>
                    )}
                  </>
                ) : (
                  "AI classification unavailable. Other / Medium were used as defaults."
                )}
              </div>
              {isAgent && open && (
                <button
                  className={`${ui.secondary} w-full`}
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
            <section className={`${ui.panel} p-5 min-[801px]:p-6`}>
              <h2 className={ui.sectionHeading}>Override history</h2>
              {t.audit?.length ? (
                <ol className="m-0 list-none p-0">
                  {t.audit.map((a, i) => (
                    <li
                      className="border-l-2 border-[#e1eae5] pb-5 pl-[15px]"
                      key={i}
                    >
                      <strong className="text-[11px]">{a.actor}</strong>
                      <p className="my-1.5 text-[11px]">
                        {a.field}: {a.old_value} → {a.new_value}
                      </p>
                      <small className="text-[10px] text-[#96a1a8]">
                        {date(a.created_at)}
                      </small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={ui.muted}>
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
