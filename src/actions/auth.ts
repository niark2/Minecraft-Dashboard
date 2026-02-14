'use server'

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyUser, createUser, createInvitationCode, getInvitationCodes, revokeInvitationCode, getUsers, deleteUser, setRole } from '@/lib/users';

export async function login(prevState: { error: string } | undefined, formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    const user = await verifyUser(username, password);

    if (user) {
        // Set a session cookie with user info
        const cookieStore = await cookies();
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Store user data in session
        cookieStore.set('dashboard_session', JSON.stringify({
            userId: user.id,
            username: user.username,
            role: user.role
        }), {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            expires: expires
        });

        redirect('/');
    } else {
        return { error: 'Invalid username or password' };
    }
}

export async function register(prevState: { error: string } | undefined, formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const invitationCode = formData.get('invitationCode') as string;

    // Validation
    if (!username || !password || !invitationCode) {
        return { error: 'All fields are required' };
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' };
    }

    if (password.length < 6) {
        return { error: 'Password must be at least 6 characters' };
    }

    const result = await createUser(username, password, invitationCode);

    if (result.success) {
        // Auto-login after registration
        const user = await verifyUser(username, password);
        if (user) {
            const cookieStore = await cookies();
            const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            cookieStore.set('dashboard_session', JSON.stringify({
                userId: user.id,
                username: user.username,
                role: user.role
            }), {
                httpOnly: true,
                secure: false,
                sameSite: 'strict',
                expires: expires
            });

            redirect('/');
        }
    } else {
        return { error: result.error || 'Registration failed' };
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('dashboard_session');
    redirect('/login');
}

export async function getCurrentUser() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('dashboard_session');

        if (!session) return null;

        return JSON.parse(session.value);
    } catch (error) {
        return null;
    }
}

// Admin actions for managing invitation codes
export async function generateInvitationCode(expiresInDays?: number, maxUses: number = 1) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return { success: false, error: 'Unauthorized' };
        }

        const code = await createInvitationCode(currentUser.username, expiresInDays, maxUses);
        return { success: true, code: code.code };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function listInvitationCodes() {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return { success: false, error: 'Unauthorized', codes: [] };
        }

        const codes = await getInvitationCodes();
        return { success: true, codes };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error), codes: [] };
    }
}

export async function revokeCode(code: string) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return { success: false, error: 'Unauthorized' };
        }

        const result = await revokeInvitationCode(code);
        return { success: result };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function listUsers() {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return { success: false, error: 'Unauthorized', users: [] };
        }

        const users = await getUsers();
        return { success: true, users };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error), users: [] };
    }
}

export async function removeUser(userId: string) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return { success: false, error: 'Unauthorized' };
        }

        const result = await deleteUser(userId);
        return { success: result, error: result ? undefined : 'Cannot delete user' };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function promoteUser(userId: string, role: 'admin' | 'user') {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return { success: false, error: 'Unauthorized' };
        }

        const result = await setRole(userId, role);
        return { success: result };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}
