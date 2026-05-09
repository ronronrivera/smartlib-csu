import { supabaseForRequest } from "../lib/supabaseClient.js";

// Helper to check if user has staff access for approval operations
const isStaffLikeRole = (role) => ["staff", "admin"].includes(String(role || "").toLowerCase());

const hasStaffAccess = async (supabase, userId, authUser = null) => {
    const metadataRole =
        authUser?.app_metadata?.role ||
        authUser?.user_metadata?.role ||
        null;

    if (isStaffLikeRole(metadataRole)) {
        return { ok: true };
    }

    const { data: staffProfile, error: staffErr } = await supabase
        .from("staff_profiles")
        .select("user_id, role")
        .eq("user_id", userId)
        .maybeSingle();

    if (staffErr) {
        return { ok: false, error: staffErr.message };
    }

    if (staffProfile) {
        return { ok: true };
    }

    return { ok: false, error: "Staff access required", code: 403 };
};

// Helper to convert hour number to date-based timestamps
const getReservationTimestamps = (hour) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const time_start = new Date(today.getTime());
    time_start.setHours(hour, 0, 0, 0);
    
    const time_end = new Date(today.getTime());
    time_end.setHours(hour + 1, 0, 0, 0);
    
    return { time_start, time_end };
};

// Helper to extract hour from timestamp
const getHourFromTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.getHours();
};

const autoCloseExpiredReservations = async (supabase) => {
    const nowIso = new Date().toISOString();

    const { error: pendingError } = await supabase
        .from("student_room_reservations")
        .update({
            status: "rejected",
            decision_at: nowIso,
            decision_note: "AUTO_EXPIRED",
        })
        .eq("status", "pending")
        .lt("time_end", nowIso);

    if (pendingError) {
        throw new Error(pendingError.message);
    }

    // Preserve approval timestamp for approved reservations so history can show both Approved and Expired events.
    const { error: approvedError } = await supabase
        .from("student_room_reservations")
        .update({
            status: "rejected",
            decision_note: "AUTO_EXPIRED",
        })
        .eq("status", "approved")
        .lt("time_end", nowIso);

    if (approvedError) {
        throw new Error(approvedError.message);
    }
};

const normalizeReservationEvents = (events = []) => {
    const grouped = new Map();

    for (const event of events) {
        const key = event.reservation_id;
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(event);
    }

    return Array.from(grouped.entries()).map(([reservationId, reservationEvents]) => {
        const sortedEvents = [...reservationEvents].sort(
            (left, right) => new Date(left.occurred_at || 0).getTime() - new Date(right.occurred_at || 0).getTime()
        );

        const requestedEvent = sortedEvents.find((entry) => entry.event_type === "requested") || sortedEvents[0] || {};
        const requestedMeta = requestedEvent.metadata || {};
        const studentProfile = requestedEvent.student_profiles || null;

        let status = "pending";
        let decisionAt = null;
        let decisionNote = null;
        let approvedAt = null;
        let approvedByStaffId = null;

        for (const event of sortedEvents) {
            const occurredAt = event.occurred_at;

            if (event.event_type === "approved") {
                status = "approved";
                approvedAt = occurredAt;
                decisionAt = occurredAt;
                decisionNote = null;
                approvedByStaffId = event.staff_user_id || approvedByStaffId;
                continue;
            }

            if (event.event_type === "expired") {
                status = "rejected";
                decisionAt = occurredAt;
                decisionNote = event.event_note || "AUTO_EXPIRED";
                approvedByStaffId = event.staff_user_id || approvedByStaffId;
                continue;
            }

            if (event.event_type === "closed") {
                status = "closed";
                decisionAt = occurredAt;
                decisionNote = event.event_note || "MANUAL_DECLINED";
                approvedByStaffId = event.staff_user_id || approvedByStaffId;
                continue;
            }

            if (event.event_type === "cancelled") {
                status = "cancelled";
                decisionAt = occurredAt;
                decisionNote = event.event_note || "CANCELLED";
            }
        }

        const timeStart = requestedMeta.time_start || requestedMeta.timeStart || null;
        const timeEnd = requestedMeta.time_end || requestedMeta.timeEnd || null;

        return {
            id: reservationId,
            room: requestedMeta.room_number || requestedMeta.room || "-",
            reservationHour: getHourFromTimestamp(timeStart || requestedEvent.occurred_at),
            requestedBy: studentProfile?.users_public?.email || studentProfile?.email || "unknown",
            notes: requestedMeta.purpose ?? null,
            status,
            createdAt: requestedEvent.occurred_at,
            requestedAt: requestedEvent.occurred_at,
            reservationDate: timeStart,
            approvedAt,
            decisionAt,
            decisionNote,
            approvedByStaffId,
            timeEnd,
            studentId: studentProfile?.id_number || "-",
            studentName: `${studentProfile?.first_name || ""} ${studentProfile?.last_name || ""}`.trim(),
            action:
                status === "pending"
                    ? "RESERVATION_REQUESTED"
                    : status === "approved"
                        ? "RESERVATION_APPROVED"
                        : status === "rejected" && String(decisionNote || "").toUpperCase() === "AUTO_EXPIRED"
                            ? "RESERVATION_EXPIRED"
                            : status === "rejected"
                                ? "RESERVATION_DECLINED"
                                : status === "cancelled"
                                    ? "RESERVATION_CANCELLED"
                                    : "RESERVATION_REQUESTED",
        };
    });
};

const normalizeRawReservationEvents = (events = []) => {
    return events.map((event) => {
        const metadata = event.metadata || {};
        const studentProfile = event.student_profiles || null;
        const parentReservation = event.student_room_reservations || null;
        const timeStart = metadata.time_start || metadata.timeStart || null;
        const parentTimeStart = parentReservation?.time_start || null;
        const parentTimeEnd = parentReservation?.time_end || null;
        const parentPurpose = parentReservation?.purpose || null;
        const parentRoom = parentReservation?.room_number || null;

        return {
            id: event.id,
            reservationId: event.reservation_id,
            student_user_id: event.student_user_id,
            staff_user_id: event.staff_user_id,
            eventType: event.event_type,
            eventNote: event.event_note,
            occurredAt: event.occurred_at,
            timestamp: event.occurred_at,
            room: metadata.room_number || metadata.room || parentRoom || "-",
            reservationHour: getHourFromTimestamp(timeStart || parentTimeStart || event.occurred_at),
            requestedBy: studentProfile?.users_public?.email || studentProfile?.email || "unknown",
            studentId: studentProfile?.id_number || "-",
            studentName: `${studentProfile?.first_name || ""} ${studentProfile?.last_name || ""}`.trim(),
            status: event.event_type,
            action:
                event.event_type === "requested"
                    ? "RESERVATION_REQUESTED"
                    : event.event_type === "approved"
                        ? "RESERVATION_APPROVED"
                        : event.event_type === "expired"
                            ? "RESERVATION_EXPIRED"
                            : event.event_type === "closed"
                                ? "RESERVATION_CLOSED"
                                : event.event_type === "cancelled"
                                    ? "RESERVATION_CANCELLED"
                                    : "RESERVATION_REQUESTED",
            metadata: {
                ...metadata,
                status: event.event_type,
            },
            legacyMetadataStatus: metadata.status || null,
            timeStart: timeStart || parentTimeStart,
            timeEnd: metadata.time_end || metadata.timeEnd || parentTimeEnd || null,
            notes: metadata.purpose ?? parentPurpose ?? null,
        };
    });
};

/**
 * Create a new room reservation
 * POST /api/room/reservations
 * Body: { room_number, reservation_hour, purpose }
 */
export const createReservationController = async (req, res) => {
    try {
        const access_token = req.cookies?.access_token;
        if (!access_token) return res.status(401).json({ message: "Unauthorized" });

        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { room_number, reservation_hour, purpose } = req.body;

        // Validate inputs
        if (!room_number || typeof room_number !== "string") {
            return res.status(400).json({ message: "room_number is required" });
        }
        if (typeof reservation_hour !== "number" || reservation_hour < 8 || reservation_hour >= 18) {
            return res.status(400).json({ message: "reservation_hour must be between 8 and 17" });
        }

        const supabase = supabaseForRequest(access_token);

        // Expired reservations should no longer block a new reservation.
        await autoCloseExpiredReservations(supabase);

        // Check if student profile exists
        const { data: studentProfile, error: studentErr } = await supabase
            .from("student_profiles")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (studentErr) {
            return res.status(400).json({ message: studentErr.message });
        }

        if (!studentProfile) {
            return res.status(403).json({ message: "Student profile not found" });
        }

        // Check if student already has an active reservation
        const { data: existingReservation, error: existingErr } = await supabase
            .from("student_room_reservations")
            .select("id")
            .eq("student_user_id", userId)
            .in("status", ["pending", "approved"])
            .maybeSingle();

        if (existingErr && existingErr.code !== "PGRST116") {
            return res.status(400).json({ message: existingErr.message });
        }

        if (existingReservation) {
            return res.status(400).json({ message: "You already have an active reservation" });
        }

        // Check if requested time slot is available
        const { time_start, time_end } = getReservationTimestamps(reservation_hour);

        const { data: conflictingReservations, error: conflictErr } = await supabase
            .from("student_room_reservations")
            .select("id")
            .eq("room_number", room_number)
            .eq("status", "approved")
            .gte("time_start", time_start.toISOString())
            .lt("time_end", time_end.toISOString());

        if (conflictErr) {
            return res.status(400).json({ message: conflictErr.message });
        }

        if (conflictingReservations && conflictingReservations.length > 0) {
            return res.status(400).json({ message: "Selected time slot is unavailable" });
        }

        // Reject if time slot is in the past
        if (time_start < new Date()) {
            return res.status(400).json({ message: "Cannot reserve for a past time slot" });
        }

        // Create reservation
        const { data: newReservation, error: createErr } = await supabase
            .from("student_room_reservations")
            .insert({
                student_user_id: userId,
                room_number: room_number.trim(),
                time_start: time_start.toISOString(),
                time_end: time_end.toISOString(),
                purpose: purpose?.trim() || null,
                status: "pending",
            })
            .select("*")
            .single();

        if (createErr) {
            return res.status(400).json({ message: createErr.message });
        }

        return res.status(201).json({
            message: "Reservation created successfully",
            reservation: newReservation,
        });
    } catch (error) {
        console.error("Error creating reservation:", error.message);
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Get all reservations (for staff/borrower tracking)
 * GET /api/room/reservations?status=pending
 */
export const getReservationsController = async (req, res) => {
    try {
        const access_token = req.cookies?.access_token;
        if (!access_token) return res.status(401).json({ message: "Unauthorized" });

        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { status, room_number } = req.query;

        const supabase = supabaseForRequest(access_token);

        // Ensure reservations that already passed are auto-closed before listing.
        await autoCloseExpiredReservations(supabase);

        // Check staff access for filtering
        const staffAccess = await hasStaffAccess(supabase, userId, req.user);
        const isStaff = staffAccess.ok;

        let query = supabase
            .from("student_room_reservations")
            .select(
                `
                id, 
                student_user_id, 
                room_number, 
                time_start, 
                time_end, 
                purpose, 
                status, 
                created_at,
                decision_at,
                decision_note,
                approved_by_staff_id,
                student_profiles(id_number, first_name, last_name, email, users_public:users_public(email))
                `
            );

        // Non-staff can only see their own reservations
        if (!isStaff) {
            query = query.eq("student_user_id", userId);
        }

        // Apply optional filters
        if (status) {
            query = query.eq("status", status);
        }

        if (room_number) {
            query = query.eq("room_number", room_number);
        }

        const { data: reservations, error } = await query.order("created_at", { ascending: false });

        if (error) {
            return res.status(400).json({ message: error.message });
        }

        // Flatten response for easier frontend consumption
        const normalized = reservations.map((res) => ({
            id: res.id,
            student_user_id: res.student_user_id,
            room: res.room_number,
            reservationHour: getHourFromTimestamp(res.time_start),
            requestedBy: res.student_profiles?.users_public?.email || res.student_profiles?.email || "unknown",
            notes: res.purpose,
            status: res.status,
            createdAt: res.created_at,
            requestedAt: res.created_at,
            // DB uses `decision_at` for approval/decision timestamps for room reservations.
            approvedAt: res.decision_at,
            decisionAt: res.decision_at,
            decisionNote: res.decision_note,
            approvedByStaffId: res.approved_by_staff_id,
            timeEnd: res.time_end,
            studentId: res.student_profiles?.id_number || "-",
            studentName: `${res.student_profiles?.first_name || ""} ${res.student_profiles?.last_name || ""}`.trim(),
        }));

        return res.status(200).json({
            message: "Reservations retrieved successfully",
            reservations: normalized,
        });
    } catch (error) {
        console.error("Error fetching reservations:", error.message);
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Approve a reservation (staff only)
 * PATCH /api/room/reservations/:id/approve
 */
export const approveReservationController = async (req, res) => {
    try {
        const access_token = req.cookies?.access_token;
        if (!access_token) return res.status(401).json({ message: "Unauthorized" });

        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { id } = req.params;

        const supabase = supabaseForRequest(access_token);

        // Keep history/status accurate by auto-closing expired pending reservations first.
        await autoCloseExpiredReservations(supabase);

        // Check staff access
        const staffAccess = await hasStaffAccess(supabase, userId, req.user);
        if (!staffAccess.ok) {
            return res.status(staffAccess.code || 403).json({ message: staffAccess.error });
        }

        const nowIso = new Date().toISOString();

        // Update reservation: mark approved, record approver id and decision timestamp/note.
        const { data: updated, error } = await supabase
            .from("student_room_reservations")
            .update({
                status: "approved",
                approved_by_staff_id: userId,
                decision_at: nowIso,
                decision_note: null,
            })
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            return res.status(400).json({ message: error.message });
        }

        if (!updated) {
            return res.status(404).json({ message: "Reservation not found" });
        }

        return res.status(200).json({
            message: "Reservation approved successfully",
            reservation: updated,
        });
    } catch (error) {
        console.error("Error approving reservation:", error.message);
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Close/mark as completed a reservation (staff only)
 * PATCH /api/room/reservations/:id/close
 */
export const closeReservationController = async (req, res) => {
    try {
        const access_token = req.cookies?.access_token;
        if (!access_token) return res.status(401).json({ message: "Unauthorized" });

        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { id } = req.params;

        const supabase = supabaseForRequest(access_token);

        // Check staff access
        const staffAccess = await hasStaffAccess(supabase, userId, req.user);
        if (!staffAccess.ok) {
            return res.status(staffAccess.code || 403).json({ message: staffAccess.error });
        }

        const nowIso = new Date().toISOString();

        // Update reservation to a terminal state while preserving the close event.
        const { data: updated, error } = await supabase
            .from("student_room_reservations")
            .update({
                status: "rejected",
                decision_at: nowIso,
                decision_note: "MANUAL_DECLINED",
            })
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            return res.status(400).json({ message: error.message });
        }

        if (!updated) {
            return res.status(404).json({ message: "Reservation not found" });
        }

        return res.status(200).json({
            message: "Reservation closed successfully",
            reservation: updated,
        });
    } catch (error) {
        console.error("Error closing reservation:", error.message);
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Cancel a reservation (student can cancel their own, staff can cancel any)
 * PATCH /api/room/reservations/:id/cancel
 */
export const cancelReservationController = async (req, res) => {
    try {
        const access_token = req.cookies?.access_token;
        if (!access_token) return res.status(401).json({ message: "Unauthorized" });

        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { id } = req.params;

        const supabase = supabaseForRequest(access_token);

        // Get the reservation
        const { data: reservation, error: getErr } = await supabase
            .from("student_room_reservations")
            .select("*")
            .eq("id", id)
            .single();

        if (getErr) {
            return res.status(404).json({ message: "Reservation not found" });
        }

        // Check authorization
        const isStaff = (await hasStaffAccess(supabase, userId, req.user)).ok;
        if (!isStaff && reservation.student_user_id !== userId) {
            return res.status(403).json({ message: "Unauthorized to cancel this reservation" });
        }

        // Update reservation
        const { data: updated, error } = await supabase
            .from("student_room_reservations")
            .update({ status: "cancelled" })
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            return res.status(400).json({ message: error.message });
        }

        return res.status(200).json({
            message: "Reservation cancelled successfully",
            reservation: updated,
        });
    } catch (error) {
        console.error("Error cancelling reservation:", error.message);
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Get reservation history (staff: all, borrowers: their own)
 * GET /api/room/reservations/history
 */
export const getReservationHistoryController = async (req, res) => {
    try {
        const access_token = req.cookies?.access_token;
        if (!access_token) return res.status(401).json({ message: "Unauthorized" });

        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const supabase = supabaseForRequest(access_token);

        // Check if user is staff
        const staffAccess = await hasStaffAccess(supabase, userId, req.user);
        const isStaff = staffAccess.ok;

        // Read from the append-only audit table instead of the mutable reservation row.
        let query = supabase
            .from("reservation_events")
            .select(
                `
                id,
                reservation_id,
                student_user_id,
                staff_user_id,
                event_type,
                event_note,
                metadata,
                occurred_at,
                student_profiles(id_number, first_name, last_name, email, users_public:users_public(email))
                ,student_room_reservations(room_number, time_start, time_end, purpose)
                `
            );

        // If borrower, filter to only their events
        if (!isStaff) {
            query = query.eq("student_user_id", userId);
        }

        const { data: events, error } = await query.order("occurred_at", { ascending: false });

        if (error) {
            return res.status(400).json({ message: error.message });
        }

        const normalized = normalizeReservationEvents(events || [])
            .sort((left, right) => new Date(right.requestedAt || right.createdAt || 0).getTime() - new Date(left.requestedAt || left.createdAt || 0).getTime());
        const rawEvents = normalizeRawReservationEvents(events || [])
            .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());

        return res.status(200).json({
            message: "Reservation history retrieved successfully",
            history: normalized,
            events: rawEvents,
        });
    } catch (error) {
        console.error("Error fetching reservation history:", error.message);
        return res.status(500).json({ message: error.message });
    }
};
