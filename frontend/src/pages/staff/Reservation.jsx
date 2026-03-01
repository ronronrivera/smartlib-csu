// Purpose: Staff reservation approvals and reservation-history management page.
// Parts: reservation datasets, formatting helpers, approve/close handlers, export/table render.
import { useEffect, useMemo, useState } from "react";
import {
  autoClosePassedReservations,
  getReservations,
  approveReservation,
  getReservationHistory,
  formatReservationHour,
  closeReservation
} from "../../services/reservationService";
import { RESERVATION_STATUS } from "../../constants/status";
import { formatDateTime } from "../../utils/dateUtils";
import { showError, showSuccess } from "../../utils/notification";
import { exportToCSV } from "../../services/exportService";
import { getUserProfileByEmail } from "../../services/authService";

const Reservation = () => {
  const [reservations, setReservations] = useState(() => {
    autoClosePassedReservations();
    return getReservations();
  });
  const [history, setHistory] = useState(getReservationHistory());
  const [selectedReason, setSelectedReason] = useState(null);
  const studentIdByEmail = useMemo(() => {
    const lookupEmails = new Set();

    reservations.forEach((entry) => {
      const email = String(entry.requestedBy || "").trim().toLowerCase();
      if (email) lookupEmails.add(email);
    });
    history.forEach((entry) => {
      const email = String(entry.requestedBy || "").trim().toLowerCase();
      if (email) lookupEmails.add(email);
    });

    return Array.from(lookupEmails).reduce((summary, email) => {
      summary[email] = getUserProfileByEmail(email)?.id || "-";
      return summary;
    }, {});
  }, [reservations, history]);

  // Student ID is resolved from a memoized profile map to avoid repeated lookups.
  const getStudentIdByEmail = (email) =>
    studentIdByEmail[String(email || "").trim().toLowerCase()] || "-";
  // Collapse legacy/raw history action strings into table-safe labels.
  const formatHistoryAction = (action) => {
    const normalizedAction = String(action || "").trim().toUpperCase();

    if (normalizedAction.includes("APPROVED")) {
      return "APPROVED";
    }

    if (normalizedAction.includes("CANCEL")) {
      return "Canceled";
    }

    if (normalizedAction.includes("CLOSED")) {
      return "CLOSED";
    }

    if (normalizedAction.includes("REQUEST") || normalizedAction.includes("CREATED")) {
      return "REQUESTED";
    }

    return "REQUESTED";
  };

  const refresh = () => {
    // Keep reservations and history in sync after approve/close actions.
    autoClosePassedReservations();
    setReservations(getReservations());
    setHistory(getReservationHistory());
  };

  useEffect(() => {
    const intervalId = setInterval(refresh, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Split live reservations into pending and currently approved sections.
  const pending = reservations.filter(
    (reservation) => reservation.status === RESERVATION_STATUS.PENDING
  );
  const currentReservations = reservations.filter(
    (reservation) => reservation.status === RESERVATION_STATUS.APPROVED
  );

  const handleApprove = (id) => {
    const result = approveReservation(id);
    if (result.ok) {
      showSuccess("Reservation approved");
      refresh();
    } else {
      showError(result.error ?? "Failed to approve reservation.");
    }
  };

  const handleClose = (id) => {
    const result = closeReservation(id);
    if (result.ok) {
      showSuccess("Reservation closed");
      refresh();
    } else {
      showError(result.error ?? "Failed to close reservation.");
    }
  };

  const handleHistoryExport = () => {
    // Export intentionally includes only the latest six rows shown in the UI.
    if (history.length === 0) return;
    const historyData = history.slice(0, 6).map((entry) => ({
      "Room": entry.room || "-",
      "Requester": entry.requestedBy || "-",
      "Reservation Hour": formatReservationHour(entry.reservationHour),
      "Date": formatDateTime(entry.reservationDate),
      "Status": entry.status || "-",
    }));
    exportToCSV(
      historyData,
      "reservation-history-latest.csv"
    );
  };

  const openReasonModal = (reservation) => {
    // Preserve only fields needed by the modal payload.
    setSelectedReason({
      room: reservation.room,
      requester: reservation.requestedBy,
      reason: reservation.notes || "No reason provided."
    });
  };

  const closeReasonModal = () => {
    setSelectedReason(null);
  };

  return (
    <section className="staff-page staff-approvals-page">
      <div className="page-header">
        <div>
          <h2>Approval</h2>
          <p className="muted">Approve or clear pending room requests.</p>
        </div>
      </div>
      {pending.length === 0 ? (
        <div className="empty-state">No pending reservations.</div>
      ) : (
        <div className="card table-scroll table-scroll--five staff-table-card">
          <table className="staff-data-table">
            <colgroup>
              <col style={{ width: "10ch" }} />
              <col style={{ width: "22ch" }} />
              <col style={{ width: "20ch" }} />
              <col style={{ width: "12ch" }} />
              <col style={{ width: "24ch" }} />
              <col style={{ width: "10ch" }} />
              <col style={{ width: "10ch" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Room</th>
                <th>Time Slot</th>
                <th>Email</th>
                <th>ID</th>
                <th>Requested</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((reservation) => (
                <tr key={reservation.id}>
                  <td data-label="Room">{reservation.room}</td>
                  <td data-label="Time Slot">{formatReservationHour(reservation.reservationHour)}</td>
                  <td data-label="Email">{reservation.requestedBy}</td>
                  <td data-label="ID">{getStudentIdByEmail(reservation.requestedBy)}</td>
                  <td data-label="Requested">{formatDateTime(reservation.createdAt)}</td>
                  <td data-label="Reason">
                    <button
                      className="btn btn--view"
                      onClick={() => openReasonModal(reservation)}
                    >
                      View
                    </button>
                  </td>
                  <td data-label="Action">
                    <button
                      className="btn btn--success"
                      onClick={() => handleApprove(reservation.id)}
                    >
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="page-header" style={{ marginTop: "2rem" }}>
        <div>
          <h2>Current Reservations</h2>
          <p className="muted">Approved reservations currently in use.</p>
        </div>
      </div>
      {currentReservations.length === 0 ? (
        <div className="empty-state">No current approved reservations.</div>
      ) : (
        <div className="card table-scroll table-scroll--five staff-table-card">
          <table className="staff-data-table">
            <colgroup>
              <col style={{ width: "10ch" }} />
              <col style={{ width: "22ch" }} />
              <col style={{ width: "20ch" }} />
              <col style={{ width: "12ch" }} />
              <col style={{ width: "24ch" }} />
              <col style={{ width: "18ch" }} />
              <col style={{ width: "10ch" }} />
              <col style={{ width: "10ch" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Room</th>
                <th>Time Slot</th>
                <th>Email</th>
                <th>ID</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentReservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td data-label="Room">{reservation.room}</td>
                  <td data-label="Time Slot">{formatReservationHour(reservation.reservationHour)}</td>
                  <td data-label="Email">{reservation.requestedBy}</td>
                  <td data-label="ID">{getStudentIdByEmail(reservation.requestedBy)}</td>
                  <td data-label="Requested">{formatDateTime(reservation.createdAt)}</td>
                  <td data-label="Status">
                    {reservation.cancellationRequested
                      ? "approved · cancellation requested"
                      : reservation.status}
                  </td>
                  <td data-label="Reason">
                    <button
                      className="btn btn--view"
                      onClick={() => openReasonModal(reservation)}
                    >
                      View
                    </button>
                  </td>
                  <td data-label="Action">
                    <button
                      className="btn btn--secondary"
                      onClick={() => handleClose(reservation.id)}
                    >
                      Close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="page-header" style={{ marginTop: "2rem" }}>
        <div>
          <h2>Reservation History</h2>
          <p className="muted">Latest 6 reservation updates.</p>
        </div>
        <button
          className="btn btn--ghost"
          onClick={handleHistoryExport}
          disabled={history.length === 0}
        >
          Export CSV
        </button>
      </div>
      {history.length === 0 ? (
        <div className="empty-state">No reservation history yet.</div>
      ) : (
        <div className="card table-scroll table-scroll--five staff-table-card">
          <table className="staff-data-table">
            <colgroup>
              <col style={{ width: "10ch" }} />
              <col style={{ width: "22ch" }} />
              <col style={{ width: "20ch" }} />
              <col style={{ width: "12ch" }} />
              <col style={{ width: "11ch" }} />
              <col style={{ width: "14ch" }} />
              <col style={{ width: "24ch" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Room</th>
                <th>Time Slot</th>
                <th>Email</th>
                <th>ID</th>
                <th>Action</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 6).map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Room">{entry.room}</td>
                  <td data-label="Time Slot">{formatReservationHour(entry.reservationHour)}</td>
                  <td data-label="Email">{entry.requestedBy}</td>
                  <td data-label="ID">{getStudentIdByEmail(entry.requestedBy)}</td>
                  <td data-label="Action">{formatHistoryAction(entry.action)}</td>
                  <td data-label="Status">{entry.status}</td>
                  <td data-label="Time">{formatDateTime(entry.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedReason ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="card modal-card modal-card--reason-details">
            <h3>Reservation Reason</h3>
            <p>
              <strong>Room:</strong> {selectedReason.room || "-"}
            </p>
            <p>
              <strong>Email:</strong> {selectedReason.requester || "-"}
            </p>
            <p>
              <strong>Reason:</strong> {selectedReason.reason}
            </p>
            <div className="modal-actions">
              <button className="btn btn--secondary" onClick={closeReasonModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Reservation;
