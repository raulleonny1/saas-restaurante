import { FirebaseError } from "firebase/app";

/** Maps Firebase Auth / Firestore error codes to Spanish UI messages. */
export function mapAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    const code = error.code;
    switch (code) {
      case "auth/email-already-in-use":
        return "Ya existe una cuenta con este email. Prueba iniciar sesión.";
      case "auth/invalid-email":
        return "El email no es válido.";
      case "auth/weak-password":
        return "La contraseña debe tener al menos 6 caracteres.";
      case "auth/user-disabled":
        return "Esta cuenta ha sido deshabilitada.";
      case "auth/user-not-found":
        return "No hay ninguna cuenta con este email.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email o contraseña incorrectos.";
      case "auth/too-many-requests":
        return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
      case "auth/network-request-failed":
        return "Error de red. Comprueba tu conexión.";
      case "auth/operation-not-allowed":
        return "Email/contraseña no está habilitado en Firebase Console → Authentication → Sign-in method.";
      case "auth/missing-email":
        return "Introduce un email.";
      case "auth/invalid-action-code":
        return "El enlace de recuperación no es válido o ha caducado.";
      case "auth/api-key-not-valid":
      case "auth/invalid-api-key":
        return "API key de Firebase inválida. Revisa NEXT_PUBLIC_FIREBASE_API_KEY en .env.local y reinicia npm run dev.";
      case "auth/configuration-not-found":
        return "Configuración Auth no encontrada. Revisa el projectId y que Authentication esté activo en Firebase.";
      case "permission-denied":
      case "firestore/permission-denied":
        return "Firestore denegó el permiso. Publica firestore.rules en Firebase Console (Firestore → Reglas).";
      default:
        if (/permission-denied/i.test(code) || /permission/i.test(error.message)) {
          return "Firestore denegó el permiso. Publica firestore.rules en Firebase Console (Firestore → Reglas).";
        }
        return `[${code}] ${error.message || "Error de Firebase."}`;
    }
  }

  if (error instanceof Error) {
    if (/permission|insufficient/i.test(error.message)) {
      return "Firestore denegó el permiso. Publica firestore.rules en Firebase Console (Firestore → Reglas).";
    }
    return error.message;
  }
  return "Error de autenticación.";
}

export function firebaseErrorCode(error: unknown): string | null {
  if (error instanceof FirebaseError) return error.code;
  return null;
}
