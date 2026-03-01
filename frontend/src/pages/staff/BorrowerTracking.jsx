// Purpose: Staff borrower monitoring with active records and history export.
// Parts: pending borrow requests, current borrower table, history export table.
import { useState } from "react";
import {
  getBooks,
  getBorrowHistory,
  getBorrowRequests,
  receiveBorrowRequest,
  receiveReturnRequest
} from "../../services/bookService";
import { exportToCSV } from "../../services/exportService";
import { formatDateTime, formatDateTimeFull } from "../../utils/dateUtils";
import { showError, showSuccess } from "../../utils/notification";
import { getUserProfileByEmail } from "../../services/authService";

const BorrowerTracking = () => {
  const [books, setBooks] = useState(() => getBooks());
  const [history, setHistory] = useState(() => getBorrowHistory());
  const [borrowRequests, setBorrowRequests] = useState(() => getBorrowRequests());
  const getStudentIdByEmail = (email) =>
    getUserProfileByEmail(email)?.id || "-";
  const formatHistoryAction = (action) => String(action || "-").replace(/_/g, " ");

  const pendingRequests = borrowRequests.filter((entry) => entry.status === "pending");
  const pendingReturnRequestByBookAndUser = borrowRequests
    .filter((entry) => entry.status === "pending_return")
    .reduce((summary, entry) => {
      const key = `${entry.bookId}-${String(entry.borrowerEmail || "").toLowerCase()}`;
      summary[key] = entry;
      return summary;
    }, {});

  const currentBorrowers = books
    .filter((book) => !book.available && book.borrowedBy)
    .map((book) => {
      const borrowEvent = history.find(
        (entry) =>
          entry.bookId === book.id &&
          String(entry.borrowerEmail || "").toLowerCase().trim() ===
            String(book.borrowedBy || "").toLowerCase().trim() &&
          entry.action === "BORROW_BOOK"
      );

      return {
        user: book.borrowedBy,
        studentId: getStudentIdByEmail(book.borrowedBy),
        book: book.title,
        bookId: book.id,
        time: borrowEvent?.timestamp || null,
        pendingReturnRequest:
          pendingReturnRequestByBookAndUser[
            `${book.id}-${String(book.borrowedBy || "").toLowerCase()}`
          ] || null
      };
    });

  const refresh = () => {
    setBooks(getBooks());
    setHistory(getBorrowHistory());
    setBorrowRequests(getBorrowRequests());
  };

  const handleReceive = (requestId) => {
    const result = receiveBorrowRequest(requestId);
    if (!result.ok) {
      showError(result.error || "Unable to receive borrow request.");
      return;
    }

    showSuccess("Book release received and recorded.");
    refresh();
  };

  const handleReturn = (requestId) => {
    if (!requestId) {
      showError("Return request not found.");
      return;
    }
    const result = receiveReturnRequest(requestId);
    if (!result.ok) {
      showError(result.error || "Unable to return book.");
      return;
    }

    showSuccess("Book returned.");
    refresh();
  };

  const handleHistoryExport = () => {
    if (history.length === 0) return;
    const historyData = history.map((entry) => ({
      "Book ID": entry.bookId || "-",
      "Book Title": entry.bookTitle || "-",
      "Borrower Email": entry.borrowerEmail || "-",
      "Action": formatHistoryAction(entry.action),
      "Timestamp": formatDateTimeFull(entry.timestamp),
    }));
    exportToCSV(historyData, "borrow-history.csv");
  };

  return (
    <section className="staff-page staff-tracking-page">
      <div className="page-header">
        <div>
          <h2>Borrower Tracking</h2>
          <p className="muted">Track borrower requests and current book releases.</p>
        </div>
      </div>

      <div className="page-header" style={{ marginTop: "1rem" }}>
        <div>
          <h2>Pending Borrow Requests</h2>
          <p className="muted">Confirm book pickup by clicking receive.</p>
        </div>
      </div>
      {pendingRequests.length === 0 ? (
        <div className="empty-state">No pending borrow requests.</div>
      ) : (
        <div className="card table-scroll table-scroll--five staff-table-card">
          <div className="table table--staff-borrow-requests">
            <div className="table__row table__head">
              <span>User</span>
              <span>Student ID</span>
              <span>Book</span>
              <span>Requested</span>
              <span>Action</span>
            </div>
            {pendingRequests.map((entry) => (
              <div className="table__row" key={entry.id}>
                <span>{entry.borrowerEmail}</span>
                <span>{getStudentIdByEmail(entry.borrowerEmail)}</span>
                <span>{entry.title}</span>
                <span>{formatDateTime(entry.requestedAt)}</span>
                <button className="btn btn--success" onClick={() => handleReceive(entry.id)}>
                  Receive
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginTop: "2rem" }}>
        <div>
          <h2>Current Borrower</h2>
          <p className="muted">Books currently picked up by borrowers.</p>
        </div>
      </div>
      {currentBorrowers.length === 0 ? (
        <div className="empty-state">No current borrowers.</div>
      ) : (
        <div className="card table-scroll table-scroll--five staff-table-card">
          <div className="table table--staff-current-borrowers">
            <div className="table__row table__head">
              <span>User</span>
              <span>Student ID</span>
              <span>Book</span>
              <span>Time</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {currentBorrowers.map((entry) => (
              <div className="table__row" key={`${entry.user}-${entry.bookId}`}>
                <span>{entry.user}</span>
                <span>{entry.studentId}</span>
                <span>{entry.book}</span>
                <span>{formatDateTimeFull(entry.time)}</span>
                <span>
                  {entry.pendingReturnRequest
                    ? "returning"
                    : "borrowed"}
                </span>
                <button
                  className="btn btn--return"
                  onClick={() => handleReturn(entry.pendingReturnRequest?.id)}
                  disabled={!entry.pendingReturnRequest}
                >
                  Return
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginTop: "2rem" }}>
        <div>
          <h2>Borrow History</h2>
          <p className="muted">Latest 6 book activity entries for borrowers.</p>
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
        <div className="empty-state">No history yet.</div>
      ) : (
        <div className="card table-scroll table-scroll--five staff-table-card">
          <div className="table table--staff-borrow-history">
            <div className="table__row table__head">
              <span>User</span>
              <span>Student ID</span>
              <span>Book</span>
              <span>Action</span>
              <span>Time</span>
            </div>
            {history.slice(0, 6).map((entry) => (
              <div className="table__row" key={entry.id}>
                <span>{entry.borrowerEmail}</span>
                <span>{getStudentIdByEmail(entry.borrowerEmail)}</span>
                <span>{entry.title}</span>
                <span>{formatHistoryAction(entry.action)}</span>
                <span>{formatDateTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default BorrowerTracking;
