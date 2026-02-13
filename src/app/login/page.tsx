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
    const [state, formAction, isPending] = useActionState(login, initialState);

    return (
        <div className={styles.container}>
            <div className={styles.visualSide}>
                <div className={styles.brandInfo}>
                    <div className={styles.iconWrapper}>
                        <Shield size={40} className={styles.icon} />
                    </div>
                    <h1>Minecraft Dashboard.</h1>
                    <p>
                        Your personal gaming infrastructure.
                        Efficiently manage, monitor, and scale your Minecraft instances with a single click.
                    </p>
                </div>
            </div>

            <div className={styles.formSide}>
                <div className={styles.card}>
                    <div className={styles.mobileHeader}>
                        <div className={styles.iconWrapper}>
                            <Shield size={30} className={styles.icon} />
                        </div>
                        <h1>Login</h1>
                    </div>

                    <form action={formAction} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="username">Username</label>
                            <div className={styles.inputWrapper}>
                                <User size={20} className={styles.inputIcon} />
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
                                <KeyRound size={20} className={styles.inputIcon} />
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
                            {isPending ? 'Authenticating...' : 'Login to Panel'}
                        </button>
                    </form>

                    <div className={styles.footer}>
                        <p>Protected System • 2024</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
