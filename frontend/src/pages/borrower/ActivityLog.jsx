// Purpose: Borrower activity timeline for reservations and borrowing actions.
// Parts: source data selection, derived filters, action handlers, table/list render.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    autoClosePassedReservations,
    formatReservationHour,
    getReservations,
    getReservationHistory,
    isReservationTimePassed,
    requestReservationCancellation
} from "../../services/reservationService";
import { formatDateTimeFull } from "../../utils/dateUtils";
import { showError, showInfo, showSuccess } from "../../utils/notification";
import { RESERVATION_STATUS } from "../../constants/status";
import {
    expandBorrowHistoryEntries,
    expandReservationHistoryEntries,
    formatActivityAction
} from "../../utils/activityUtils";
import { useStore } from "../../store/useAuthStore";
import { useRequest } from "../../store/useRequestsStore";

const isBorrowHistoryStatus = (status) => {
    const normalized = String(status || "").toLowerCase();
    return ["approved", "returned", "cancelled"].includes(normalized);
};

const toBorrowActionLabel = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "pending") return "BORROW_REQUESTED";
    if (normalized === "approved") return "BORROW_BOOK";
    if (normalized === "returned") return "RETURN_BOOK";
    if (normalized === "cancelled") return "CANCELLED";
    if (normalized === "rejected") return "BORROW_REJECTED";
    return normalized || "-";
};

const formatBorrowStatus = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (!normalized) return "-";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getReservationStatusLabel = (entry) => {
    const status = String(entry?.status || "").toLowerCase();
    const decisionNote = String(entry?.decisionNote || entry?.decision_note || "").toUpperCase();

    if (status === "pending") return "Pending";
    if (status === "approved") return "Confirmed";
    if (status === "cancelled") return "Cancelled";
    if (status === "rejected" && decisionNote === "AUTO_EXPIRED") return "Timed Out";
    if (status === "rejected") return "Rejected";
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : "-";
};

const ActivityLog = () => {
    const { user } = useStore();
    // Use normalized current-user email to scope visible activity records.
    const userEmail = (user?.profile?.email || user?.user?.email || user?.email || "").toLowerCase();
    const userId = user?.profile?.user_id || user?.user?.id || "";
    
    const {fetchHistory, itemRequests} = useRequest();
    const [reservationUpdates, setReservationUpdates] = useState([]);
    const [myReservations, setMyReservations] = useState([]);
    const [isReservationLoading, setIsReservationLoading] = useState(true);
    const [borrowHistorySearch, setBorrowHistorySearch] = useState("");
    const [reservationHistorySearch, setReservationHistorySearch] = useState("");
    const latestReservationLoadRef = useRef(0);
    
    useEffect(() => {
        fetchHistory();
    },[fetchHistory])

    const loadReservationData = useCallback(async () => {
        const loadId = latestReservationLoadRef.current + 1;
        latestReservationLoadRef.current = loadId;

        if (!userEmail) {
            setReservationUpdates([]);
            setMyReservations([]);
            setIsReservationLoading(false);
            return;
        }

        try {
            await autoClosePassedReservations();

            const reservations = await getReservations();
            const reservationHistory = await getReservationHistory();

            const scopedReservations = Array.isArray(reservations)
                ? reservations.filter((entry) => String(entry.requestedBy || "").toLowerCase() === userEmail)
                : [];

            const scopedReservationEvents = Array.isArray(reservationHistory?.events)
                ? reservationHistory.events.filter((entry) => {
                    const eventEmail = String(entry.requestedBy || entry.student_profiles?.email || "").toLowerCase();
                    return eventEmail === userEmail;
                })
                : [];

            const activeReservations = scopedReservations
                .filter(
                    (entry) =>
                        entry.status === RESERVATION_STATUS.PENDING ||
                        entry.status === RESERVATION_STATUS.APPROVED
                )
                .filter((entry) => !isReservationTimePassed(entry))
                .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

            const historyRows = scopedReservationEvents.length > 0
                ? scopedReservationEvents
                : expandReservationHistoryEntries(scopedReservations);

            if (latestReservationLoadRef.current !== loadId) {
                return;
            }

            setReservationUpdates(historyRows);
            setMyReservations(activeReservations);
            setIsReservationLoading(false);
        } catch (error) {
            console.error("Error loading reservation activity:", error);
            // Preserve previous data so transient API hiccups do not blank the table.
            if (latestReservationLoadRef.current === loadId) {
                setIsReservationLoading(false);
            }
        }
    }, [userEmail]);

    useEffect(() => {
        loadReservationData();
    }, [loadReservationData]);

    const myBorrowRequests = useMemo(() => {
        if (!Array.isArray(itemRequests)) return [];

        return itemRequests.filter((entry) => {
            if (userId && entry.student_user_id) {
                return entry.student_user_id === userId;
            }

            const entryEmail = String(entry.student_profiles?.email || entry.borrowerEmail || "").toLowerCase();
            return Boolean(userEmail) && entryEmail === userEmail;
        });
    }, [itemRequests, userEmail, userId]);

    const borrowUpdates = useMemo(
        () => myBorrowRequests
            .filter((entry) => !isBorrowHistoryStatus(entry.status))
            .sort((a, b) => {
                const left = a.decision_at || a.requested_at;
                const right = b.decision_at || b.requested_at;
                return new Date(right || 0).getTime() - new Date(left || 0).getTime();
            }),
        [myBorrowRequests]
    );

    const borrowedHistory = useMemo(
        () => (Array.isArray(itemRequests?.events) && itemRequests.events.length > 0)
            ? itemRequests.events.filter((entry) => {
                if (userId && entry.student_user_id) {
                    return entry.student_user_id === userId;
                }

                const entryEmail = String(entry.student_profiles?.email || entry.borrowerEmail || "").toLowerCase();
                return Boolean(userEmail) && entryEmail === userEmail;
            })
            : expandBorrowHistoryEntries(myBorrowRequests),
        [itemRequests, userEmail, userId, myBorrowRequests]
    );

    const reservationHistoryRows = useMemo(
        () => reservationUpdates
            .slice()
            .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()),
        [reservationUpdates]
    );

    const filteredBorrowHistory = useMemo(
        () => borrowedHistory.filter((entry) => {
            const searchLower = borrowHistorySearch.toLowerCase();
            return (
                (entry.title || "").toLowerCase().includes(searchLower) ||
                (entry.action || "").toLowerCase().includes(searchLower) ||
                (entry.studentId || "").toLowerCase().includes(searchLower)
                || String(entry.eventType || "").toLowerCase().includes(searchLower)
                || String(entry.eventNote || "").toLowerCase().includes(searchLower)
                || String(entry.legacyMetadataStatus || "").toLowerCase().includes(searchLower)
            );
        }),
        [borrowedHistory, borrowHistorySearch]
    );

    const filteredReservationHistory = useMemo(
        () => reservationHistoryRows.filter((entry) => {
            const searchLower = reservationHistorySearch.toLowerCase();
            return (
                (entry.room || "").toLowerCase().includes(searchLower) ||
                (entry.action || "").toLowerCase().includes(searchLower) ||
                (entry.status || "").toLowerCase().includes(searchLower) ||
                (entry.studentId || "").toLowerCase().includes(searchLower) ||
                (entry.eventType || "").toLowerCase().includes(searchLower) ||
                (entry.eventNote || "").toLowerCase().includes(searchLower) ||
                (entry.legacyMetadataStatus || "").toLowerCase().includes(searchLower)
            );
        }),
        [reservationHistoryRows, reservationHistorySearch]
    );

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
        cancellationTimeoutRef.current = setTimeout(async () => {
            try {
                const result = await requestReservationCancellation(id, userEmail);
                if (!result.ok) {
                    showError(result.error || "Unable to request cancellation.");
                    cancellationTimeoutRef.current = null;
                    return;
                }

                showSuccess("Cancellation request submitted.");
                await loadReservationData();
            } catch (error) {
                showError("Unable to request cancellation.");
                console.error("Cancellation request error:", error);
            } finally {
                cancellationTimeoutRef.current = null;
            }
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
                                <span>Action</span>
                                <span>Status</span>
                                <span>Requested</span>
                            </div>
                            {borrowUpdates.map((entry) => (
                                <div className="table__row" key={entry.id}>
                                    <span title={entry.item_title || "-"}>{entry.item_title || "-"}</span>
                                    <span>{formatActivityAction(toBorrowActionLabel(entry.status))}</span>
                                    <span>{formatBorrowStatus(entry.status)}</span>
                                    <span>{formatDateTimeFull(entry.requested_at)}</span>
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
                        <div style={{ marginBottom: "1rem", padding: "0.5rem" }}>
                            <input
                                type="text"
                                className="input"
                                placeholder="Search by book title or action..."
                                value={borrowHistorySearch}
                                onChange={(e) => setBorrowHistorySearch(e.target.value)}
                            />
                        </div>
                        {filteredBorrowHistory.length === 0 ? (
                            <div className="empty-state">No matching records found.</div>
                        ) : (
                            <div className="table table--borrow-history">
                                <div className="table__row table__head">
                                    <span>Book</span>
                                    <span>Action</span>
                                    <span>Status</span>
                                    <span>Time</span>
                                </div>
                                {filteredBorrowHistory.map((entry) => (
                                        <div className="table__row" key={`${entry.id}-${entry.action}-${entry.timestamp}`}>
                                        <span title={entry.title || entry.item_title || "-"}>{entry.title || entry.item_title || "-"}</span>
                                        <span>{formatActivityAction(entry.action)}</span>
                                        <span>{formatBorrowStatus(entry.status)}</span>
                                        <span>{formatDateTimeFull(entry.timestamp)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
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
                                <span>Date Requested</span>
                                <span>Action</span>
                            </div>
                            {myReservations.map((entry) => (
                                <div className="table__row" key={entry.id}>
                                    <span>{entry.room}</span>
                                    <span>{formatReservationHour(entry.reservationHour)}</span>
                                    <span>
                                        {entry.cancellationRequested
                                            ? "Cancellation Requested"
                                            : getReservationStatusLabel(entry)}
                                    </span>
                                    <span>{formatDateTimeFull(entry.createdAt)}</span>
                                    <button
                                        className="btn btn--danger btn--cancel"
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
                    <p className="muted">Latest updates for your room reservation requests from Supabase.</p>
                </div>
            </div>
            {isReservationLoading && reservationHistoryRows.length === 0 ? (
                <div className="empty-state">Loading reservation updates...</div>
            ) : reservationHistoryRows.length === 0 ? (
                <div className="empty-state">No reservation updates yet.</div>
            ) : (
                    <div className="card table-scroll table-scroll--five activity-log-table-card">
                        <div style={{ marginBottom: "1rem", padding: "0.5rem" }}>
                            <input
                                type="text"
                                className="input"
                                placeholder="Search by room number, action, or status..."
                                value={reservationHistorySearch}
                                onChange={(e) => setReservationHistorySearch(e.target.value)}
                            />
                        </div>
                        {filteredReservationHistory.length === 0 ? (
                            <div className="empty-state">No matching records found.</div>
                        ) : (
                            <div className="table table--reservation-updates">
                                <div className="table__row table__head">
                                    <span>Room</span>
                                    <span>Time Slot</span>
                                    <span>Action</span>
                                    <span>Status</span>
                                        <span>Time</span>
                                </div>
                                {filteredReservationHistory.map((entry) => (
                                        <div className="table__row" key={`${entry.id}-${entry.action}-${entry.timestamp}`}>
                                        <span>{entry.room}</span>
                                        <span>{formatReservationHour(entry.reservationHour)}</span>
                                        <span>{formatActivityAction(entry.action)}</span>
                                        <span>{getReservationStatusLabel(entry)}</span>
                                            <span>{formatDateTimeFull(entry.timestamp)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
        </section>
    );
};

export default ActivityLog;
