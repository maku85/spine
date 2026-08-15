import { AuthDialog } from "@/components/auth-dialog";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <AuthDialog>
      <LoginForm />
    </AuthDialog>
  );
}
