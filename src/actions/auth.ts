'use server'

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(prevState: { error: string }, formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    const envUsername = process.env.DASHBOARD_USERNAME;
    const envPassword = process.env.DASHBOARD_PASSWORD;

    if (username === envUsername && password === envPassword) {
        // Set a session cookie
        const cookieStore = await cookies();
        // Calculate expiration (e.g., 7 days)
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        cookieStore.set('dashboard_session', 'authenticated', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            expires: expires
        });

        redirect('/');
    } else {
        return { error: 'Invalid username or password' };
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('dashboard_session');
    redirect('/login');
}
