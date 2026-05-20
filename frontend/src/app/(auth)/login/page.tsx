// ============================================================================
// AU-IBAR Learning — /login redirect
// Landing page is now at /, redirect login requests there
// ============================================================================
import { redirect } from 'next/navigation';

export default function LoginRedirect() {
  redirect('/');
}
