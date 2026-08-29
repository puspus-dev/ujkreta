import {
  useEffect,
  useState
} from "react";

import { api } from "../api/api";
import Loading from "../components/Loading";

export default function Timetable() {
  const [
    lessons,
    setLessons
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {
    api.getLessons()
      .then((data) => {
        setLessons(
          Array.isArray(data)
            ? data
            : []
        );
      })
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
      <div className="page-intro">
        <h1>
          Órarend
        </h1>

        <p>
          A tanóráid listája.
        </p>
      </div>

      <div className="card-list">
        {lessons.length === 0 ? (
          <div className="empty-card">
            Nincs órarendi adat.
          </div>
        ) : (
          lessons.map(
            (
              lesson,
              index
            ) => (
              <article
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
              </article>
            )
          )
        )}
      </div>
    </div>
  );
}