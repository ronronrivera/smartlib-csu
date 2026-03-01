// Purpose: Role-aware sidebar navigation with active/interactive states.
// Parts: nav config, active item tracking, interaction handlers, nav render.
import { useEffect, useRef, useState } from "react";
import {
	BookOpen,
	CalendarClock,
	CalendarPlus,
	History,
	LayoutDashboard,
	Menu,
	Search,
	UserRound,
	UserRoundPlus,
	Users
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { ROLES } from "../constants/roles";
import { useStore } from "../store/useAuthStore";

const Sidebar = () => {
    const {user, logout} = useStore(); 
	const navigate = useNavigate();
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [isMobileMoving, setIsMobileMoving] = useState(false);
	const movementTimeoutRef = useRef(null); 
    
	const handleLogout = () => {
        
        logout();

		setIsMobileMenuOpen(false);
		navigate("/login");
	};

	useEffect(() => {
		if (!user) return;

		const markMoving = () => {
			// Hide idle animation while the user is actively moving/scrolling.
			setIsMobileMoving(true);
			if (movementTimeoutRef.current) {
				clearTimeout(movementTimeoutRef.current);
			}
			// Return to idle state shortly after movement stops.
			movementTimeoutRef.current = setTimeout(() => {
				setIsMobileMoving(false);
			}, 800);
		};

		window.addEventListener("scroll", markMoving, { passive: true });
		window.addEventListener("touchmove", markMoving, { passive: true });
		window.addEventListener("wheel", markMoving, { passive: true });
		window.addEventListener("mousemove", markMoving);

		return () => {
			window.removeEventListener("scroll", markMoving);
			window.removeEventListener("touchmove", markMoving);
			window.removeEventListener("wheel", markMoving);
			window.removeEventListener("mousemove", markMoving);
			if (movementTimeoutRef.current) {
				clearTimeout(movementTimeoutRef.current);
			}
		};
	}, [user]);

	if (!user) return null;

	// Sidebar links are derived from the authenticated user's role.
	const staffLinks = [
		{ to: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
		{ to: "/staff/tracking", label: "Borrowers", icon: Users },
		{ to: "/staff/reservation", label: "Reservation", icon: CalendarClock },
		{ to: "/staff/books", label: "Book Management", icon: BookOpen },
		{ to: "/staff/borrowers", label: "Borrowers Signup", icon: UserRoundPlus }
	];
	const borrowerLinks = [
		{ to: "/borrower/browse", label: "Browse", icon: Search },
		{ to: "/borrower/reserve", label: "Reserve Room", icon: CalendarPlus },
		{ to: "/borrower/activity", label: "Activity Log", icon: History },
		{ to: "/borrower/account", label: "Account", icon: UserRound }
	];
	const userRole = user?.role || user?.profile?.role;
	// Explicitly resolve known roles only; unknown/null role gets empty nav instead of wrong menu.
	const links =
		userRole === ROLES.STAFF
			? staffLinks
			: userRole === ROLES.BORROWER
				? borrowerLinks
				: [];

	return (
		<>
			<button
				type="button"
				className={`mobile-menu-fab${!isMobileMoving ? " mobile-menu-fab--idle" : ""}`}
				// Mobile quick-action button toggles sidebar visibility.
				onClick={() => setIsMobileMenuOpen((prev) => !prev)}
				aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
			>
				<Menu size={18} strokeWidth={2.35} />
			</button>

			<aside
				className={`sidebar${isCollapsed ? " sidebar--collapsed" : ""}${
					isMobileMenuOpen ? " sidebar--mobile-open" : ""
				}`}
			>
				<div className="sidebar__head">
					<button
						type="button"
						className="sidebar__toggle"
						onClick={() => setIsCollapsed((prev) => !prev)}
						aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
					>
						<Menu size={18} strokeWidth={2.35} />
					</button>
					{/* Safe title fallback avoids crashing when session is temporarily null during hydration. */}
					<div className="sidebar__title">{`${user?.role || "user"} menu`}</div>
				</div>
				<div className="sidebar__section">
					{links.map((link) => (
						<NavLink
							key={link.to}
							to={link.to}
							title={link.label}
							// Close mobile drawer once user selects a destination.
							onClick={() => setIsMobileMenuOpen(false)}
							className={({ isActive }) =>
								`sidebar__link${isActive ? " sidebar__link--active" : ""}`
							}
						>
							<link.icon size={16} strokeWidth={2.2} className="sidebar__link-icon" />
							<span className="sidebar__link-label">{link.label}</span>
						</NavLink>
					))}
				</div>
				<div className="sidebar__footer">
					<button type="button" className="btn btn--ghost sidebar__logout" onClick={handleLogout}>
						Logout
					</button>
				</div>
			</aside>
		</>
	);
};

export default Sidebar;
