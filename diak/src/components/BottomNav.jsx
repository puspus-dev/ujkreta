import {
  NavLink
} from "react-router-dom";

const items = [
  {
    path: "/",
    icon: "⌂",
    label: "Főoldal"
  },
  {
    path: "/jegyek",
    icon: "★",
    label: "Jegyek"
  },
  {
    path: "/orarend",
    icon: "▦",
    label: "Órarend"
  },
  {
    path: "/hazi",
    icon: "✓",
    label: "Házi"
  },
  {
    path: "/profil",
    icon: "●",
    label: "Profil"
  }
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map(
        (item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={
              item.path === "/"
            }
            className={({
              isActive
            }) =>
              isActive
                ? "nav-item active"
                : "nav-item"
            }
          >
            <span className="nav-icon">
              {item.icon}
            </span>

            <span>
              {item.label}
            </span>
          </NavLink>
        )
      )}
    </nav>
  );
}