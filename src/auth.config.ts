import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  token_type: string;
  user: ApiUser;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
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
          roles: data.user.roles.map((r) => r.slug),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accessToken = (user as unknown as { accessToken: string }).accessToken;
        token.roles = (user as unknown as { roles: string[] }).roles;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          roles: (token.roles as string[]) ?? [],
          accessToken: token.accessToken as string,
        };
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface User {
    accessToken?: string;
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
}