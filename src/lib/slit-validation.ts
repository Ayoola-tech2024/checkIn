// ============================================================
// checkIn - SLIT Validation Rules
// ============================================================

import { SLIT_DEPT_CODES, SLIT_DEPT_NAMES, VALID_LEVELS } from './constants';

/**
 * Validate that the level is a valid academic level
 */
export function validateLevel(level: unknown): { valid: boolean; error?: string } {
  if (level === undefined || level === null) {
    return { valid: false, error: 'Level is required' };
  }
  const numLevel = typeof level === 'string' ? parseInt(level, 10) : level;
  if (typeof numLevel !== 'number' || isNaN(numLevel)) {
    return { valid: false, error: 'Level must be a number' };
  }
  if (!VALID_LEVELS.includes(numLevel as typeof VALID_LEVELS[number])) {
    return { valid: false, error: `Level must be one of: ${VALID_LEVELS.join(', ')}. Received: ${level}` };
  }
  return { valid: true };
}

/**
 * Validate that the department code belongs to an approved SLIT department
 */
export function validateDepartmentCode(code: string): { valid: boolean; error?: string } {
  if (!code) {
    return { valid: false, error: 'Department code is required' };
  }
  if (!SLIT_DEPT_CODES.includes(code as typeof SLIT_DEPT_CODES[number])) {
    return { valid: false, error: `Department code "${code}" is not an approved SLIT department. Valid codes: ${SLIT_DEPT_CODES.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Validate that the department name belongs to an approved SLIT department
 */
export function validateDepartmentName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: 'Department name is required' };
  }
  if (!SLIT_DEPT_NAMES.includes(name as typeof SLIT_DEPT_NAMES[number])) {
    return { valid: false, error: `Department name "${name}" is not an approved SLIT department. Valid names: ${SLIT_DEPT_NAMES.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Combined validation for student creation/update
 */
export function validateStudentFields(fields: {
  level?: unknown;
  schoolId?: string;
  departmentId?: string;
  school?: string; // legacy, ignored
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (fields.level !== undefined) {
    const levelResult = validateLevel(fields.level);
    if (!levelResult.valid && levelResult.error) errors.push(levelResult.error);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Combined validation for course creation/update
 */
export function validateCourseFields(fields: {
  level?: unknown;
  schoolId?: string;
  departmentId?: string;
  school?: string; // legacy, ignored
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (fields.level !== undefined) {
    const levelResult = validateLevel(fields.level);
    if (!levelResult.valid && levelResult.error) errors.push(levelResult.error);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Combined validation for lecturer creation/update
 */
export function validateLecturerFields(fields: {
  schoolId?: string;
  departmentId?: string;
  isHod?: boolean;
  hodDepartmentId?: string;
  school?: string; // legacy, ignored
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (fields.isHod && !fields.hodDepartmentId) {
    errors.push('HOD must be assigned to a department');
  }
  return { valid: errors.length === 0, errors };
}
