// Purpose: Borrower page to request and track room reservations.
// Parts: form state, slot derivations, submit workflow, reservations render.
import { useMemo, useState } from "react";
import {
  addReservation,
  getReservationHourOptions,
  getUnavailableReservationHours,
  isLunchBreakHour
} from "../../services/reservationService";
import { ROOMS } from "../../config/rooms";
import { showError, showInfo, showSuccess } from "../../utils/notification";
import { useStore } from "../../store/useAuthStore";

const reservationHourOptions = getReservationHourOptions();

const RoomReservation = () => {
  const [room, setRoom] = useState("");
  const [reservationHour, setReservationHour] = useState("");
  const [notes, setNotes] = useState("");
  const { user } = useStore();
  // Recompute unavailable slots whenever selected room changes.
  const unavailableHours = useMemo(
    () => getUnavailableReservationHours(room),
    [room]
  );

  const handleReserve = () => {
    const currentHour = new Date().getHours();
    // Guard clauses keep validation flow straightforward and readable.
    if (!room.trim()) {
      showError("Please choose a room");
      return;
    }
    if (!reservationHour) {
      showError("Please choose a time slot");
      return;
    }
    if (Number(reservationHour) <= currentHour) {
      showError("Selected time slot has already passed.");
      return;
    }
    if (unavailableHours.has(Number(reservationHour))) {
      showError("Selected time slot is unavailable.");
      return;
    }

    showInfo("Submitting reservation, please wait...");
    setTimeout(() => {
      const result = addReservation({
        room: room.trim(),
        reservationHour: Number(reservationHour),
        notes: notes.trim(),
        // Attach requester identity for ownership/history tracking.
        requestedBy: user?.email || "unknown"
      });

      if (!result.ok) {
        showError(result.error || "Unable to submit reservation");
        return;
      }

      setRoom("");
      setReservationHour("");
      setNotes("");
      showSuccess("Reservation request submitted");
    }, 500);
  };

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Room Reservation</h2>
          <p className="muted">Reserve a study space for your session.</p>
        </div>
      </div>
      <div className="card form">
        <div className="form-row">
          <div className="form-field">
            <label className="label">Room name</label>
            <select
              className="select"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            >
              <option value="">Select a room</option>
              {ROOMS.map((roomOption) => (
                <option key={roomOption.id} value={roomOption.name}>
                  {roomOption.name} · {roomOption.capacity} seats
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Time slot (1 hour)</label>
            <select
              className="select"
              value={reservationHour}
              onChange={(e) => setReservationHour(e.target.value)}
            >
              <option value="">Select time (8:00 AM - 6:00 PM)</option>
              {reservationHourOptions.map((slot) => {
                // Slot can be unavailable due to lunch break or approved reservation.
                const isUnavailable = unavailableHours.has(slot.value);
                const isPastSlot = slot.value <= new Date().getHours();
                const stateLabel = isUnavailable
                  ? isLunchBreakHour(slot.value)
                    ? "Lunch Break"
                    : "Reserved"
                  : isPastSlot
                    ? "Passed"
                  : "";

                return (
                  <option
                    key={slot.value}
                    value={slot.value}
                    disabled={isUnavailable || isPastSlot}
                  >
                    {stateLabel ? `${slot.label} (${stateLabel})` : slot.label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <label className="label">Notes</label>
        <textarea
          className="input input--area"
          placeholder="Time range, team size, or equipment needs"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button className="btn btn--primary" onClick={handleReserve}>
          Reserve
        </button>
        <p className="micro">Slots marked "Reserved" are only staff-approved reservations.</p>
      </div>
    </section>
  );
};

export default RoomReservation;
