'use client';

import { register } from '@/actions/auth';
import { useActionState } from 'react';
import { Shield, KeyRound, User, Ticket } from 'lucide-react';
import Link from 'next/link';
import styles from '../login/login.module.scss';

const initialState = {
    error: '',
};

export default function RegisterPage() {
    const [state, formAction, isPending] = useActionState(register, initialState);

    return (
        <div className={styles.container}>
            <div className={styles.visualSide}>
                <div className={styles.brandInfo}>
                    <div className={styles.iconWrapper}>
                        <Shield size={40} className={styles.icon} />
                    </div>
                    <h1>Minecraft Dashboard.</h1>
                    <p>
                        Join our gaming infrastructure.
                        Create your account with an invitation code to start managing Minecraft servers.
                    </p>
                </div>
            </div>

            <div className={styles.formSide}>
                <div className={styles.card}>
                    <div className={styles.mobileHeader}>
                        <div className={styles.iconWrapper}>
                            <Shield size={30} className={styles.icon} />
                        </div>
                        <h1>Register</h1>
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
                                    placeholder="Choose a username"
                                    required
                                    className={styles.input}
                                    minLength={3}
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
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <div className={styles.inputWrapper}>
                                <KeyRound size={20} className={styles.inputIcon} />
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    placeholder="••••••••"
                                    required
                                    className={styles.input}
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="invitationCode">Invitation Code</label>
                            <div className={styles.inputWrapper}>
                                <Ticket size={20} className={styles.inputIcon} />
                                <input
                                    type="text"
                                    id="invitationCode"
                                    name="invitationCode"
                                    placeholder="Enter your invitation code"
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
                            {isPending ? 'Creating Account...' : 'Create Account'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <Link href="/login" style={{ color: '#4a9eff', textDecoration: 'none' }}>
                                Already have an account? Login
                            </Link>
                        </div>
                    </form>

                    <div className={styles.footer}>
                        <p>Protected System • 2024</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
