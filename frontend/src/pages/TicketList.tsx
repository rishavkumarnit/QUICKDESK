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
  ui,
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
      <div className={ui.pageHeading}>
        <div>
          <span className={ui.eyebrow}>
            {user.role === "agent" ? "THE SUPPORT QUEUE" : "HERE TO HELP"}
          </span>
          <h1 className={ui.heading}>
            {user.role === "agent" ? "All tickets" : "My tickets"}
          </h1>
          <p className={ui.muted}>
            {user.role === "agent"
              ? "A clear view of what needs your attention."
              : "Track your requests and hear back from the team."}
          </p>
        </div>
        {user.role === "employee" && (
          <Link
            className={`${ui.primary} p-2.5 text-[11px] min-[801px]:px-[15px] min-[801px]:text-[13px]`}
            to="/new"
          >
            ＋ New request
          </Link>
        )}
      </div>
      <div className={ui.panel}>
        <div className="flex flex-wrap gap-1.5 border-b border-[#e9edf0] p-3 min-[1101px]:gap-2.5 min-[1101px]:p-[18px]">
          <input
            className={`${ui.field} mt-0 min-w-[130px] basis-full min-[1101px]:flex-1 min-[1101px]:basis-auto`}
            aria-label="Search ticket titles"
            placeholder="Search ticket titles…"
            value={search}
            onChange={(e) => change(setSearch)(e.target.value)}
          />
          <select
            className={`${ui.field} mt-0 min-w-0 flex-1 text-xs min-[1101px]:w-auto min-[1101px]:min-w-[125px] min-[1101px]:flex-none`}
            aria-label="Filter status"
            value={status}
            onChange={(e) => change(setStatus)(e.target.value)}
          >
            <option value="">All statuses</option>
            {options(["Open", "Resolved"])}
          </select>
          <select
            className={`${ui.field} mt-0 min-w-0 flex-1 text-xs min-[1101px]:w-auto min-[1101px]:min-w-[125px] min-[1101px]:flex-none`}
            aria-label="Filter category"
            value={category}
            onChange={(e) => change(setCategory)(e.target.value)}
          >
            <option value="">All categories</option>
            {options(categories)}
          </select>
          <select
            className={`${ui.field} mt-0 min-w-0 flex-1 text-xs min-[1101px]:w-auto min-[1101px]:min-w-[125px] min-[1101px]:flex-none`}
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
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr>
                      {[
                        "REQUEST",
                        "STATUS",
                        "CATEGORY",
                        "PRIORITY",
                        "CREATED",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="border-b border-[#e8edf0] bg-[#fafbfc] px-5 py-[15px] text-[9px] font-semibold tracking-[1px] text-[#8c98a2]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.data.items.map((t) => (
                      <tr className="hover:bg-[#fbfdfc]" key={t.id}>
                        <td className="border-b border-[#edf0f2] p-5">
                          <Link
                            className="block max-w-[440px] text-[13px] font-semibold hover:text-[#22665b] hover:underline"
                            to={"/tickets/" + t.id}
                          >
                            {t.title}
                          </Link>
                          <small className="mt-[7px] block text-[10px] text-[#97a3ab]">
                            #{t.id.slice(0, 8)}
                          </small>
                        </td>
                        <td className="border-b border-[#edf0f2] p-5">
                          {badge(t.status)}
                        </td>
                        <td className="border-b border-[#edf0f2] p-5">
                          {t.category}
                        </td>
                        <td className="border-b border-[#edf0f2] p-5">
                          {badge(t.priority)}
                        </td>
                        <td className="whitespace-nowrap border-b border-[#edf0f2] p-5 text-[11px] text-[#75818c] min-[801px]:text-sm">
                          {date(t.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!tickets.data.items.length && (
                <div className="px-6 py-[70px] text-center">
                  <div className="mb-5 text-3xl text-[#91a79b]">▤</div>
                  <h3 className="mb-3 text-lg font-semibold">
                    {search || status || category || priority
                      ? "No matching tickets"
                      : "A fresh start"}
                  </h3>
                  <p className={ui.muted}>
                    {search || status || category || priority
                      ? "Try adjusting your search or filters."
                      : "New support requests will appear here."}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between p-3 text-[11px] text-[#8a969e] min-[801px]:px-5 min-[801px]:py-4">
                <span>
                  {tickets.data.total} requests · Page {page}
                </span>
                <div className="flex gap-2">
                  <button
                    className={`${ui.button} px-3 py-[7px] text-[11px]`}
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    ← Previous
                  </button>
                  <button
                    className={`${ui.button} px-3 py-[7px] text-[11px]`}
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
      <div className={ui.note}>
        ✧ Every AI suggestion is reviewed by a person before a reply is sent.
      </div>
    </>
  );
}
