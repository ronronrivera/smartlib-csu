// Purpose: Central route table for public and role-protected pages.
// Parts: public routes, borrower routes, staff routes, fallback routes.
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "../components/Layout";
import ProtectedRoute from "../components/ProtectedRoute";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import ActivityLog from "../pages/borrower/ActivityLog";
import Account from "../pages/borrower/Account";
import BookDetails from "../pages/borrower/BookDetails";
import BrowseBooks from "../pages/borrower/BrowseBooks";
import RoomReservation from "../pages/borrower/RoomReservation";
import NotFound from "../pages/NotFound";
import BorrowerTracking from "../pages/staff/BorrowerTracking";
import Dashboard from "../pages/staff/Dashboard";
import StaffAndBorrowerList from "../pages/staff/StaffAndBorrowerList";
import BookManagement from "../pages/staff/BookManagement";
import { useStore } from "../store/useAuthStore";
import { useEffect } from "react";
import PageLoader from "../components/PageLoader";
import { ROLES } from "../constants/roles";

const AppRoutes = () => {

    const {user, studentAuth, isCheckingAuth} = useStore();
    
    useEffect(() => {
        studentAuth();
    }, [studentAuth])
    
    if(isCheckingAuth) return <PageLoader/>  

	return (
<BrowserRouter>
			<Routes>
				{/* Default entry redirects to login. */}
				<Route path="/" element={<Navigate to="/login" replace />} />
				{/* Public authentication routes. */}
				<Route path="/login" element={!user? <Login /> : <Navigate to={"/borrower/browse"}/>} />
				<Route path="/signup" element={!user? <Signup /> : <Navigate to={"/borrower/browse"}/>}/>

				{/* Borrower-only routes guarded by role check. */}
				<Route
					path="/borrower/browse"
					element={
						<ProtectedRoute>
							<Layout>
								<BrowseBooks />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/borrower/activity"
					element={
						<ProtectedRoute>
							<Layout>
								<ActivityLog />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/borrower/book/:id"
					element={
						<ProtectedRoute>
							<Layout>
								<BookDetails />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/borrower/reserve"
					element={
						<ProtectedRoute>
							<Layout>
								<RoomReservation />
							</Layout>
						</ProtectedRoute>
					}
				/>

				<Route
					path="/borrower/account"
					element={
						<ProtectedRoute>
							<Layout>
								<Account />
							</Layout>
						</ProtectedRoute>
					}
				/>

				{/* Staff-only routes guarded by role check. */}
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
					path="/staff/tracking"
					element={
						<ProtectedRoute role={ROLES.STAFF}>
							<Layout>
								<Reservation />
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

				<Route
					path="/staff/books"
					element={
						<ProtectedRoute role={ROLES.STAFF}>
							<Layout>
								<BookManagement />
							</Layout>
						</ProtectedRoute>
					}
				/>

					<Route
						path="/staff/books"
						element={
							<ProtectedRoute role={ROLES.STAFF}>
								<Layout>
									<BookManagement />
								</Layout>
							</ProtectedRoute>
						}
					/>

					{/* Catch-all fallback for unknown URLs. */}
					<Route path="*" element={<NotFound />} />
				</Routes>
				<footer className="app-copyright" aria-label="Copyright">
					© {new Date().getFullYear()} SmartLib CSU. All rights reserved.
				</footer>
		</BrowserRouter>
	);
};

export default AppRoutes;
