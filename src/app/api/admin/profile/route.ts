import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { verifyPassword, hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    const { data: admins, error } = await db
      .from('admins')
      .select('*')
      .eq('id', adminId);

    if (error || !admins || admins.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      );
    }

    const admin = admins[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        createdAt: admin.created_at,
      },
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, email, currentPassword, newPassword } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    // Fetch current admin record
    const { data: admins, error: fetchError } = await db
      .from('admins')
      .select('*')
      .eq('id', id);

    if (fetchError || !admins || admins.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      );
    }

    const admin = admins[0] as Record<string, unknown>;

    // Handle password change if both current and new passwords are provided
    if (currentPassword && newPassword) {
      if (!admin.password_hash) {
        return NextResponse.json(
          { success: false, error: 'No password set for this account. Please contact support.' },
          { status: 400 }
        );
      }

      const isValid = await verifyPassword(currentPassword, admin.password_hash as string);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 401 }
        );
      }

      const hashedNewPassword = await hashPassword(newPassword);
      const { error: updateError } = await db
        .from('admins')
        .update({ name, email, password_hash: hashedNewPassword })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }
    } else {
      // Update without changing password
      const { error: updateError } = await db
        .from('admins')
        .update({ name, email })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }
    }

    // Fetch updated profile to return
    const { data: updatedAdmins, error: refetchError } = await db
      .from('admins')
      .select('*')
      .eq('id', id);

    if (refetchError || !updatedAdmins || updatedAdmins.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch updated profile' },
        { status: 500 }
      );
    }

    const updatedAdmin = updatedAdmins[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: updatedAdmin.id,
        name: updatedAdmin.name,
        email: updatedAdmin.email,
        createdAt: updatedAdmin.created_at,
      },
    });
  } catch (error) {
    console.error('Update admin profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
