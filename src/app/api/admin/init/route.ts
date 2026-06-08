import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
    const existingAdmin = await db.admin.findFirst();
    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin account already exists. Only one admin can be initialized.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const admin = await db.admin.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

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
