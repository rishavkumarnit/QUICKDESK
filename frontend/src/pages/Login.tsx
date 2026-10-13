import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, client, setCsrf, ErrorMessage, type Session } from "../shared";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => api<Session>("/auth/login", "POST", { email, password }),
    onSuccess: (session) => {
      setCsrf(session.csrf);
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      client.setQueryData(["session"], session);
    },
  });
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">q</span> QuickDesk
        </div>
        <div>
          <span className="eyebrow">A LITTLE HELP GOES A LONG WAY</span>
          <h1>
            Good support.
            <br />
            Better workdays.
          </h1>
          <p>
            One place to ask for help, find answers, and get back to what
            matters.
          </p>
        </div>
        <small>Built for people. Assisted by AI.</small>
      </section>
      <main className="login-form">
        <div>
          <span className="eyebrow">YOUR SUPPORT WORKSPACE</span>
          <h2>Welcome back</h2>
          <p className="muted">Sign in with your QuickDesk account.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate();
            }}
          >
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <ErrorMessage error={login.error} />
            <button className="primary full" disabled={login.isPending}>
              {login.isPending ? "Signing in…" : "Sign in →"}
            </button>
          </form>
          <p className="hint">
            Need access? Contact your support administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
