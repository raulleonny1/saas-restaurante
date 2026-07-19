import type { ISODateString } from "./common";
import type { PermissionId, RoleId } from "./rbac";

/** @deprecated use RoleId — alias for compatibility */
export type UserRole = RoleId;

export { type RoleId } from "./rbac";

export const USER_ROLES: RoleId[] = [
  "super_admin",
  "propietario",
  "gerente",
  "supervisor",
  "cajero",
  "mesero",
  "cocinero",
  "barista",
  "repartidor",
  "cliente",
];

/** Roles selectable on public registration. */
export const SIGNUP_ROLES: RoleId[] = ["propietario", "cliente"];

/** Authenticated application user (global profile in Firestore). */
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  /** Default / last role hint; tenant authority is members.roleId */
  role: RoleId;
  restaurantIds: string[];
  isSuperAdmin?: boolean;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
}

export interface AuthSession {
  user: AppUser;
  accessToken?: string;
  permissions?: PermissionId[];
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  displayName: string;
  role: RoleId;
  restaurantName?: string;
}

export interface ResetPasswordInput {
  email: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface InviteMemberInput {
  email: string;
  role: RoleId;
  branchIds?: string[];
  permissionAllow?: PermissionId[];
  permissionDeny?: PermissionId[];
}
