import {
  useEffect,
  useState
} from "react";

import { api } from "../api/api";
import Loading from "../components/Loading";

export default function Dkt() {
  const [
    subjects,
    setSubjects
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {
    api.getDktSubjects()
      .then((data) => {
        setSubjects(
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
          DKT
        </h1>

        <p>
          Digitális tanulási
          tárgyak.
        </p>
      </div>

      <div className="grade-grid">
        {subjects.length === 0 ? (
          <div className="empty-card">
            Nincs DKT tantárgy.
          </div>
        ) : (
          subjects.map(
            (
              item,
              index
            ) => (
              <article
                className="quick-card"
                key={
                  item.TantargyId ||
                  index
                }
              >
                <span>
                  📘
                </span>

                <strong>
                  {item.TantargyNev ||
                    item.AlkalmazottNev ||
                    "Tantárgy"}
                </strong>

                <small>
                  {item.OsztalyCsoportNev ||
                    ""}
                </small>
              </article>
            )
          )
        )}
      </div>
    </div>
  );
}