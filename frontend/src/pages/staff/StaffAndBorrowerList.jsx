// Purpose: Staff page for viewing borrower signups and exporting lists.
// Parts: data loading, helper formatting, export handler, table render.
import { useEffect, useMemo, useState } from "react";
import { exportToCSV } from "../../services/exportService";
import { formatBorrowerFullName, formatStudentId } from "../../utils/name";
import { useStore } from "../../store/useAuthStore";
import { Loader2Icon, Search } from "lucide-react";

const truncateText = (value, maxLength) => {
	// Keep table columns compact while preserving full value in title tooltip.
	const text = String(value || "-");
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength)}...`;
};

const StaffAndBorrowerList = () => {
	const { getStudentBorrowers, borrowers, isLoading } = useStore();

	useEffect(() => {
		getStudentBorrowers();
	}, [getStudentBorrowers]);

	const [selectedBorrower, setSelectedBorrower] = useState(null);
	const [searchQuery, setSearchQuery] = useState("");

	const handleExport = () => {
		if (borrowers.length === 0) return;
		// Export all borrower signup rows in one CSV file.
		const borrowerData = borrowers.map((borrower) => ({
			ID: formatStudentId(borrower.id_number || "-"),
			Name: formatBorrowerFullName(borrower),
			Email: borrower.email || "-",
			Phone: borrower.contact_number || "-",
			Status: borrower.status || "-",
		}));
		exportToCSV(borrowerData, "borrower-signups.csv");
	};

	const openBorrowerDetails = (borrower) => {
		setSelectedBorrower(borrower);
	};

	const closeBorrowerDetails = () => {
		setSelectedBorrower(null);
	};

	//  Ensure borrowers is always an array to avoid length/map crashes
	const safeBorrowers = useMemo(
		() => (Array.isArray(borrowers) ? borrowers : []),
		[borrowers]
	);

	const filteredBorrowers = useMemo(() => {
		const query = String(searchQuery || "").trim().toLowerCase();
		if (!query) return safeBorrowers;

		return safeBorrowers.filter((borrower) => {
			const fullName = formatBorrowerFullName(borrower);
			const credentials = [
				fullName,
				borrower.id_number,
				borrower.program,
				borrower.collegeCourse,
				borrower.yearLevel,
				borrower.email,
				borrower.address,
				borrower.currentAddress,
				borrower.contact_number,
			];

			return credentials
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(query));
		});
	}, [safeBorrowers, searchQuery]);

	return (
		<section className="staff-page staff-signups-page">
			<div className="page-header">
				<div>
					<h2>Borrower Signups</h2>
					<p className="muted">Accounts registered as borrowers.</p>
				</div>
				<button
					className="btn btn--ghost btn--export-soft"
					onClick={handleExport}
					disabled={safeBorrowers.length === 0 || isLoading}
				>
					Export CSV
				</button>
			</div>

			<div className="card staff-signups-search-card" style={{ marginBottom: "1rem" }}>
				<div className="search-input-wrapper">
					<Search className="search-input-icon" size={18} aria-hidden="true" />
					<input
						className="input search-input"
						type="search"
						placeholder="Search by name, student ID, course, year, email, address, or contact"
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
					/>
				</div>
			</div>

			{/*  Loading indicator while fetching borrowers */}
			{isLoading ? (
				<div
					className="card"
					style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
					aria-busy="true"
				>
					<Loader2Icon className="size-6 animate-spin" aria-label="Loading borrowers" />
				</div>
			) : safeBorrowers.length === 0 ? (
				<div className="empty-state">No borrower signups yet.</div>
			) : filteredBorrowers.length === 0 ? (
				<div className="empty-state">No borrower matches that search.</div>
			) : (
				<div className="card table-scroll table-scroll--signups staff-table-card">
					<table className="staff-signups-data-table">
						<colgroup>
							<col style={{ width: "24ch" }} />
							<col style={{ width: "12ch" }} />
							<col style={{ width: "24ch" }} />
							<col style={{ width: "18ch" }} />
							<col style={{ width: "30ch" }} />
							<col style={{ width: "10ch" }} />
						</colgroup>
						<thead>
							<tr>
								<th>Name</th>
								<th>Student ID</th>
								<th>Course - Year Level</th>
								<th>Email</th>
								<th>Address</th>
								<th>Action</th>
							</tr>
						</thead>
						<tbody>
							{filteredBorrowers.map((borrower) => (
								<tr key={borrower.email}>
									<td data-label="Name" title={formatBorrowerFullName(borrower)}>
										{formatBorrowerFullName(borrower)}
									</td>
									<td data-label="Student ID" title={borrower.id || "-"}>
										{truncateText(formatStudentId(borrower.id_number), 24)}
									</td>
									<td
										data-label="Course - Year Level"
										title={`${borrower.collegeCourse || "-"} - ${borrower.yearLevel || "-"}`}
									>
										{borrower.program || "-"}
									</td>
									<td data-label="Email" title={borrower.email || "-"}>
										{borrower.email || "-"}
									</td>
									<td
										data-label="Address"
										title={borrower.address || borrower.currentAddress || "-"}
									>
										{truncateText(borrower.address || borrower.currentAddress, 8) || "-"}
									</td>
									<td data-label="Action">
										<button
											className="btn btn--view staff-signups-view-btn"
											onClick={() => openBorrowerDetails(borrower)}
										>
											View
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{selectedBorrower ? (
				<div className="modal-overlay" role="dialog" aria-modal="true">
					<div className="card modal-card modal-card--signup-details">
						<h3>Borrower Details</h3>
						<p>
							<strong>Name:</strong>{" "}
							{formatBorrowerFullName(selectedBorrower)}
						</p>
						<p>
							<strong>Course - Year Level:</strong> {selectedBorrower.program || "-"}
						</p>
						<p>
							<strong>Student ID:</strong> {formatStudentId(selectedBorrower.id_number) || "-"}
						</p>
						<p>
							<strong>Email:</strong> {selectedBorrower.email || "-"}
						</p>
						<p>
							<strong>Address:</strong> {selectedBorrower.address || "-"}
						</p>
						<div className="modal-actions">
							<button className="btn btn--danger btn--cancel" onClick={closeBorrowerDetails}>
								Close
							</button>
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
};

export default StaffAndBorrowerList;
