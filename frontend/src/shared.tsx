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
export const badge = (value: string) => (
  <span className={"badge " + value.toLowerCase()}>{value}</span>
);
export const options = (values: string[]) =>
  values.map((v) => <option key={v}>{v}</option>);
export function ErrorMessage({ error }: { error: Error | null }) {
  return error ? (
    <div role="alert" className="error">
      {error.message}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty" role="status">
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
