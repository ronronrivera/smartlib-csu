import { useState } from "react";
import { PenSquare } from "lucide-react";
import { getUserProfileByEmail } from "../../services/authService";
import { showError, showSuccess } from "../../utils/notification";
import { useStore } from "../../store/useAuthStore";

const Account = () => {
  const { user } = useStore();
  const [activeModal, setActiveModal] = useState(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [contactDraft, setContactDraft] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const profile = user?.email ? getUserProfileByEmail(user.email) : null;

  const openModal = (type) => {
    // Prefill each modal with current persisted values for quicker edits.
    if (type === "email") {
      setEmailDraft(profile?.email || "");
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

  const handleUpdateEmail = () => {
    // Uses auth service update path, which also migrates linked borrower references.
    const result = updateBorrowerAccountUser({
      email: emailDraft
    });

    if (!result.ok) {
      showError(result.error || "Unable to update email.");
      return;
    }

    showSuccess("Email updated.");
    closeModal();
  };

  const handleUpdateContact = () => {
    const result = updateBorrowerAccountUser({
      contactInfo: contactDraft
    });

    if (!result.ok) {
      showError(result.error || "Unable to update contact number.");
      return;
    }

    showSuccess("Contact number updated.");
    closeModal();
  };

  const handleUpdatePassword = () => {
    // Enforce client-side match check before service validates old password.
    if (!newPassword || !confirmNewPassword || !oldPassword) {
      showError("Please complete all password fields.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showError("New passwords do not match.");
      return;
    }

    const result = updateBorrowerAccountUser({
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
            <p>{profile.firstName || "-"}</p>
          </div>
          <div className="form-field">
            <span className="label">Last Name</span>
            <p>
              {profile.lastName || "-"}
            </p>
          </div>
          <div className="form-field">
            <span className="label">Suffix</span>
            <p>{profile.nameSuffix || "-"}</p>
          </div>
          <div className="form-field">
            <span className="label">Course</span>
            <p>{profile.collegeCourse || "-"}</p>
          </div>
          <div className="form-field">
            <span className="label">Year Level</span>
            <p>{profile.yearLevel || "-"}</p>
          </div>
          <div className="form-field">
            <span className="label">ID</span>
            <p>{profile.id || "-"}</p>
          </div>
          <div className="form-field">
            <span className="label">Address</span>
            <p>{profile.currentAddress || "-"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: "0.75rem" }}>Update Account</h3>
        <div className="form" style={{ gap: "1rem" }}>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span className="label">Email</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <p style={{ flex: 1 }}>{profile.email || "-"}</p>
              <button
                type="button"
                className="btn btn--ghost"
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
              <p style={{ flex: 1 }}>{profile.contactInfo || "-"}</p>
              <button
                type="button"
                className="btn btn--ghost"
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
              <button className="btn btn--primary" onClick={() => openModal("password")}>
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeModal === "email" ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="update-email-title">
          <div className="card modal-card">
            <h3 id="update-email-title">Update Email</h3>
            <label className="label">New Email</label>
            <input
              className="input"
              type="email"
              value={emailDraft}
              onChange={(event) => setEmailDraft(event.target.value)}
            />
            <div className="modal-actions">
              <button className="btn btn--danger" onClick={closeModal}>
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
          <div className="card modal-card">
            <h3 id="update-contact-title">Update Contact Number</h3>
            <label className="label">New Contact Number</label>
            <input
              className="input"
              type="text"
              value={contactDraft}
              onChange={(event) => setContactDraft(event.target.value)}
            />
            <div className="modal-actions">
              <button className="btn btn--danger" onClick={closeModal}>
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
          <div className="card modal-card">
            <h3 id="change-password-title">Change Password</h3>
            <label className="label">Old Password</label>
            <input
              className="input"
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
            />

            <label className="label">New Password</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />

            <label className="label">Confirm New Password</label>
            <input
              className="input"
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
            />

            <div className="modal-actions">
              <button className="btn btn--danger" onClick={closeModal}>
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
