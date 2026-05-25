"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface AuthUser {
  userId: string | null;
  email: string | null;
  name: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

// Refresh 2 minutes before the 15-minute access token expires.
const REFRESH_INTERVAL_MS = 13 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    if (!res.ok) {
      // Refresh failed — redirect to login.
      window.location.href = "/login?reason=expired";
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = (await res.json()) as AuthUser;
        setUser(data);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // Proactively refresh the access token before it expires.
    timerRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
