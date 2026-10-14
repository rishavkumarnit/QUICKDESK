import { QueryClient } from "@tanstack/react-query";
export type User = {
  id: string;
  name: string;
  email: string;
  role: "agent" | "employee";
};
export type Draft = {
  id: string;
  body: string;
  created_at: string;
  citations: { source: string; title: string; excerpt: string }[];
};
export type Ticket = {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  priority: string;
  created_at: string;
  resolved_at: string | null;
  ai_category: string | null;
  ai_priority: string | null;
  classification_status: string;
  attachment: string | null;
  final_reply: string | null;
  employee: User;
  drafts?: Draft[];
  audit?: {
    field: string;
    old_value: string;
    new_value: string;
    actor: string;
    created_at: string;
  }[];
};
export type Session = { user: User; csrf: string };
export const categories = ["IT", "HR", "Finance", "Admin", "Other"];
export const priorities = ["Low", "Medium", "High"];
export const ui = {
  panel:
    "rounded-2xl border border-[#dde6e2] bg-white/95 shadow-[0_1px_2px_rgba(29,55,45,0.04),0_12px_32px_rgba(29,55,45,0.055)]",
  button:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[#d8e1dd] bg-white px-[15px] py-[10px] text-[13px] font-semibold shadow-sm transition-all hover:-translate-y-px hover:border-[#c4d4cd] hover:bg-[#f5f8f7] hover:shadow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d7c6c]/25",
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[#22665b] bg-[#22665b] px-[15px] py-[10px] text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(34,102,91,0.18)] transition-all hover:-translate-y-px hover:bg-[#195548] hover:shadow-[0_9px_20px_rgba(34,102,91,0.23)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d7c6c]/30 focus-visible:ring-offset-2",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[#cfe1d9] bg-[#edf6f2] px-[15px] py-[10px] text-[13px] font-semibold text-[#22665b] transition-all hover:-translate-y-px hover:border-[#b8d5c9] hover:bg-[#e4f0eb] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d7c6c]/25",
  field:
    "mt-2 block w-full rounded-lg border border-[#d8e2de] bg-white px-3.5 py-[11px] text-[13px] font-normal text-[#344553] shadow-[0_1px_2px_rgba(27,56,45,0.03)] outline-none transition placeholder:text-[#9aa5ae] hover:border-[#c8d6d0] focus:border-[#4d8174] focus:ring-3 focus:ring-[#528477]/12 disabled:bg-[#f5f7f8]",
  label: "mb-[22px] block text-xs font-semibold",
  eyebrow: "mb-3 block text-[10px] font-bold tracking-[1.7px] text-[#528477]",
  muted: "text-sm text-[#75818c]",
  heading:
    "mb-3 text-[30px] font-semibold leading-[1.15] tracking-[-1.2px] text-[#20362f] min-[801px]:text-[36px]",
  sectionHeading: "mb-4 text-[17px] font-semibold tracking-[-0.3px]",
  pageHeading:
    "mb-7 flex items-start justify-between gap-6 min-[801px]:items-center",
  back: "mb-[25px] inline-block text-xs text-[#7b8a94] hover:text-[#22665b]",
  prose:
    "whitespace-pre-wrap break-words text-[13px] leading-[1.85] text-[#526270]",
  note: "mt-6 text-[11px] leading-[1.8] text-[#8b979e]",
};
export const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 10000 } },
});
let csrf = "";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Unable to connect. Check your connection and try again.",
      0,
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== "/auth/login") {
      csrf = "";
      client.setQueryData(["session"], null);
    }
    throw new ApiError(
      typeof error.detail === "string"
        ? error.detail
        : response.status === 422
          ? "Please check the form fields."
          : "Something went wrong. Please try again.",
      response.status,
    );
  }
  return response.json();
}
export const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const badgeTone: Record<string, string> = {
  open: "bg-[#fbf3e4] text-[#986d30]",
  resolved: "bg-[#edf6f0] text-[#388366]",
  low: "bg-[#edf6f0] text-[#388366]",
  medium: "bg-[#f7f4e9] text-[#8c7949]",
  high: "bg-[#fbefef] text-[#b85858]",
};
export const badge = (value: string) => (
  <span
    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-current/10 ${badgeTone[value.toLowerCase()] ?? "bg-[#eef1f5] text-[#637484]"}`}
  >
    {value}
  </span>
);
export const options = (values: string[]) =>
  values.map((v) => <option key={v}>{v}</option>);
export function ErrorMessage({ error }: { error: Error | null }) {
  return error ? (
    <div
      role="alert"
      className="my-3.5 break-words rounded-md bg-[#fff0ef] px-4 py-3 text-xs leading-relaxed text-[#a54848]"
    >
      {error.message}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div
      className="px-6 py-[70px] text-center text-sm text-[#718078]"
      role="status"
    >
      <span className="mx-auto mb-4 block h-7 w-7 animate-spin rounded-full border-2 border-[#d9e5df] border-t-[#22665b]" />
      Loading your workspace…
    </div>
  );
}

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#22665b] text-white shadow-[0_6px_14px_rgba(34,102,91,0.22)] ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none">
        <path
          d="M6.4 5.5h11.2a2.9 2.9 0 0 1 2.9 2.9v5.2a2.9 2.9 0 0 1-2.9 2.9h-5.1l-4.2 3v-3H6.4a2.9 2.9 0 0 1-2.9-2.9V8.4a2.9 2.9 0 0 1 2.9-2.9Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8 10h8M8 13h5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
export function refresh() {
  for (const key of ["tickets", "ticket", "metrics"])
    client.invalidateQueries({ queryKey: [key] });
}

export function setCsrf(value: string) {
  csrf = value;
}
