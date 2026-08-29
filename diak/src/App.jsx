import {
  Navigate,
  Route,
  Routes
} from "react-router-dom";

import { useAuth } from "./auth/AuthContext";

import Dashboard
  from "./pages/Dashboard";

import Grades
  from "./pages/Grades";

import Timetable
  from "./pages/Timetable";

import Homework
  from "./pages/Homework";

import Tests
  from "./pages/Tests";

import Omissions
  from "./pages/Omissions";

import Notices
  from "./pages/Notices";

import Dkt
  from "./pages/Dkt";

import Profile
  from "./pages/Profile";

import Header
  from "./components/Header";

import BottomNav
  from "./components/BottomNav";

function ProtectedLayout() {
  const {
    isAuthenticated
  } = useAuth();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return (
    <div className="app-shell">
      <Header />

      <main className="page-content">
        <Routes>
          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/jegyek"
            element={<Grades />}
          />

          <Route
            path="/orarend"
            element={<Timetable />}
          />

          <Route
            path="/hazi"
            element={<Homework />}
          />

          <Route
            path="/dolgozatok"
            element={<Tests />}
          />

          <Route
            path="/hianyzasok"
            element={<Omissions />}
          />

          <Route
            path="/hirek"
            element={<Notices />}
          />

          <Route
            path="/dkt"
            element={<Dkt />}
          />

          <Route
            path="/profil"
            element={<Profile />}
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <ProtectedLayout />
  );
}