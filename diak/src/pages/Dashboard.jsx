import {
  useEffect,
  useState
} from "react";

import {
  Link
} from "react-router-dom";

import { api } from "../api/api";
import Loading from "../components/Loading";

export default function Dashboard() {
  const [
    student,
    setStudent
  ] = useState(null);

  const [
    grades,
    setGrades
  ] = useState([]);

  const [
    lessons,
    setLessons
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [
          studentData,
          gradesData,
          lessonsData
        ] =
          await Promise.all([
            api.getStudent(),
            api.getGrades(),
            api.getLessons()
          ]);

        if (!cancelled) {
          setStudent(
            studentData
          );

          setGrades(
            Array.isArray(
              gradesData
            )
              ? gradesData
              : []
          );

          setLessons(
            Array.isArray(
              lessonsData
            )
              ? lessonsData
              : []
          );
        }
      } catch (error) {
        console.error(
          "Dashboard betöltési hiba:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Loading />
    );
  }

  const studentName =
    student?.Nev ||
    "Tanuló";

  return (
    <div className="dashboard">
      <section className="welcome-card">
        <div>
          <span className="eyebrow">
            Jó napot! 👋
          </span>

          <h1>
            {studentName}
          </h1>

          <p>
            Nézzük, mi történik
            ma az iskolában.
          </p>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>
            Mai órák
          </h2>

          <Link to="/orarend">
            Összes
          </Link>
        </div>

        <div className="card-list">
          {lessons.length === 0 ? (
            <div className="empty-card">
              Nincs megjeleníthető
              óra.
            </div>
          ) : (
            lessons
              .slice(0, 4)
              .map(
                (
                  lesson,
                  index
                ) => (
                  <div
                    className="lesson-card"
                    key={
                      lesson.Uid ||
                      index
                    }
                  >
                    <div className="lesson-time">
                      {lesson.KezdetIdopont ||
                        "--:--"}
                    </div>

                    <div className="lesson-info">
                      <strong>
                        {lesson.Tantargy
                          ?.Nev ||
                          lesson.Nev ||
                          "Óra"}
                      </strong>

                      <span>
                        {lesson.TanarNeve ||
                          "—"}
                      </span>
                    </div>

                    <div className="lesson-room">
                      {lesson.TeremNeve ||
                        ""}
                    </div>
                  </div>
                )
              )
          )}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>
            Legutóbbi jegyek
          </h2>

          <Link to="/jegyek">
            Összes
          </Link>
        </div>

        <div className="grade-grid">
          {grades.length === 0 ? (
            <div className="empty-card">
              Nincs még jegy.
            </div>
          ) : (
            grades
              .slice(0, 6)
              .map(
                (
                  grade,
                  index
                ) => (
                  <div
                    className="grade-card"
                    key={
                      grade.Uid ||
                      index
                    }
                  >
                    <span>
                      {grade.Tantargy
                        ?.Nev ||
                        "Tantárgy"}
                    </span>

                    <strong>
                      {grade.SzamErtek ||
                        grade.SzovegesErtek ||
                        "—"}
                    </strong>
                  </div>
                )
              )
          )}
        </div>
      </section>

      <section className="quick-links">
        <Link
          className="quick-card"
          to="/hazi"
        >
          <span>📝</span>
          <strong>
            Házi feladat
          </strong>
        </Link>

        <Link
          className="quick-card"
          to="/hianyzasok"
        >
          <span>📅</span>
          <strong>
            Hiányzások
          </strong>
        </Link>

        <Link
          className="quick-card"
          to="/dolgozatok"
        >
          <span>📚</span>
          <strong>
            Dolgozatok
          </strong>
        </Link>

        <Link
          className="quick-card"
          to="/dkt"
        >
          <span>💻</span>
          <strong>
            DKT
          </strong>
        </Link>
      </section>
    </div>
  );
}