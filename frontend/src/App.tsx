import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Routes, Route, Navigate, NavLink, Link } from "react-router-dom";
import {
  api,
  ApiError,
  client,
  setCsrf,
  refresh,
  ErrorMessage,
  Loading,
  ui,
  type Session,
} from "./shared";
import Login from "./pages/Login";
import TicketList from "./pages/TicketList";
import NewTicket from "./pages/NewTicket";
import TicketDetail from "./pages/TicketDetail";
import Metrics from "./pages/Metrics";

export default function App() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        const data = await api<Session>("/auth/me");
        setCsrf(data.csrf);
        return data;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
  });
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!session.data) return;
    const stream = new EventSource("/api/events", { withCredentials: true });
    stream.addEventListener("ready", () => {
      setConnected(true);
      refresh();
    });
    stream.addEventListener("ticket", refresh);
    stream.onerror = () => {
      setConnected(false);
      client.invalidateQueries({ queryKey: ["session"] });
    };
    return () => {
      stream.close();
      setConnected(false);
    };
  }, [session.data?.user.id]);
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", "POST"),
    onSuccess: () => {
      setCsrf("");
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      client.setQueryData(["session"], null);
    },
  });
  if (session.isPending) return <Loading />;
  if (session.isError)
    return (
      <div className="px-6 py-[70px] text-center">
        <ErrorMessage error={session.error} />
        <button className={ui.button} onClick={() => session.refetch()}>
          Retry
        </button>
      </div>
    );
  if (!session.data) return <Login />;
  const user = session.data.user;
  return (
    <div className="min-h-screen min-[801px]:flex">
      <aside className="relative z-10 flex w-full flex-col border-b border-[#e4e9ed] bg-white p-[18px] min-[801px]:fixed min-[801px]:h-screen min-[801px]:w-[200px] min-[801px]:border-r min-[801px]:border-b-0 min-[801px]:p-[30px_20px] min-[1101px]:w-[232px]">
        <Link
          className="mb-4 flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.7px] min-[801px]:mb-12"
          to="/tickets"
        >
          <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#22665b] pb-[5px] font-serif text-[29px] text-white">
            q
          </span>{" "}
          QuickDesk
        </Link>
        <span className="mx-3 mb-3 hidden text-[9px] font-semibold tracking-[1.5px] text-[#94a0ab] min-[801px]:block">
          WORKSPACE
        </span>
        <nav className="flex flex-row gap-[5px] min-[801px]:flex-col">
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-3.5 rounded-[7px] p-2.5 text-base text-[#74808b] hover:bg-[#f2f6f4] min-[801px]:p-3 ${isActive ? "bg-[#eaf3ee] text-[#276357]" : ""}`
            }
            to="/tickets"
          >
            ▤{" "}
            <span className="text-[13px] font-medium">
              {user.role === "agent" ? "All tickets" : "My tickets"}
            </span>
          </NavLink>
          {user.role === "agent" && (
            <NavLink
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-[7px] p-2.5 text-base text-[#74808b] hover:bg-[#f2f6f4] min-[801px]:p-3 ${isActive ? "bg-[#eaf3ee] text-[#276357]" : ""}`
              }
              to="/metrics"
            >
              ▥ <span className="text-[13px] font-medium">Insights</span>
            </NavLink>
          )}
          {user.role === "employee" && (
            <NavLink
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-[7px] p-2.5 text-base text-[#74808b] hover:bg-[#f2f6f4] min-[801px]:p-3 ${isActive ? "bg-[#eaf3ee] text-[#276357]" : ""}`
              }
              to="/new"
            >
              ＋ <span className="text-[13px] font-medium">New request</span>
            </NavLink>
          )}
        </nav>
        <div className="mt-auto mb-6 hidden rounded-[9px] border border-[#e3ece6] bg-[#f5f8f6] p-4 min-[801px]:block">
          <span className="block text-2xl text-[#498976]">✧</span>
          <strong className="my-1.5 block text-xs">
            A helpful second opinion
          </strong>
          <p className="m-0 text-[11px] leading-relaxed text-[#7c8b85]">
            AI assists. People make the final call.
          </p>
        </div>
        <div className="hidden items-center gap-2.5 border-t border-[#edf0f2] pt-5 min-[801px]:flex">
          <div className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full bg-[#e6edea] text-[11px] font-bold text-[#466458]">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <strong className="block text-xs">{user.name}</strong>
            <small className="mt-[3px] block text-[10px] text-[#88939a]">
              {user.role === "agent" ? "Support agent" : "Employee"}
            </small>
          </div>
        </div>
        <button
          className="absolute top-[18px] right-5 border-0 bg-transparent p-0 text-[11px] text-[#74808b] hover:text-[#22665b] disabled:opacity-50 min-[801px]:static min-[801px]:mt-3 min-[801px]:ml-[45px] min-[801px]:self-start"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Sign out
        </button>
        <ErrorMessage error={logout.error} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col min-[801px]:ml-[200px] min-[1101px]:ml-[232px]">
        <header className="flex h-[55px] items-center justify-between border-b border-[#e4e9ed] bg-white px-[18px] text-[10px] text-[#7a8791] min-[801px]:h-[72px] min-[801px]:px-6 min-[1101px]:px-10 min-[1101px]:text-[11px]">
          <span>
            Internal support <span className="mx-[13px] text-[#c5ccd2]">/</span>{" "}
            {user.role === "agent" ? "Agent workspace" : "Employee workspace"}
          </span>
          <span className="flex items-center gap-[7px] text-[10px]">
            <i
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#58a083]" : "bg-[#d8a44a]"}`}
            />
            {connected ? "Live updates on" : "Reconnecting…"}
          </span>
        </header>
        <main className="mx-auto w-full max-w-[1450px] flex-1 px-[18px] py-7 min-[801px]:px-6 min-[1101px]:px-10 min-[1101px]:py-[42px] min-[1500px]:pt-[55px]">
          <Routes>
            <Route path="/tickets" element={<TicketList user={user} />} />
            <Route path="/tickets/:id" element={<TicketDetail user={user} />} />
            <Route
              path="/new"
              element={
                user.role === "employee" ? (
                  <NewTicket />
                ) : (
                  <Navigate to="/tickets" />
                )
              }
            />
            <Route
              path="/metrics"
              element={
                user.role === "agent" ? <Metrics /> : <Navigate to="/tickets" />
              }
            />
            <Route path="*" element={<Navigate to="/tickets" replace />} />
          </Routes>
        </main>
        <footer className="flex justify-between border-t border-[#e8edf0] p-[18px] text-[10px] text-[#94a0a8] min-[801px]:px-10 min-[801px]:py-5">
          QuickDesk{" "}
          <span className="hidden min-[801px]:inline">
            Thoughtful support, from request to resolution.
          </span>
        </footer>
      </div>
    </div>
  );
}
