import { AuthDialog } from "@/components/auth-dialog";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <AuthDialog>
      <SignupForm />
    </AuthDialog>
  );
}
