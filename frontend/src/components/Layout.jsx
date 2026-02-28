import Sidebar from "./Sidebar";

function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <Header />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}

export default Layout;
