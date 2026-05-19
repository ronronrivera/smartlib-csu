import { useEffect, useState } from "react";
import { PenSquare, Eye, EyeOff } from "lucide-react";
import { updateBorrowerAccountUser } from "../../services/authService";
import { showError, showSuccess } from "../../utils/notification";
import { useStore } from "../../store/useAuthStore";
import { formatStudentId } from "../../utils/name";

const sanitizeDigitsInput = (value) => String(value || "").replace(/\D/g, "");

const Account = () => {
  const { user } = useStore();
  const [activeModal, setActiveModal] = useState(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [contactDraft, setContactDraft] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const accountEmail = user?.user?.email || user?.email || "";
  const profile = user?.profile || null;

  const openModal = (type) => {
    // Prefill each modal with current persisted values for quicker edits.
    if (type === "email") {
      setEmailDraft(accountEmail || "");
    }

    if (type === "contact") {
      setContactDraft(profile?.contactInfo || "");
    }

    if (type === "password") {
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    }

    setActiveModal(type);
  };

  const closeModal = () => {
    // Reset transient password fields on close to avoid stale sensitive input.
    setActiveModal(null);
    setOldPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  useEffect(() => {
    if (!activeModal) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  const handleUpdateEmail = async () => {
    // Uses auth service update path, which also migrates linked borrower references.
    const result = await updateBorrowerAccountUser({
      email: emailDraft
    });

    if (!result.ok) {
      showError(result.error || "Unable to update email.");
      return;
    }

    useStore.setState((state) => ({
      user: state.user
        ? {
            ...state.user,
            user: {
              ...(state.user.user || {}),
              email: emailDraft,
            },
          }
        : state.user,
    }));

    showSuccess("Email updated.");
    closeModal();
  };

  const handleUpdateContact = async () => {
    if (!/^\d+$/.test(String(contactDraft || "").trim())) {
      showError("Contact number must contain numbers only.");
      return;
    }

    const result = await updateBorrowerAccountUser({
      contactInfo: contactDraft
    });

    if (!result.ok) {
      showError(result.error || "Unable to update contact number.");
      return;
    }

    useStore.setState((state) => ({
      user: state.user
        ? {
            ...state.user,
            profile: {
              ...(state.user.profile || {}),
              contact_number: contactDraft,
            },
          }
        : state.user,
    }));

    showSuccess("Contact number updated.");
    closeModal();
  };

  const handleUpdatePassword = async () => {
    // Enforce client-side match check before service validates old password.
    if (!newPassword || !confirmNewPassword || !oldPassword) {
      showError("Please complete all password fields.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showError("New passwords do not match.");
      return;
    }

    const result = await updateBorrowerAccountUser({
      oldPassword,
      password: newPassword
    });

    if (!result.ok) {
      showError(result.error || "Unable to update password.");
      return;
    }

    showSuccess("Password updated.");
    closeModal();
  };

  if (!profile) {
    return (
      <section className="borrower-account-page">
        <div className="empty-state">Account details are unavailable.</div>
      </section>
    );
  }

  return (
    <section className="borrower-account-page">
      <div className="page-header">
        <div>
          <h2>Account</h2>
          <p className="muted">View your signup details and update account credentials.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>Profile Details</h3>
        <div className="form-row">
          <div className="form-field">
            <span className="label">First Name</span>
            <p>{user?.profile?.first_name || "-"}</p>
          </div>
          <div className="form-field">
            <span className="label">Last Name</span>
            <p>
              {user?.profile?.last_name || "-"}
            </p>
          </div>
          <div className="form-field">
            <span className="label">Suffix</span>
            <p>{profile.nameSuffix || "-"}</p>
          </div>
                    <div className="form-field">
                        <span className="label">Course</span>
                        <p>{user?.profile?.program?.split(

                            "-")[0] || "-"}</p>
                    </div>
          <div className="form-field">
            <span className="label">Year Level</span>
                        <p>{user?.profile?.program?.match(

                            /\d+/)?.[0] || "-"}</p>
                    </div>
                    <div className="form-field">
                      <span className="label">ID</span>
                      <p>{formatStudentId(user?.profile?.id_number) || "-"}</p>
                    </div>
          <div className="form-field">
            <span className="label">Address</span>
            <p>{profile?.address || "-"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: "0.75rem" }}>Update Account</h3>
        <div className="form" style={{ gap: "1rem" }}>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span className="label">Email</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <p style={{ flex: 1 }}>{accountEmail || "-"}</p>
              <button
                type="button"
                className="btn btn--ghost account-update-action"
                onClick={() => openModal("email")}
                aria-label="Change email"
              >
                <PenSquare size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span className="label">Contact Number</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <p style={{ flex: 1 }}>{profile?.contact_number || "-"}</p>
              <button
                type="button"
                className="btn btn--ghost account-update-action"
                onClick={() => openModal("contact")}
                aria-label="Change contact number"
              >
                <PenSquare size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span className="label">Password</span>
            <div>
              <button className="btn btn--primary account-update-action" onClick={() => openModal("password")}>
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeModal === "email" ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="update-email-title">
          <div className="card modal-card modal-card--account">
            <h3 id="update-email-title">Update Email</h3>
            <label className="label">New Email</label>
            <input
              className="input"
              type="email"
              value={emailDraft}
              onChange={(event) => setEmailDraft(event.target.value)}
            />
            <div className="modal-actions">
              <button className="btn btn--danger btn--cancel" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={handleUpdateEmail}>
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeModal === "contact" ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="update-contact-title">
          <div className="card modal-card modal-card--account">
            <h3 id="update-contact-title">Update Contact Number</h3>
            <label className="label">New Contact Number</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={contactDraft}
              onChange={(event) => setContactDraft(sanitizeDigitsInput(event.target.value))}
            />
            <div className="modal-actions">
              <button className="btn btn--danger btn--cancel" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={handleUpdateContact}>
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeModal === "password" ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
          <div className="card modal-card modal-card--account">
            <h3 id="change-password-title">Change Password</h3>
            <label className="label">Old Password</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                className="input"
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                style={{ paddingRight: "2.5rem" }}
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={showOldPassword ? "Hide password" : "Show password"}
              >
                {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <label className="label">New Password</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                className="input"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                style={{ paddingRight: "2.5rem" }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <label className="label">Confirm New Password</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                className="input"
                type={showConfirmNewPassword ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                style={{ paddingRight: "2.5rem" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
              >
                {showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn btn--danger btn--cancel" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={handleUpdatePassword}>
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Account;
