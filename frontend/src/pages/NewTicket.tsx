import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api, refresh, ErrorMessage, ui, type Ticket } from "../shared";

export default function NewTicket() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState("");
  const create = useMutation({
    mutationFn: () =>
      api<Ticket>("/tickets", "POST", {
        title,
        description,
        attachment: attachment || null,
      }),
    onSuccess: (t) => {
      refresh();
      navigate("/tickets/" + t.id);
    },
  });
  return (
    <>
      <Link className={ui.back} to="/tickets">
        ← My tickets
      </Link>
      <div className={ui.pageHeading}>
        <div>
          <span className={ui.eyebrow}>LET’S SORT IT OUT</span>
          <h1 className={ui.heading}>How can we help?</h1>
          <p className={ui.muted}>
            A little detail helps us get you to the right answer.
          </p>
        </div>
      </div>
      <form
        className={`${ui.panel} max-w-[780px] p-5 min-[801px]:p-[30px]`}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label className={ui.label}>
          Request title
          <input
            className={ui.field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={200}
            placeholder="e.g. VPN stopped connecting after a password change"
          />
        </label>
        <label className={ui.label}>
          What’s happening?
          <textarea
            className={`${ui.field} resize-y leading-[1.7]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            maxLength={10000}
            rows={7}
            placeholder="Tell us what you’re trying to do, what went wrong, and how it affects your work."
          />
        </label>
        <label className={ui.label}>
          Attachment filename{" "}
          <span className="font-normal text-[#75818c]">(optional)</span>
          <input
            className={ui.field}
            value={attachment}
            onChange={(e) => setAttachment(e.target.value)}
            maxLength={255}
            placeholder="e.g. vpn-error.png"
          />
          <small className="mt-[7px] block font-normal text-[#8a959e]">
            Filename only for this demo. No file is uploaded.
          </small>
        </label>
        <div className="my-4 rounded-md bg-[#f1f7f4] p-3.5 text-[11px] leading-[1.7] text-[#587e6d]">
          ✧ AI will suggest a category and priority. Your support agent can
          adjust both.
        </div>
        <ErrorMessage error={create.error} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
          <Link to="/tickets">Cancel</Link>
          <button className={ui.primary} disabled={create.isPending}>
            {create.isPending
              ? "Submitting and classifying…"
              : "Submit request →"}
          </button>
        </div>
      </form>
    </>
  );
}
