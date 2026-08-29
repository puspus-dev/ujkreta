import {
  useLocation
} from "react-router-dom";

const titles = {
  "/": "Kezdőlap",
  "/jegyek": "Jegyek",
  "/orarend": "Órarend",
  "/hazi": "Házi feladat",
  "/dolgozatok": "Dolgozatok",
  "/hianyzasok": "Hiányzások",
  "/hirek": "Információk",
  "/dkt": "DKT",
  "/profil": "Profil"
};

export default function Header() {
  const location =
    useLocation();

  const title =
    titles[location.pathname] ||
    "KRÁTA";

  return (
    <header className="topbar">
      <div>
        <div className="brand">
          ÚjKréta
        </div>

        <div className="page-title">
          {title}
        </div>
      </div>

      <div className="avatar">
        👤
      </div>
    </header>
  );
}