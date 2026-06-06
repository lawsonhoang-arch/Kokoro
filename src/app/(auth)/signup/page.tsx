import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signUp } from "@/lib/auth-actions";
import { AuthForm } from "../AuthForm";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/home");
  return <AuthForm mode="signup" action={signUp} />;
}
