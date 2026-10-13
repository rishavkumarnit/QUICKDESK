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
      <div className="empty">
        <ErrorMessage error={session.error} />
        <button onClick={() => session.refetch()}>Retry</button>
      </div>
    );
  if (!session.data) return <Login />;
  const user = session.data.user;
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand" to="/tickets">
          <span className="brand-mark">q</span> QuickDesk
        </Link>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          <NavLink to="/tickets">
            ▤{" "}
            <span>{user.role === "agent" ? "All tickets" : "My tickets"}</span>
          </NavLink>
          {user.role === "agent" && (
            <NavLink to="/metrics">
              ▥ <span>Insights</span>
            </NavLink>
          )}
          {user.role === "employee" && (
            <NavLink to="/new">
              ＋ <span>New request</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-note">
          <span>✧</span>
          <strong>A helpful second opinion</strong>
          <p>AI assists. People make the final call.</p>
        </div>
        <div className="profile">
          <div className="avatar">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <strong>{user.name}</strong>
            <small>
              {user.role === "agent" ? "Support agent" : "Employee"}
            </small>
          </div>
        </div>
        <button
          className="logout"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Sign out
        </button>
        <ErrorMessage error={logout.error} />
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span>
            Internal support <span className="slash">/</span>{" "}
            {user.role === "agent" ? "Agent workspace" : "Employee workspace"}
          </span>
          <span className={"live " + (connected ? "online" : "")}>
            <i />
            {connected ? "Live updates on" : "Reconnecting…"}
          </span>
        </header>
        <main className="content">
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
        <footer>
          QuickDesk <span>Thoughtful support, from request to resolution.</span>
        </footer>
      </div>
    </div>
  );
}
