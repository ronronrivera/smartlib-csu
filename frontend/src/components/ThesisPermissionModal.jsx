// Purpose: Modal form for thesis permission-code input and submission.
// Parts: field props, validation/error display, submit/cancel controls.
import { useEffect } from "react";
const ThesisPermissionModal = ({
  isOpen,
  code,
  error,
  onCodeChange,
  onCancel,
  onSubmit
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  // Render nothing when the thesis application flow is inactive.
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="thesis-permission-title"
      aria-describedby="thesis-permission-desc"
    >
      <div className="card modal-card">
        <h3 id="thesis-permission-title">Thesis Borrow Application</h3>
        <p id="thesis-permission-desc" className="muted">
          Enter your permission slip code to apply for this thesis.
        </p>
        <label className="label" htmlFor="thesis-permission-code">
          Permission Slip Code
        </label>
        <input
          id="thesis-permission-code"
          className="input"
          type="text"
          inputMode="numeric"
          placeholder="Enter permission slip code"
          value={code}
          // Parent owns validation/state; this component only forwards input changes.
          onChange={(event) => onCodeChange(event.target.value)}
        />
        {error ? <div className="alert">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="btn btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={onSubmit}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThesisPermissionModal;