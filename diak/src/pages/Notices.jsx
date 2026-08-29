import {
  useEffect,
  useState
} from "react";

import { api } from "../api/api";
import Loading from "../components/Loading";

export default function Notices() {
  const [
    notices,
    setNotices
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {
    api.getNotices()
      .then((data) => {
        setNotices(
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
          Információk
        </h1>
      </div>

      <div className="stack">
        {notices.length === 0 ? (
          <div className="empty-card">
            Nincs új információ.
          </div>
        ) : (
          notices.map(
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
                  {item.RogzitoNeve ||
                    ""}
                </span>

                <h2>
                  {item.Cim ||
                    "Értesítés"}
                </h2>

                <p>
                  {item.TartalomText ||
                    item.Tartalom ||
                    ""}
                </p>
              </article>
            )
          )
        )}
      </div>
    </div>
  );
}