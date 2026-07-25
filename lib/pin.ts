/** PIN de acceso staff (dueño / empleados): exactamente 6 dígitos. */

export function isValidStaffPin(pin: string): boolean {
  return /^\d{6}$/.test(pin.trim());
}

export function normalizeStaffPin(pin: string): string {
  return pin.trim().replace(/\s/g, "");
}
