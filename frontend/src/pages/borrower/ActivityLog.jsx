// Purpose: Borrower activity timeline for reservations and borrowing actions.
// Parts: source data selection, derived filters, action handlers, table/list render.
import { useEffect, useRef, useState } from "react";
import { getBorrowHistory, getBorrowRequestsByBorrower } from "../../services/bookService";
import {
  autoClosePassedReservations,
  formatReservationHour,
  getReservationHistory,
  getReservations,
  isReservationTimePassed,
  requestReservationCancellation
} from "../../services/reservationService";
import { formatDateTime } from "../../utils/dateUtils";
import { showError, showInfo, showSuccess } from "../../utils/notification";
import { RESERVATION_STATUS } from "../../constants/status";
import { formatActivityAction } from "../../utils/activityUtils";
import { useStore } from "../../store/useAuthStore";

const ActivityLog = () => {
  const { user } = useStore();
  // Use normalized current-user email to scope visible activity records.
  const userEmail = user?.email || "";

  const getUserReservationUpdates = () =>
    getReservationHistory().filter(
      (entry) => entry.requestedBy?.toLowerCase() === userEmail.toLowerCase()
    );

  const getUserActiveReservations = () => {
    autoClosePassedReservations();
    return getReservations().filter(
      (entry) =>
        entry.requestedBy?.toLowerCase() === userEmail.toLowerCase() &&
        entry.status !== RESERVATION_STATUS.CLOSED &&
        !isReservationTimePassed(entry)
    );
  };

  const getUserBorrowedHistory = () =>
    getBorrowHistory().filter(
      (entry) => entry.borrowerEmail?.toLowerCase() === userEmail.toLowerCase()
    );

  const getUserBorrowUpdates = () =>
    getBorrowRequestsByBorrower(userEmail);

  const [reservationUpdates, setReservationUpdates] = useState(
    getUserReservationUpdates
  );
  const [myReservations, setMyReservations] = useState(getUserActiveReservations);
  const [borrowUpdates, setBorrowUpdates] = useState(getUserBorrowUpdates);
  const [borrowedHistory, setBorrowedHistory] = useState(getUserBorrowedHistory);
  const cancellationTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (cancellationTimeoutRef.current) {
      clearTimeout(cancellationTimeoutRef.current);
    }
  }, []);

  const handleCancellationRequest = (id) => {
    // Ask service to mark this reservation as cancellation-requested.
    showInfo("Submitting cancellation request, please wait...");
    if (cancellationTimeoutRef.current) {
      clearTimeout(cancellationTimeoutRef.current);
    }
    // LOGIC: Match cancellation UX timing with other borrower mutations
    // (borrow/return/cancel) so feedback feels consistent across actions.
    cancellationTimeoutRef.current = setTimeout(() => {
      const result = requestReservationCancellation(id, userEmail);
      if (!result.ok) {
        showError(result.error || "Unable to request cancellation.");
        cancellationTimeoutRef.current = null;
        return;
      }
      showSuccess("Cancellation request submitted.");
      // Refresh local view from source data after successful mutation.
      setMyReservations(getUserActiveReservations());
      setReservationUpdates(getUserReservationUpdates());
      setBorrowUpdates(getUserBorrowUpdates());
      setBorrowedHistory(getUserBorrowedHistory());
      cancellationTimeoutRef.current = null;
    }, 500);
  };

  return (
    <section className="activity-log-page">
      <div className="page-header">
        <div>
          <h2>Activity Log</h2>
          <p className="muted">Track your reservation updates and borrowed books history.</p>
        </div>
      </div>

      <div className="page-header" style={{ marginTop: "1rem" }}>
        <div>
          <h2>Book Borrow Update</h2>
          <p className="muted">Track your borrow request status and release updates.</p>
        </div>
      </div>
      {borrowUpdates.length === 0 ? (
        <div className="empty-state">No borrow updates yet.</div>
      ) : (
        <div className="card table-scroll table-scroll--five activity-log-table-card">
          <div className="table table--borrow-updates">
            <div className="table__row table__head">
              <span>Book</span>
              <span>Status</span>
              <span>Requested</span>
              <span>Updated</span>
            </div>
            {borrowUpdates.map((entry) => (
              <div className="table__row" key={entry.id}>
                <span>{entry.title || "-"}</span>
                <span>{entry.status || "-"}</span>
                <span>{formatDateTime(entry.requestedAt)}</span>
                <span>{formatDateTime(entry.receivedAt || entry.requestedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginTop: "2rem" }}>
        <div>
          <h2>Books Borrowed History</h2>
          <p className="muted">History of books you borrowed or returned.</p>
        </div>
      </div>
      {borrowedHistory.length === 0 ? (
        <div className="empty-state">No borrowing history yet.</div>
      ) : (
        <div className="card table-scroll table-scroll--five activity-log-table-card">
          <div className="table table--borrow-history">
            <div className="table__row table__head">
              <span>Book</span>
              <span>Action</span>
              <span>Time</span>
            </div>
            {borrowedHistory.map((entry) => (
              <div className="table__row" key={entry.id}>
                <span>{entry.title || "-"}</span>
                <span>{formatActivityAction(entry.action)}</span>
                <span>{formatDateTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginTop: "2rem" }}>
        <div>
          <h2>Request Reservation Update</h2>
          <p className="muted">Request updates for your active reservations.</p>
        </div>
      </div>
      {myReservations.length === 0 ? (
        <div className="empty-state">No active reservations available for cancellation.</div>
      ) : (
        <div className="card table-scroll table-scroll--five activity-log-table-card">
          <div className="table table--reservation-actions">
            <div className="table__row table__head">
              <span>Room</span>
              <span>Time Slot</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {myReservations.map((entry) => (
              <div className="table__row" key={entry.id}>
                <span>{entry.room}</span>
                <span>{formatReservationHour(entry.reservationHour)}</span>
                <span>
                  {entry.cancellationRequested
                    ? "cancellation requested"
                    : entry.status}
                </span>
                <button
                  className="btn btn--danger"
                  onClick={() => handleCancellationRequest(entry.id)}
                  disabled={entry.cancellationRequested}
                >
                  {entry.cancellationRequested ? "Cancellation Requested" : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginTop: "2rem" }}>
        <div>
          <h2>Reservation History</h2>
          <p className="muted">Latest updates for your room reservation requests.</p>
        </div>
      </div>
      {reservationUpdates.length === 0 ? (
        <div className="empty-state">No reservation updates yet.</div>
      ) : (
        <div className="card table-scroll table-scroll--five activity-log-table-card">
          <div className="table table--reservation-updates">
            <div className="table__row table__head">
              <span>Room</span>
              <span>Time Slot</span>
              <span>Action</span>
              <span>Status</span>
              <span>Updated</span>
            </div>
            {reservationUpdates.map((entry) => (
              <div className="table__row" key={entry.id}>
                <span>{entry.room}</span>
                <span>{formatReservationHour(entry.reservationHour)}</span>
                <span>{formatActivityAction(entry.action)}</span>
                <span>{entry.status || "-"}</span>
                <span>{formatDateTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default ActivityLog;
