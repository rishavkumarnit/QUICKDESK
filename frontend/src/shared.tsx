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
    "rounded-[10px] border border-[#e2e7eb] bg-white shadow-[0_2px_3px_#26364602]",
  button:
    "inline-flex items-center justify-center gap-2 rounded-[7px] border border-[#dce3e8] bg-white px-[15px] py-[10px] text-[13px] font-semibold transition-colors hover:bg-[#f2f6f7] disabled:cursor-not-allowed disabled:opacity-50",
  primary:
    "inline-flex items-center justify-center gap-2 rounded-[7px] border border-[#22665b] bg-[#22665b] px-[15px] py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-[#174e44] disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-[7px] border border-[#d2e4dd] bg-[#edf5f2] px-[15px] py-[10px] text-[13px] font-semibold text-[#22665b] transition-colors hover:bg-[#e3efeb] disabled:cursor-not-allowed disabled:opacity-50",
  field:
    "mt-2 block w-full rounded-md border border-[#dce3e8] bg-white px-3 py-[11px] text-[13px] font-normal text-[#344553] outline-offset-4 placeholder:text-[#9aa5ae] focus:border-[#528477] focus:ring-2 focus:ring-[#528477]/15 disabled:bg-[#f5f7f8]",
  label: "mb-[22px] block text-xs font-semibold",
  eyebrow: "mb-3 block text-[10px] font-bold tracking-[1.7px] text-[#528477]",
  muted: "text-sm text-[#75818c]",
  heading:
    "mb-3 text-[28px] font-semibold leading-[1.2] tracking-[-1px] min-[801px]:text-[34px]",
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
    className={`inline-flex whitespace-nowrap rounded-[5px] px-[9px] py-1 text-[10px] font-semibold ${badgeTone[value.toLowerCase()] ?? "bg-[#eef1f5] text-[#637484]"}`}
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
    <div className="px-6 py-[70px] text-center" role="status">
      Loading your workspace…
    </div>
  );
}
export function refresh() {
  for (const key of ["tickets", "ticket", "metrics"])
    client.invalidateQueries({ queryKey: [key] });
}

export function setCsrf(value: string) {
  csrf = value;
}
