"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/db";
import { users } from "@/db/schema";
import { signIn, signOut } from "@/auth";

export type AuthState = { error?: string } | undefined;

// Returning users land at Home, routed through the welcome animation.
const AFTER_LOGIN = "/home?welcome=1";
// New sign-ups go through the first-run onboarding flow first.
const AFTER_SIGNUP = "/welcome";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function slugifyBase(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14) || "watcher";
}

async function usernameTaken(u: string): Promise<boolean> {
  const r = await db.select({ id: users.id }).from(users).where(eq(users.username, u)).limit(1);
  return r.length > 0;
}

// Build a unique handle from a seed (email local-part), appending digits on
// collision, with a timestamp fallback.
async function generateUniqueUsername(seed: string): Promise<string> {
  const base = slugifyBase(seed);
  if (!(await usernameTaken(base))) return base;
  for (let i = 0; i < 12; i++) {
    const cand = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await usernameTaken(cand))) return cand;
  }
  return `${base}_${Date.now().toString(36)}`;
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };
  try {
    await signIn("credentials", { email, password, redirectTo: AFTER_LOGIN });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Invalid email or password." };
    throw e; // re-throw the NEXT_REDIRECT signal so the redirect happens
  }
  return undefined;
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const rawUsername = String(formData.get("username") ?? "").trim().toLowerCase();

  if (!email || !password) return { error: "Email and password are required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  // Resolve the username: validate + check if provided, otherwise generate.
  let username: string;
  if (rawUsername) {
    if (!USERNAME_RE.test(rawUsername)) {
      return { error: "Username must be 3–20 characters — letters, numbers, or underscores." };
    }
    if (await usernameTaken(rawUsername)) return { error: "That username is taken." };
    username = rawUsername;
  } else {
    username = await generateUniqueUsername(email.split("@")[0]);
  }

  const emailExists = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (emailExists.length) return { error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await db.insert(users).values({ email, username, name: null, passwordHash });
  } catch (e) {
    // unique_violation — a concurrent signup grabbed the email/username
    if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "23505") {
      return { error: "That email or username was just taken — try again." };
    }
    throw e;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: AFTER_SIGNUP });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Account created — please log in." };
    throw e;
  }
  return undefined;
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
