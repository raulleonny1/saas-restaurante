import type { EntityStatus, ISODateString, SoftDelete, Timestamps } from "./common";
import type { RoleId } from "./rbac";

export type EmploymentType = "full_time" | "part_time" | "contractor" | "temp";

export interface Employee extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  /** Linked Firebase Auth user when they accept invite / match member email. */
  uid?: string;
  /** Last Auth invite sent for this email (pending until they register/login). */
  inviteSentAt?: ISODateString;
  branchIds: string[];
  name: string;
  email: string;
  phone?: string;
  roleId: RoleId;
  employmentType: EmploymentType;
  status: EntityStatus;
  pinCodeHash?: string;
  hireDate?: ISODateString;
  salesTotal: number;
  notes?: string;
}

export interface EmployeeShift extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  employeeId: string;
  startsAt: ISODateString;
  endsAt: ISODateString;
  roleId: RoleId;
  notes?: string;
}
