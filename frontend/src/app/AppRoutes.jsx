
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import Layout from "../components/Layout";
import ProtectedRoute from "../components/ProtectedRoute";
import { ROLES } from "../constants/roles";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import BookDetails from "../pages/borrower/BookDetails";
import BrowseBooks from "../pages/borrower/BrowseBooks";
import RoomReservation from "../pages/borrower/RoomReservation";
import NotFound from "../pages/NotFound";
import Approvals from "../pages/staff/Approvals";
import BorrowerTracking from "../pages/staff/BorrowerTracking";
import Dashboard from "../pages/staff/Dashboard";
import StaffAndBorrowerList from "../pages/staff/StaffAndBorrowerList";

const AppRoutes = () => {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Navigate to="/login" replace />} />
				<Route path="/login" element={<Login />} />
				<Route path="/signup" element={<Signup />} />

				<Route
					path="/borrower/browse"
					element={
						<ProtectedRoute role={ROLES.BORROWER}>
							<Layout>
								<BrowseBooks />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/borrower/book/:id"
					element={
						<ProtectedRoute role={ROLES.BORROWER}>
							<Layout>
								<BookDetails />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/borrower/reserve"
					element={
						<ProtectedRoute role={ROLES.BORROWER}>
							<Layout>
								<RoomReservation />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/staff/dashboard"
					element={
						<ProtectedRoute role={ROLES.STAFF}>
							<Layout>
								<Dashboard />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/staff/approvals"
					element={
						<ProtectedRoute role={ROLES.STAFF}>
							<Layout>
								<Approvals />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/staff/tracking"
					element={
						<ProtectedRoute role={ROLES.STAFF}>
							<Layout>
								<BorrowerTracking />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/staff/borrowers"
					element={
						<ProtectedRoute role={ROLES.STAFF}>
							<Layout>
								<StaffAndBorrowerList />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route path="*" element={<NotFound />} />
			</Routes>
		</BrowserRouter>
	);
};

export default AppRoutes;
