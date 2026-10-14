import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  api,
  client,
  setCsrf,
  ErrorMessage,
  BrandMark,
  ui,
  type Session,
} from "../shared";

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
    <div className="grid min-h-screen bg-white min-[801px]:grid-cols-[1.08fr_0.92fr]">
      <section className="relative flex min-h-[150px] flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#e8f2ec_0%,#dcebe3_100%)] p-6 text-[#264b3e] min-[801px]:p-10 min-[1101px]:p-[60px]">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full border-[55px] border-white/25" />
        <div className="absolute bottom-[-140px] left-[32%] h-80 w-80 rounded-full bg-white/20 blur-2xl" />
        <div className="flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.7px]">
          <BrandMark />
          QuickDesk
        </div>
        <div className="relative hidden min-[801px]:block">
          <span className={ui.eyebrow}>A LITTLE HELP GOES A LONG WAY</span>
          <h1 className="my-5 text-[46px] leading-[1.13] font-semibold tracking-[-2px] min-[1101px]:text-[60px]">
            Good support.
            <br />
            Better workdays.
          </h1>
          <p className="max-w-[350px] text-base leading-relaxed text-[#6c8477]">
            One place to ask for help, find answers, and get back to what
            matters.
          </p>
          <div className="mt-10 grid max-w-[470px] grid-cols-3 gap-3">
            {["Fast triage", "Clear updates", "Human review"].map(
              (item, index) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/55 bg-white/40 px-3 py-3 text-[11px] font-semibold backdrop-blur-sm"
                >
                  <span className="mb-2 block text-base text-[#39715f]">
                    {["◎", "↗", "✓"][index]}
                  </span>
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
        <small className="hidden text-[#84968b] min-[801px]:block">
          Built for people. Assisted by AI.
        </small>
      </section>
      <main className="flex items-start justify-center bg-white px-6 py-[50px] min-[801px]:items-center min-[801px]:p-[50px]">
        <div className="page-enter w-full max-w-[380px]">
          <span className={ui.eyebrow}>YOUR SUPPORT WORKSPACE</span>
          <h2 className="mb-2.5 text-[32px] font-semibold tracking-[-0.5px]">
            Welcome back
          </h2>
          <p className={ui.muted}>Sign in with your QuickDesk account.</p>
          <form
            className="mt-[35px] rounded-2xl border border-[#e5ebe8] bg-white p-5 shadow-[0_20px_50px_rgba(33,63,52,0.08)] min-[801px]:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate();
            }}
          >
            <label className={ui.label}>
              Email address
              <input
                className={ui.field}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
              />
            </label>
            <label className={ui.label}>
              Password
              <input
                className={ui.field}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <ErrorMessage error={login.error} />
            <button
              className={`${ui.primary} w-full`}
              disabled={login.isPending}
            >
              {login.isPending ? "Signing in…" : "Sign in →"}
            </button>
          </form>
          <p className="mt-6 text-center text-[11px] text-[#97a1a9]">
            Need access? Contact your support administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
