'use client';

import { login } from '@/actions/auth';
import { useActionState } from 'react';
import { Shield, KeyRound, User } from 'lucide-react';
import styles from './login.module.scss'; // We will create this SCSS file next

const initialState = {
    error: '',
};

export default function LoginPage() {
    // Correct usage of useActionState for form handling in React 19 / Next.js 15+
    // Note: useActionState returns [state, formAction, isPending]
    const [state, formAction, isPending] = useActionState(login, initialState);

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.iconWrapper}>
                        <Shield size={40} className={styles.icon} />
                    </div>
                    <h1>Minecraft Dashboard</h1>
                    <p>Enter your credentials to access the control panel</p>
                </div>

                <form action={formAction} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="username">Username</label>
                        <div className={styles.inputWrapper}>
                            <User size={18} className={styles.inputIcon} />
                            <input
                                type="text"
                                id="username"
                                name="username"
                                placeholder="admin"
                                required
                                className={styles.input}
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password">Password</label>
                        <div className={styles.inputWrapper}>
                            <KeyRound size={18} className={styles.inputIcon} />
                            <input
                                type="password"
                                id="password"
                                name="password"
                                placeholder="••••••••"
                                required
                                className={styles.input}
                            />
                        </div>
                    </div>

                    {state?.error && (
                        <div className={styles.error}>
                            {state.error}
                        </div>
                    )}

                    <button type="submit" className={styles.submitBtn} disabled={isPending}>
                        {isPending ? 'Authenticating...' : 'Login'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p>Protected System</p>
                </div>
            </div>
        </div>
    );
}
