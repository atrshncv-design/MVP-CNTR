import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Серверный URL бэкенда. Не NEXT_PUBLIC_: читается в рантайме и не инлайнится
// в клиентские бандлы (клиент ходит в API относительным путём через rewrites).
const API_URL = process.env.API_URL_INTERNAL ?? "http://127.0.0.1:8000";

interface ApiUser {
  id: number;
  email: string;
  full_name: string;
  organization: string | null;
  is_active: boolean;
  roles: { role_no: number; slug: string; name: string }[];
}

interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user: ApiUser;
}

/** Обновляем access за 5 минут до истечения (access живёт 60 минут). */
const REFRESH_BEFORE_MS = 5 * 60 * 1000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const res = await fetch(`${API_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as LoginResponse;
        return {
          id: String(data.user.id),
          email: data.user.email,
          name: data.user.full_name,
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? null,
          roles: data.user.roles.map((r) => r.slug),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Первичный вход: кладём пару токенов + время истечения access
      if (user) {
        token.id = user.id;
        token.accessToken = (user as unknown as { accessToken: string }).accessToken;
        token.refreshToken =
          (user as unknown as { refreshToken: string | null }).refreshToken ?? null;
        token.roles = (user as unknown as { roles: string[] }).roles;
        token.accessTokenExpires = Date.now() + 55 * 60 * 1000;
        return token;
      }

      // Токен ещё жив — ничего не делаем
      if (
        typeof token.accessTokenExpires === "number" &&
        Date.now() < token.accessTokenExpires - REFRESH_BEFORE_MS
      ) {
        return token;
      }

      // Пора обновлять: вызываем /auth/refresh с refresh-токеном
      if (!token.refreshToken) {
        token.error = "RefreshAccessTokenError";
        return token;
      }
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: token.refreshToken }),
        });
        if (!res.ok) throw new Error("refresh failed");
        const data = (await res.json()) as LoginResponse;
        token.accessToken = data.access_token;
        token.refreshToken = data.refresh_token ?? token.refreshToken;
        token.accessTokenExpires = Date.now() + 55 * 60 * 1000;
        delete token.error;
        return token;
      } catch {
        token.error = "RefreshAccessTokenError";
        return token;
      }
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          roles: (token.roles as string[]) ?? [],
          accessToken: token.accessToken as string,
        };
        if (token.error) {
          (session as { error?: string }).error = token.error as string;
        }
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface User {
    accessToken?: string;
    refreshToken?: string | null;
    roles?: string[];
  }
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      roles: string[];
      accessToken: string;
    };
  }
  interface JWT {
    accessToken?: string;
    refreshToken?: string | null;
    accessTokenExpires?: number;
    error?: string;
  }
}
