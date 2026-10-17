"use server";

import { redirect } from "next/navigation";
import { clearRole, setRole, type Role } from "@/lib/session";

/** Never trust form input: only the two known personas are accepted. */
function asRole(value: FormDataEntryValue | null): Role | null {
  return value === "tenant" || value === "landlord" ? value : null;
}

/**
 * Demo sign-in. Any email and any password are accepted — we only check that they were
 * sent, so a crafted POST can't sign in without going through the form. No user record is
 * ever read or written; the only thing that persists is which persona you chose.
 */
export async function signIn(formData: FormData): Promise<void> {
  const role = asRole(formData.get("role"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!role || !email || !password) redirect("/login?error=missing");

  await setRole(role);
  redirect(`/${role}`);
}

export async function signOut(): Promise<void> {
  await clearRole();
  redirect("/login");
}
