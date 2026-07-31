import { signInWithGoogle } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  return (
    <form action={signInWithGoogle}>
      <Button type="submit" variant="outline" className="w-full">
        Continua con Google
      </Button>
    </form>
  );
}
