import {
  useEffect,
  useState
} from "react";

import { useAuth } from "../auth/AuthContext";
import { api } from "../api/api";
import Loading from "../components/Loading";

export default function Profile() {
  const {
    logout
  } = useAuth();

  const [
    student,
    setStudent
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {
    api.getStudent()
      .then(setStudent)
      .catch(console.error)
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <div>
      <div className="profile-card">
        <div className="large-avatar">
          👤
        </div>

        <h1>
          {student?.Nev ||
            "Tanuló"}
        </h1>

        <p>
          {student?.EmailCim ||
            ""}
        </p>
      </div>

      <div className="stack">
        <div className="content-card">
          <span className="muted">
            Tanulói azonosító
          </span>

          <strong>
            {student?.Uid ||
              "—"}
          </strong>
        </div>

        <div className="content-card">
          <span className="muted">
            Intézmény
          </span>

          <strong>
            {student?.IntezmenyNev ||
              student?.Intezmeny
                ?.RovidNev ||
              "—"}
          </strong>
        </div>

        <button
          className="logout-button"
          onClick={logout}
        >
          Kijelentkezés
        </button>
      </div>
    </div>
  );
}