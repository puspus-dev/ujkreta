import {
  useEffect,
  useState
} from "react";

import { api } from "../api/api";
import Loading from "../components/Loading";

export default function Grades() {
  const [
    grades,
    setGrades
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {
    api.getGrades()
      .then((data) => {
        setGrades(
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
          Jegyek
        </h1>

        <p>
          Az eddig rögzített
          értékeléseid.
        </p>
      </div>

      <div className="grade-list">
        {grades.length === 0 ? (
          <div className="empty-card">
            Nincs megjeleníthető
            jegy.
          </div>
        ) : (
          grades.map(
            (
              grade,
              index
            ) => (
              <article
                className="full-grade"
                key={
                  grade.Uid ||
                  index
                }
              >
                <div>
                  <strong>
                    {grade.Tantargy
                      ?.Nev ||
                      "Tantárgy"}
                  </strong>

                  <span>
                    {grade.Tema ||
                      grade.ErtekFajta
                        ?.Nev ||
                      ""}
                  </span>
                </div>

                <div className="grade-value">
                  {grade.SzamErtek ||
                    grade.SzovegesErtek ||
                    "—"}
                </div>
              </article>
            )
          )
        )}
      </div>
    </div>
  );
}