import {
  createContext,
  useContext,
  useMemo,
  useState
} from "react";

const AuthContext =
  createContext(null);

const ACCESS_TOKEN =
  "ujkreta_access_token";

const REFRESH_TOKEN =
  "ujkreta_refresh_token";

export function AuthProvider({
  children
}) {
  const [
    accessToken,
    setAccessToken
  ] = useState(
    () =>
      localStorage.getItem(
        ACCESS_TOKEN
      )
  );

  function login(
    access,
    refresh = null
  ) {
    localStorage.setItem(
      ACCESS_TOKEN,
      access
    );

    if (refresh) {
      localStorage.setItem(
        REFRESH_TOKEN,
        refresh
      );
    }

    setAccessToken(access);
  }

  function logout() {
    localStorage.removeItem(
      ACCESS_TOKEN
    );

    localStorage.removeItem(
      REFRESH_TOKEN
    );

    setAccessToken(null);
  }

  const value = useMemo(
    () => ({
      accessToken,
      isAuthenticated:
        Boolean(accessToken),
      login,
      logout
    }),
    [accessToken]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}