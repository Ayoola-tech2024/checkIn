// ============================================================
// checkIn - Microsoft Teams Meeting Attendance CSV Importer
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

interface ParsedParticipant {
  name: string;
  email: string;
  durationMinutes: number;
  joinTime?: string;
  rawDuration?: string;
}

/**
 * Parse human duration string into integer minutes.
 * Handles formats like:
 * - "57m 15s" -> 57
 * - "1h 12m" -> 72
 * - "45 mins" or "45m" -> 45
 * - "01:15:30" (hh:mm:ss) -> 75
 * - "45" (numeric) -> 45
 */
function parseDurationMinutes(durationStr: string): number {
  if (!durationStr) return 0;
  const str = durationStr.trim().toLowerCase();

  // Try hh:mm:ss or mm:ss
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const parts = str.split(':').map((p) => parseInt(p, 10) || 0);
    if (parts.length === 3) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 2) {
      return parts[0];
    }
  }

  let totalMinutes = 0;
  const hoursMatch = str.match(/(\d+)\s*(?:h|hr|hours?)/);
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
  }

  const minsMatch = str.match(/(\d+)\s*(?:m|min|mins|minutes?)/);
  if (minsMatch) {
    totalMinutes += parseInt(minsMatch[1], 10);
  }

  if (totalMinutes === 0) {
    const num = parseInt(str.replace(/[^\d]/g, ''), 10);
    if (!isNaN(num) && num > 0) totalMinutes = num;
  }

  return totalMinutes;
}

/**
 * Parse Teams CSV (tab-separated or comma-separated)
 */
function parseTeamsCsv(csvText: string): ParsedParticipant[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const participants: ParsedParticipant[] = [];

  // Find header line
  let headerIndex = -1;
  let delimiter = '\t';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('\t') && (line.toLowerCase().includes('name') || line.toLowerCase().includes('email'))) {
      headerIndex = i;
      delimiter = '\t';
      break;
    }
    if (line.includes(',') && (line.toLowerCase().includes('name') || line.toLowerCase().includes('email'))) {
      headerIndex = i;
      delimiter = ',';
      break;
    }
  }

  if (headerIndex === -1) {
    return [];
  }

  // Parse header
  const headers = lines[headerIndex]
    .split(delimiter)
    .map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'full name' || h.includes('participant'));
  const emailIdx = headers.findIndex((h) => h === 'email' || h.includes('upn') || h.includes('user'));
  const durationIdx = headers.findIndex((h) => h.includes('duration') || h.includes('time in'));
  const joinIdx = headers.findIndex((h) => h.includes('first join') || h.includes('join time') || h === 'timestamp');

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (row.length <= 1) continue;

    const name = nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : '';
    const email = emailIdx !== -1 && row[emailIdx] ? row[emailIdx].toLowerCase() : '';
    const rawDuration = durationIdx !== -1 && row[durationIdx] ? row[durationIdx] : '';
    const joinTime = joinIdx !== -1 && row[joinIdx] ? row[joinIdx] : undefined;

    if (!name && !email) continue;

    participants.push({
      name,
      email,
      durationMinutes: parseDurationMinutes(rawDuration),
      joinTime,
      rawDuration,
    });
  }

  return participants;
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth || (auth.role !== 'lecturer' && auth.role !== 'hod' && auth.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, csvData, minDuration = 10 } = body;

    if (!sessionId || !csvData) {
      return NextResponse.json(
        { success: false, error: 'Session ID and CSV data are required' },
        { status: 400 }
      );
    }

    // Verify session
    const { data: sessions } = await db.from('sessions').select('*').eq('id', sessionId);
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }
    const session = sessions[0] as Record<string, unknown>;

    // Parse participants from CSV
    const participants = parseTeamsCsv(csvData);
    if (participants.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not find any participant rows in the uploaded CSV. Please check the file format.',
        },
        { status: 400 }
      );
    }

    // Get all students for matching
    const { data: allStudents } = await db.from('students').select('id, name, matric_number, email');
    const studentList = (allStudents || []) as Array<{ id: string; name: string; matric_number: string; email: string }>;

    // Maps for fast matching
    const emailMap = new Map<string, typeof studentList[0]>();
    const matricMap = new Map<string, typeof studentList[0]>();

    for (const s of studentList) {
      if (s.email) emailMap.set(s.email.toLowerCase(), s);
      if (s.matric_number) matricMap.set(s.matric_number.toUpperCase(), s);
    }

    // Get existing attendances for this session
    const { data: existingAttendances } = await db
      .from('attendances')
      .select('id, student_id')
      .eq('session_id', sessionId);

    const existingStudentMap = new Map<string, string>();
    for (const a of (existingAttendances || []) as Array<{ id: string; student_id: string }>) {
      existingStudentMap.set(a.student_id, a.id);
    }

    let importedCount = 0;
    let updatedCount = 0;
    const matchedStudents: Array<{ matricNumber: string; name: string; duration: number }> = [];
    const unmatched: string[] = [];
    const belowThreshold: Array<{ name: string; email: string; duration: number }> = [];

    const now = new Date().toISOString();

    for (const p of participants) {
      // 1. Check duration filter
      if (p.durationMinutes > 0 && p.durationMinutes < minDuration) {
        belowThreshold.push({ name: p.name, email: p.email, duration: p.durationMinutes });
        continue;
      }

      // 2. Find matching student in DB
      let matchedStudent: typeof studentList[0] | undefined;

      // Match by email
      if (p.email && emailMap.has(p.email)) {
        matchedStudent = emailMap.get(p.email);
      }

      // Match by matric if found in name or email string
      if (!matchedStudent) {
        for (const [m, s] of matricMap.entries()) {
          if (p.name.toUpperCase().includes(m) || p.email.toUpperCase().includes(m)) {
            matchedStudent = s;
            break;
          }
        }
      }

      // Match by Name tokens (e.g. surname + firstname)
      if (!matchedStudent && p.name) {
        const tokens = p.name.toUpperCase().split(/\s+/).filter((t) => t.length > 2);
        for (const s of studentList) {
          const sTokens = s.name.toUpperCase().split(/\s+/);
          // If at least 2 tokens match or student surname matches exactly
          const common = tokens.filter((t) => sTokens.includes(t));
          if (common.length >= 2 || (tokens.length === 1 && sTokens[0] === tokens[0])) {
            matchedStudent = s;
            break;
          }
        }
      }

      if (!matchedStudent) {
        unmatched.push(p.name || p.email || 'Unknown');
        continue;
      }

      // 3. Insert or Update attendance record
      const studentId = matchedStudent.id;
      const existingAttId = existingStudentMap.get(studentId);

      if (existingAttId) {
        await db.from('attendances').update({
          status: 'present',
          similarity_score: 100,
          check_in_time: now,
        }).eq('id', existingAttId);
        updatedCount++;
      } else {
        await db.from('attendances').insert({
          session_id: sessionId,
          student_id: studentId,
          status: 'present',
          similarity_score: 100,
          student_lat: session.lecturer_lat || 7.3,
          student_lng: session.lecturer_lng || 5.13,
          check_in_time: now,
        });
        existingStudentMap.set(studentId, 'new');
        importedCount++;
      }

      matchedStudents.push({
        matricNumber: matchedStudent.matric_number,
        name: matchedStudent.name,
        duration: p.durationMinutes,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalParsed: participants.length,
        importedCount,
        updatedCount,
        totalVerified: importedCount + updatedCount,
        belowThresholdCount: belowThreshold.length,
        unmatchedCount: unmatched.length,
        matchedStudents,
        belowThreshold,
        unmatched,
      },
    });
  } catch (error) {
    console.error('Teams import error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while processing Teams attendance report' },
      { status: 500 }
    );
  }
}
