import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  api,
  client,
  setCsrf,
  ErrorMessage,
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
    <div className="grid min-h-screen min-[801px]:grid-cols-2">
      <section className="flex flex-col justify-between bg-[#e8f0eb] p-6 text-[#264b3e] min-[801px]:p-10 min-[1101px]:p-[60px]">
        <div className="flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.7px]">
          <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#22665b] pb-[5px] font-serif text-[29px] text-white">
            q
          </span>{" "}
          QuickDesk
        </div>
        <div className="hidden min-[801px]:block">
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
        </div>
        <small className="hidden text-[#84968b] min-[801px]:block">
          Built for people. Assisted by AI.
        </small>
      </section>
      <main className="flex items-start justify-center bg-white px-6 py-[50px] min-[801px]:items-center min-[801px]:p-[50px]">
        <div className="w-full max-w-[360px]">
          <span className={ui.eyebrow}>YOUR SUPPORT WORKSPACE</span>
          <h2 className="mb-2.5 text-[32px] font-semibold tracking-[-0.5px]">
            Welcome back
          </h2>
          <p className={ui.muted}>Sign in with your QuickDesk account.</p>
          <form
            className="mt-[35px]"
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
