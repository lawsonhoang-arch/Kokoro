import type { DefaultSession } from "next-auth";

// Add the user id we set in the jwt/session callbacks to the session type.
declare module "next-auth" {
  interface Session {
    user: { id: string; username?: string; role?: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    role?: string;
  }
}
