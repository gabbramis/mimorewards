import { redirect } from "next/navigation";

// Preserve old links while keeping a single public contact form.
export default function RegisterPage() {
  redirect("/#acceso");
}
