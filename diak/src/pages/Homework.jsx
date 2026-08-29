import {
  useEffect,
  useState
} from "react";

import { api } from "../api/api";
import Loading from "../components/Loading";

export default function Homework() {
  const [
    items,
    setItems
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {
    api.getHomework()
      .then((data) => {
        setItems(
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
          Házi feladat
        </h1>
      </div>

      <div className="stack">
        {items.length === 0 ? (
          <div className="empty-card">
            Nincs házi feladat.
          </div>
        ) : (
          items.map(
            (
              item,
              index
            ) => (
              <article
                className="content-card"
                key={
                  item.Uid ||
                  index
                }
              >
                <span className="muted">
                  {item.TantargyNeve ||
                    item.Tantargy
                      ?.Nev ||
                    "Tantárgy"}
                </span>

                <h2>
                  {item.Szoveg ||
                    "Házi feladat"}
                </h2>

                <p>
                  Határidő:{" "}
                  {item.HataridoDatuma ||
                    "nincs megadva"}
                </p>
              </article>
            )
          )
        )}
      </div>
    </div>
  );
}