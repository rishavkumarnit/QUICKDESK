import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api, refresh, ErrorMessage, type Ticket } from "../shared";

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
      <Link className="back" to="/tickets">
        ← My tickets
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LET’S SORT IT OUT</span>
          <h1>How can we help?</h1>
          <p className="muted">
            A little detail helps us get you to the right answer.
          </p>
        </div>
      </div>
      <form
        className="panel form-panel"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label>
          Request title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={200}
            placeholder="e.g. VPN stopped connecting after a password change"
          />
        </label>
        <label>
          What’s happening?
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            maxLength={10000}
            rows={7}
            placeholder="Tell us what you’re trying to do, what went wrong, and how it affects your work."
          />
        </label>
        <label>
          Attachment filename <span className="muted">(optional)</span>
          <input
            value={attachment}
            onChange={(e) => setAttachment(e.target.value)}
            maxLength={255}
            placeholder="e.g. vpn-error.png"
          />
          <small>Filename only for this demo. No file is uploaded.</small>
        </label>
        <div className="ai-note">
          ✧ AI will suggest a category and priority. Your support agent can
          adjust both.
        </div>
        <ErrorMessage error={create.error} />
        <div className="form-actions">
          <Link to="/tickets">Cancel</Link>
          <button className="primary" disabled={create.isPending}>
            {create.isPending
              ? "Submitting and classifying…"
              : "Submit request →"}
          </button>
        </div>
      </form>
    </>
  );
}
