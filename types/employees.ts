import type { EntityStatus, ISODateString, SoftDelete, Timestamps } from "./common";
import type { RoleId } from "./rbac";

export type EmploymentType = "full_time" | "part_time" | "contractor" | "temp";

/** Documento de identidad del empleado (laboral / fiscal). */
export type EmployeeIdDocumentType = "nif" | "nie" | "cedula" | "pasaporte";

export interface Employee extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  /** Linked Firebase Auth user when they accept invite / match member email. */
  uid?: string;
  /** Last Auth invite sent for this email (pending until they register/login). */
  inviteSentAt?: ISODateString;
  branchIds: string[];
  /** Mesas que el mesero debe atender (asignadas por el administrador). */
  assignedTableIds?: string[];
  name: string;
  email: string;
  phone?: string;
  /** Tipo: NIF, NIE, cédula o pasaporte. */
  documentType?: EmployeeIdDocumentType;
  /** Número del documento de identidad. */
  documentNumber?: string;
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

/** Entrada del expediente: llamados de atención, incidencias, notas, reconocimientos. */
export type EmployeeRecordType =
  | "warning"
  | "incident"
  | "note"
  | "praise";

export interface EmployeeRecord extends Timestamps {
  id: string;
  restaurantId: string;
  employeeId: string;
  type: EmployeeRecordType;
  title: string;
  body: string;
  createdByUid: string;
  createdByName: string;
}
