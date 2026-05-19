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
import { formatDateTimeFull } from "../../utils/dateUtils";
import { expandReservationHistoryEntries, formatActivityAction } from "../../utils/activityUtils";
import { formatStudentId } from "../../utils/name";
import { showError, showSuccess } from "../../utils/notification";
import { exportToCSV } from "../../services/exportService";
import { useStore } from "../../store/useAuthStore";

const getReservationDisplayStatus = (entry) => {
  const status = String(entry?.status || "").toLowerCase();
  const decisionNote = String(entry?.decisionNote || entry?.decision_note || entry?.eventNote || "").toUpperCase();

  // Handle reconstructed history format (pending, approved, rejected, cancelled)
  if (status === "pending") return "Pending";
  if (status === "approved") return "Confirmed";
  if (status === "rejected" && decisionNote === "AUTO_EXPIRED") return "Timed Out";
  if (status === "rejected") return "Rejected";
  if (status === "cancelled") return "Cancelled";

  // Handle raw event format (requested, approved, expired, closed, cancelled)
  if (status === "requested") return "Pending";
  if (status === "approved") return "Confirmed";
  if (status === "expired") return "Timed Out";
  if (status === "closed") return "Room Closed";
  if (status === "cancelled") return "Cancelled";

  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "-";
};

const Reservation = () => {
  const { borrowers, getStudentBorrowers } = useStore();

  const [reservations, setReservations] = useState([]);
  const [history, setHistory] = useState([]);
  const [reservationHistorySearch, setReservationHistorySearch] = useState("");
  const [selectedReason, setSelectedReason] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStudentBorrowers();
  }, [getStudentBorrowers]);

  // Initial load and periodic refresh
  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setIsLoading(false);
      }
    })();

    // Set up interval for periodic refresh (no loading state on subsequent ticks)
    const intervalId = setInterval(() => {
      refresh().catch((err) => console.error(err));
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const studentIdByEmail = useMemo(() => {
    return (borrowers || []).reduce((summary, borrower) => {
      const email = String(borrower?.email || "").trim().toLowerCase();
      if (!email) return summary;

      summary[email] = borrower?.id_number || "-";
      return summary;
    }, {});
  }, [borrowers]);

  // Student ID is resolved from a memoized profile map to avoid repeated lookups.
  const getStudentIdByEmail = (email) =>
    formatStudentId(studentIdByEmail[String(email || "").trim().toLowerCase()] || "-");

  const refresh = async () => {
    // Keep reservations and history in sync after approve/close actions.
    try {
      await autoClosePassedReservations();
      // Force a fresh fetch for staff to avoid stale/cached borrower-scoped results
      const [reservationsData, historyData] = await Promise.all([
        getReservations(true),
        getReservationHistory(),
      ]);

      setReservations(reservationsData);
      setHistory(historyData);
    } catch (err) {
      console.error(err);
    }
  };

  // Split live reservations into pending and currently approved sections.
  const pending = useMemo(
    () => reservations
      .filter((reservation) => reservation.status === RESERVATION_STATUS.PENDING)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [reservations]
  );
  const currentReservations = useMemo(
    () => reservations
      .filter((reservation) => reservation.status === RESERVATION_STATUS.APPROVED)
      .sort((a, b) => {
        const left = a.decisionAt || a.approvedAt || a.createdAt;
        const right = b.decisionAt || b.approvedAt || b.createdAt;
        return new Date(right || 0).getTime() - new Date(left || 0).getTime();
      }),
    [reservations]
  );
  const filteredHistory = useMemo(() => {
    const query = reservationHistorySearch.trim().toLowerCase();
    const expandedHistory = (Array.isArray(history?.events) && history.events.length > 0)
      ? history.events
      : expandReservationHistoryEntries(history);
    if (!query) return expandedHistory;

    return expandedHistory.filter((entry) => {
      const searchableText = [
        entry.room,
        entry.requestedBy,
        entry.studentId,
        entry.studentName,
        entry.reservationHour,
        formatReservationHour(entry.reservationHour),
        entry.action,
        entry.status,
        entry.eventType,
        entry.eventNote,
        entry.legacyMetadataStatus,
        entry.metadata?.status,
        entry.requestedAt || entry.timestamp,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return searchableText.includes(query);
    });
  }, [history, reservationHistorySearch]);

  const handleApprove = async (id) => {
    try {
      const result = await approveReservation(id);
      if (result.ok) {
        showSuccess("Reservation approved");
        await refresh();
      } else {
        showError(result.error ?? "Failed to approve reservation.");
      }
    } catch (err) {
      console.error(err);
      showError("An error occurred while approving the reservation.");
    }
  };

  const handleClose = async (id) => {
    try {
      const result = await closeReservation(id);
      if (result.ok) {
        showSuccess("Reservation closed");
        await refresh();
      } else {
        showError(result.error ?? "Failed to close reservation.");
      }
    } catch (err) {
      console.error(err);
      showError("An error occurred while closing the reservation.");
    }
  };

  const handleHistoryExport = () => {
    // Export all reservation history events.
    const historyEvents = (Array.isArray(history?.events) && history.events.length > 0)
      ? history.events
      : expandReservationHistoryEntries(history);
    if (historyEvents.length === 0) return;
    const historyData = historyEvents.map((entry) => ({
      Room: entry.room || "-",
      Requester: entry.requestedBy || "-",
      "Student ID": formatStudentId(entry.studentId || "-"),
      "Reservation Hour": formatReservationHour(entry.reservationHour),
      Action: formatActivityAction(entry.action),
      Status: getReservationDisplayStatus(entry),
      Time: formatDateTimeFull(entry.timestamp),
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

  const getReservationReason = (reservation) => {
    const reasonValue = reservation?.notes ?? reservation?.reason ?? "";
    const normalizedReason = String(reasonValue).trim();
    return normalizedReason;
  };

  if (isLoading) {
    return (
      <section className="staff-page staff-approvals-page">
        <div className="empty-state">Loading reservations...</div>
      </section>
    );
  }

  return (
    <section className="staff-page staff-approvals-page reservation-page">
      <div className="page-header">
        <div>
          <h2>Approval</h2>
          <p className="muted">Approve or clear pending room requests.</p>
        </div>
      </div>
      {pending.length === 0 ? (
        <div className="empty-state">No reservation requests yet.</div>
      ) : (
        <div className="card staff-table-card reservation-table-wrap">
          <table className="staff-data-table">
            <colgroup>
              <col style={{ width: "10ch" }} />
              <col style={{ width: "22ch" }} />
              <col style={{ width: "12ch" }} />
              <col style={{ width: "24ch" }} />
              <col style={{ width: "11ch" }} />
              <col style={{ width: "10ch" }} />
              <col style={{ width: "10ch" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Room</th>
                <th>Time Slot</th>
                <th>ID</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((reservation) => (
                <tr key={reservation.id}>
                  <td data-label="Room">{reservation.room}</td>
                  <td data-label="Time Slot">{formatReservationHour(reservation.reservationHour)}</td>
                  <td data-label="ID">{getStudentIdByEmail(reservation.requestedBy)}</td>
                  <td data-label="Requested">{formatDateTimeFull(reservation.createdAt)}</td>
                  <td data-label="Status">{getReservationDisplayStatus(reservation)}</td>
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
        <div className="empty-state">No active reservation requests.</div>
      ) : (
        <div className="card staff-table-card reservation-table-wrap">
          <table className="staff-data-table">
            <colgroup>
              <col style={{ width: "10ch" }} />
              <col style={{ width: "22ch" }} />
              <col style={{ width: "12ch" }} />
              <col style={{ width: "24ch" }} />
              <col style={{ width: "16ch" }} />
              <col style={{ width: "24ch" }} />
              <col style={{ width: "18ch" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Room</th>
                <th>Time Slot</th>
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
                  <td data-label="ID">{getStudentIdByEmail(reservation.requestedBy)}</td>
                  <td data-label="Requested">{formatDateTimeFull(reservation.createdAt)}</td>
                  <td data-label="Status">
                    {reservation.cancellationRequested
                      ? "Confirmed · Cancellation Requested"
                      : getReservationDisplayStatus(reservation)}
                  </td>
                  <td data-label="Reason">
                    <div className="reservation-reason-cell">
                      {getReservationReason(reservation) ? (
                        <button
                          className="btn btn--view"
                          onClick={() => openReasonModal(reservation)}
                        >
                          View
                        </button>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </div>
                  </td>
                  <td data-label="Action">
                    <button
                      className="btn btn--danger"
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
          <p className="muted">All reservation updates.</p>
        </div>
        <button
          className="btn btn--ghost btn--export-soft"
          onClick={handleHistoryExport}
          disabled={history.length === 0}
        >
          Export CSV
        </button>
      </div>
      <div className="card staff-table-card reservation-table-wrap" style={{ marginBottom: "1rem" }}>
        <div className="search-input-wrapper">
          <input
            type="search"
            className="input search-input"
            placeholder="Search reservation history by room, email, ID, action, or status"
            value={reservationHistorySearch}
            onChange={(event) => setReservationHistorySearch(event.target.value)}
          />
        </div>
      </div>
      {filteredHistory.length === 0 ? (
        <div className="empty-state">No reservation request history yet.</div>
      ) : (
        <div className="card staff-table-card reservation-table-wrap">
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
              {filteredHistory.map((entry) => (
                <tr key={`${entry.id}-${entry.action}-${entry.timestamp}`}>
                  <td data-label="Room">{entry.room}</td>
                  <td data-label="Time Slot">{formatReservationHour(entry.reservationHour)}</td>
                  <td data-label="Email">{entry.requestedBy}</td>
                  <td data-label="ID">{formatStudentId(entry.studentId || getStudentIdByEmail(entry.requestedBy))}</td>
                  <td data-label="Action">{formatActivityAction(entry.action)}</td>
                  <td data-label="Status">{getReservationDisplayStatus(entry)}</td>
                  <td data-label="Time">{formatDateTimeFull(entry.timestamp)}</td>
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
              <button className="btn btn--danger" onClick={closeReasonModal}>
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
