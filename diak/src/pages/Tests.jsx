import {
  useEffect,
  useState
} from "react";

import { api } from "../api/api";
import Loading from "../components/Loading";

export default function Tests() {
  const [
    tests,
    setTests
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {
    api.getTests()
      .then((data) => {
        setTests(
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
          Dolgozatok
        </h1>
      </div>

      <div className="stack">
        {tests.length === 0 ? (
          <div className="empty-card">
            Nincs dolgozat.
          </div>
        ) : (
          tests.map(
            (
              test,
              index
            ) => (
              <article
                className="content-card"
                key={
                  test.Uid ||
                  index
                }
              >
                <span className="muted">
                  {test.TantargyNeve ||
                    test.Tantargy
                      ?.Nev ||
                    "Tantárgy"}
                </span>

                <h2>
                  {test.Temaja ||
                    "Dolgozat"}
                </h2>

                <p>
                  Dátum:{" "}
                  {test.Datum ||
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