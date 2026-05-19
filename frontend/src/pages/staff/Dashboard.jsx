// Purpose: Staff dashboard showing summary metrics and recent activity.
// Parts: metric derivation, formatting helpers, summary cards, activity list render.
import { useMemo, useState, useEffect } from "react";
import { getReservationHistory } from "../../services/reservationService";
import { formatDateTimeFull } from "../../utils/dateUtils";
import { formatActivityAction } from "../../utils/activityUtils";
import { formatStudentId } from "../../utils/name";
import { useRequest } from "../../store/useRequestsStore";
import { useStore } from "../../store/useAuthStore";

const Dashboard = () => {
  const [reservationHistory, setReservationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { fetchHistory, itemRequests } = useRequest();
  const { borrowers, getStudentBorrowers } = useStore();


  useEffect(() => {
    const initialLoad = async () => {
      try {
        setLoading(true);
        const reservationData = await getReservationHistory();
        await getStudentBorrowers();
        await fetchHistory();
        setReservationHistory(reservationData || []);
      } catch (err) {
        setReservationHistory([]);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const refreshFeed = async () => {
      const reservationData = await getReservationHistory();
      await getStudentBorrowers();
      await fetchHistory();
      setReservationHistory(reservationData || []);
    };

    initialLoad();

    const intervalId = setInterval(() => {
      refreshFeed();
    }, 3000);

    const handleStorage = () => {
      refreshFeed();
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchHistory, getStudentBorrowers]);

  // LOGIC: Dashboard uses two separate datasets:
  // 1) recent feed (mixed borrow + reservation events), and
  // 2) summary panels (confirmed borrow/reservation outcomes only).
  // Keeping these concerns separate prevents pending/noisy events from inflating summary counts.
  // Show a short, recent feed to keep dashboard quick to scan.
  // Normalize borrow logs into a single shape used by the shared feed table.
  const borrowEventSource = Array.isArray(itemRequests?.events) && itemRequests.events.length > 0
    ? itemRequests.events
    : null;

  const borrowRequestLogs = borrowEventSource
    ? borrowEventSource.map((entry) => ({
        id: entry.id,
        action: entry.action || "BORROW_REQUESTED",
        room: "-",
        userEmail: entry.student_profiles?.email || entry.studentEmail || "",
        firstName: entry.student_profiles?.first_name || "",
        lastName: entry.student_profiles?.last_name || "",
        userId: entry.student_profiles?.id_number || entry.studentId || "-",
        sourceTimestamp: entry.timestamp || entry.occurredAt,
      }))
    : (itemRequests || []).flatMap((entry) => {
    const logs = [];

    logs.push({
      id: `${entry.id}-requested`,
      action: "BORROW_REQUESTED",
      room: "-",
      userEmail: entry.student_profiles?.email || "",
      firstName: entry.student_profiles?.first_name || "",
      lastName: entry.student_profiles?.last_name || "",
      userId: entry.student_profiles?.id_number || "-",
      sourceTimestamp: entry.requested_at,
    });

    const approvedAt = entry.approved_at || entry.decision_at;
    if (approvedAt && ["approved", "returned"].includes(String(entry.status || "").toLowerCase())) {
      logs.push({
        id: `${entry.id}-approved`,
        action: "BORROW_APPROVED",
        room: "-",
        userEmail: entry.student_profiles?.email || "",
        firstName: entry.student_profiles?.first_name || "",
        lastName: entry.student_profiles?.last_name || "",
        userId: entry.student_profiles?.id_number || "-",
        sourceTimestamp: approvedAt,
      });
    }

    return logs;
  });

  // Only include reservation actions that matter for day-to-day monitoring.
  const reservationActionsForFeed = new Set([
    "RESERVATION_REQUESTED",
    "RESERVATION_APPROVED",
    "RESERVATION_DECLINED",
    "RESERVATION_EXPIRED",
    "RESERVATION_CANCELLED",
    "RESERVATION_CREATED",
    "RESERVATION_CLOSED",
    "RESERVATION_CANCELLATION_REQUESTED"
  ]);

  // Project reservation history into same feed schema as borrow logs.
  const reservationEventSource = Array.isArray(reservationHistory?.events) && reservationHistory.events.length > 0
    ? reservationHistory.events
    : null;

  const reservationRequestLogs = reservationEventSource
    ? reservationEventSource
        .filter((entry) => reservationActionsForFeed.has(String(entry.action || "").toUpperCase()))
        .map((entry) => ({
          ...entry,
          userEmail: entry.requestedBy || "",
          sourceTimestamp: entry.timestamp,
        }))
    : reservationHistory
        .filter((entry) =>
          reservationActionsForFeed.has(String(entry.action || "").toUpperCase())
        )
        .map((entry) => ({
          ...entry,
          userEmail: entry.requestedBy || "",
          sourceTimestamp: entry.timestamp
        }));

  // Merge, sort newest-first, then cap to the latest six events.
  const logs = [...borrowRequestLogs, ...reservationRequestLogs]
    .sort(
      (a, b) =>
        new Date(b.sourceTimestamp || 0).getTime() -
        new Date(a.sourceTimestamp || 0).getTime()
    )
    .slice(0, 6);

  const successfulBorrowEntries = (itemRequests || []).filter((entry) => {
    const status = String(entry.status || "").toLowerCase();
    return status === "approved" || status === "returned";
  });
  // Count successful borrow actions including returned books so totals persist after return.
  const borrowBookCountByTitle = successfulBorrowEntries.reduce((summary, entry) => {

    const title = String(entry.item_title || "").trim();
    if (!title) return summary;

    summary[title] = (summary[title] || 0) + 1;
    return summary;
  }, {});

  const bookActivityRows = Object.entries(borrowBookCountByTitle).sort(
    (a, b) => b[1] - a[1]
  );

  // Count approved books per borrower/student
  const borrowCountByStudent = successfulBorrowEntries.reduce((summary, entry) => {
    const email = String(entry.student_profiles?.email || "").trim().toLowerCase();
    if (!email) return summary;
    summary[email] = (summary[email] || 0) + 1;
    return summary;
  }, {});

  const borrowerActivityRows = Object.entries(borrowCountByStudent)
    .map(([email, count]) => ({
      email,
      count
    }))
    .sort((a, b) => b.count - a.count);

  // LOGIC: Aggregate borrower activity in one map so borrow + reservation metrics
  // stay aligned per user and can be sorted by a combined engagement score.
  const studentIdByEmail = useMemo(() => {
    return (borrowers || []).reduce((summary, borrower) => {
      const email = String(borrower?.email || "").trim().toLowerCase();
      if (!email) return summary;
      summary[email] = borrower?.id_number || "-";
      return summary;
    }, {});
  }, [borrowers]);

  // Resolve Student ID from borrower profile using email lookup.
  const getStudentId = (entry) => {
    const id = studentIdByEmail[String(entry.userEmail || "").trim().toLowerCase()] || entry.userId || "-";
    return formatStudentId(id);
  };

  if (loading) {
    return (
      <section className="staff-page staff-dashboard-page">
        <div className="page-header">
          <div>
            <h2>Staff Dashboard</h2>
            <p className="muted">Loading...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-page staff-dashboard-page">
      <div className="page-header">
        <div>
          <h2>Staff Dashboard</h2>
          <p className="muted">Monitor reservations and borrower activity.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card dashboard-summary-card">
          <p className="dashboard-summary-title">Book Activity</p>
          <ul className="dashboard-summary-list">
              {bookActivityRows.length === 0 ? (
              <li>No confirmed borrow activity yet</li>
            ) : (
              bookActivityRows.map(([title, count]) => (
                <li key={title} className="dashboard-summary-item">
                  <span className="dashboard-summary-item-title" title={title}>{title}</span>
                  <span className="dashboard-summary-item-meta">Borrowed {count}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="card dashboard-summary-card">
          <p className="dashboard-summary-title">Borrower Activity</p>
          {borrowerActivityRows.length === 0 ? (
            <div className="empty-state">No borrower activity yet</div>
          ) : (
            <ol className="dashboard-summary-list">
              {borrowerActivityRows.map((item, index) => (
                <li key={item.email} className="dashboard-rank-item">
                  <span className="dashboard-rank-index">{index + 1}</span>
                  <span className="dashboard-rank-email">{item.email}</span>
                  <span className="dashboard-rank-count">{item.count} {item.count === 1 ? "book" : "books"}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="page-header" style={{ marginTop: "2rem" }}>
        <div>
          <h2>Recent Activity</h2>
          <p className="muted">Live updates for pending borrower, book receive, reservation request, reservation approval, and reservation close.</p>
        </div>
      </div>
      {logs.length === 0 ? (
        <div className="empty-state">No activity yet.</div>
      ) : (
        <div className="card table-scroll table-scroll--five dashboard-activity-table-card">
          <div className="table table--staff-dashboard-activity">
            <div className="table__row table__head">
              <span>Action</span>
              <span>User</span>
              <span>Student ID</span>
              <span>Time</span>
            </div>
            {logs.map((entry) => (
              <div className="table__row" key={entry.id}>
                <span>{formatActivityAction(entry.action)}</span>
                <span>{entry.userEmail || "-"}</span>
                <span>{getStudentId(entry)}</span>
                <span>{formatDateTimeFull(entry.sourceTimestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default Dashboard;
