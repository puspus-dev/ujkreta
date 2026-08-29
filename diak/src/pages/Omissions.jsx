import {
  useEffect,
  useState
} from "react";

import { api } from "../api/api";
import Loading from "../components/Loading";

export default function Omissions() {
  const [
    omissions,
    setOmissions
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {
    api.getOmissions()
      .then((data) => {
        setOmissions(
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
          Hiányzások
        </h1>
      </div>

      <div className="stack">
        {omissions.length === 0 ? (
          <div className="empty-card">
            Nincs hiányzás.
          </div>
        ) : (
          omissions.map(
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
                <strong>
                  {item.Tantargy
                    ?.Nev ||
                    "Hiányzás"}
                </strong>

                <p>
                  {item.Datum ||
                    ""}
                </p>

                <span className="muted">
                  {item.Tipus
                    ?.Nev ||
                    ""}
                </span>
              </article>
            )
          )
        )}
      </div>
    </div>
  );
}