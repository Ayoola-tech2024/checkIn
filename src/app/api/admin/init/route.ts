import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Check if any admin already exists
    const { data: existingAdmins } = await db.from('admins').select('*').limit(1);
    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Admin account already exists. Only one admin can be initialized.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const { data: admins, error } = await db.from('admins').insert({
      name,
      email,
      password_hash: passwordHash,
    }).select();

    if (error || !admins || admins.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create admin' },
        { status: 500 }
      );
    }

    const admin = admins[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error('Admin init error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
