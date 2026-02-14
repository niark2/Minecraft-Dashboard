'use client';

import { Settings, Shield, User, Info, RefreshCw, Github, AlertCircle, Users } from 'lucide-react';
import styles from './settings.module.scss';
import Link from 'next/link';
import { updateApplication, checkForUpdates } from '@/actions/system';
import { getCurrentUser } from '@/actions/auth';
import { useState, useTransition, useEffect } from 'react';
import UserManagement from '@/components/UserManagement';

type TabType = 'overview' | 'updates' | 'users';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isPending, startTransition] = useTransition();
    const [isChecking, setIsChecking] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
    const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean, commitsBehind?: number, latestMessage?: string } | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const user = await getCurrentUser();
            if (user) setUserRole(user.role);
        };
        fetchUser();
    }, []);

    const handleCheck = async () => {
        setIsChecking(true);
        setMessage(null);
        try {
            const info = await checkForUpdates();
            setUpdateInfo(info);
            if (!info.hasUpdate) {
                setMessage({ type: 'success', text: 'Your dashboard is up to date!' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to check for updates.' });
        } finally {
            setIsChecking(false);
        }
    };

    const handleUpdate = () => {
        if (!confirm('Are you sure you want to update? The dashboard will restart and be unavailable for a minute.')) return;

        startTransition(async () => {
            const result = await updateApplication();
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setUpdateInfo(null);
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        });
    };

    return (
        <div className={styles.container}>
            <Link href="/" className={styles.backLink}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to Dashboard
            </Link>

            <div className={styles.layout}>
                <aside className={styles.sidebar}>
                    <button
                        className={`${styles.navItem} ${activeTab === 'overview' ? styles.active : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <Settings size={20} />
                        <span>Overview</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'updates' ? styles.active : ''}`}
                        onClick={() => setActiveTab('updates')}
                    >
                        <RefreshCw size={20} />
                        <span>Updates</span>
                    </button>
                    {userRole === 'admin' && (
                        <button
                            className={`${styles.navItem} ${activeTab === 'users' ? styles.active : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            <Users size={20} />
                            <span>Users</span>
                        </button>
                    )}
                </aside>

                <main className={styles.content}>
                    {activeTab === 'overview' ? (
                        <div className={styles.card}>
                            <div className={styles.section}>
                                <h2>System Overview</h2>
                                <p>Information about your Minecraft Dashboard instance.</p>

                                <div className={styles.statusGrid}>
                                    <div className={styles.statusCard}>
                                        <div className={styles.statusIcon}>
                                            <Info size={20} />
                                        </div>
                                        <div className={styles.statusInfo}>
                                            <label>Version</label>
                                            <div className={styles.value}>v0.5.0</div>
                                        </div>
                                    </div>

                                    <div className={styles.statusCard}>
                                        <div className={styles.statusIcon}>
                                            <User size={20} />
                                        </div>
                                        <div className={styles.statusInfo}>
                                            <label>Administrator</label>
                                            <div className={styles.value}>Enabled</div>
                                        </div>
                                    </div>

                                    <div className={styles.statusCard}>
                                        <div className={styles.statusIcon}>
                                            <Shield size={20} />
                                        </div>
                                        <div className={styles.statusInfo}>
                                            <label>Security</label>
                                            <div className={styles.value} style={{ color: 'var(--success)' }}>Protected</div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.notice}>
                                    <Shield size={20} />
                                    <div>
                                        <strong>Managed via Environment</strong>
                                        <p>Global settings like credentials and ports are managed via environment variables for increased security and stability.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'updates' ? (
                        <div className={styles.card}>
                            <div className={styles.section}>
                                <h2>Updates</h2>
                                <p>Check for new versions available on GitHub.</p>

                                <div className={styles.updateStatus}>
                                    {message && (
                                        <div className={`${styles.alert} ${styles[message.type]}`}>
                                            {message.text}
                                        </div>
                                    )}

                                    {updateInfo?.hasUpdate ? (
                                        <div className={styles.updateAvailable}>
                                            <div className={styles.updateDetails}>
                                                <AlertCircle size={20} />
                                                <div>
                                                    <strong>Update Available!</strong>
                                                    <p>{updateInfo.commitsBehind} new commit(s) found.</p>
                                                    {updateInfo.latestMessage && (
                                                        <code className={styles.commitMsg}>
                                                            &quot;{updateInfo.latestMessage}&quot;
                                                        </code>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                className={styles.updateButton}
                                                onClick={handleUpdate}
                                                disabled={isPending}
                                            >
                                                {isPending ? (
                                                    <>
                                                        <RefreshCw size={18} className={styles.spin} />
                                                        Installing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw size={18} />
                                                        Update Now
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className={styles.checkButton}
                                            onClick={handleCheck}
                                            disabled={isChecking || isPending}
                                        >
                                            {isChecking ? (
                                                <>
                                                    <RefreshCw size={18} className={styles.spin} />
                                                    Checking GitHub...
                                                </>
                                            ) : (
                                                <>
                                                    <Github size={18} />
                                                    Check for Updates
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <p className={styles.helpText}>
                                        Your dashboard pulls updates from the main GitHub repository.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <UserManagement />
                    )}
                </main>
            </div>
        </div>
    );
}
