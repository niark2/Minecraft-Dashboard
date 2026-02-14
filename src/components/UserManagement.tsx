'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateInvitationCode, listInvitationCodes, revokeCode, listUsers, removeUser, promoteUser } from '@/actions/auth';
import { Ticket, Copy, XCircle, Trash2, UserPlus, Users, ShieldCheck } from 'lucide-react';
import styles from './UserManagement.module.scss';

interface InvitationCode {
    code: string;
    createdBy: string;
    createdAt: string;
    maxUses: number;
    uses: number;
    usedBy?: string[];
    usedAt?: string[];
    expiresAt?: string;
    isActive: boolean;
}

interface User {
    id: string;
    username: string;
    createdAt: string;
    role: 'admin' | 'user';
}

export default function UserManagement() {
    const [codes, setCodes] = useState<InvitationCode[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<'codes' | 'users'>('codes');
    const [expiryDays, setExpiryDays] = useState<number | undefined>(undefined);
    const [maxUses, setMaxUses] = useState<number>(1);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [codesResult, usersResult] = await Promise.all([
            listInvitationCodes(),
            listUsers()
        ]);

        if (codesResult.success) {
            setCodes(codesResult.codes);
        }

        if (usersResult.success) {
            setUsers(usersResult.users);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleGenerateCode = async () => {
        setGenerating(true);
        const result = await generateInvitationCode(expiryDays, maxUses);
        if (result.success) {
            await loadData();
            // Copy to clipboard
            if (result.code) {
                navigator.clipboard.writeText(result.code);
                alert(`Code generated and copied to clipboard: ${result.code}`);
            }
        } else {
            alert(`Error: ${result.error}`);
        }
        setGenerating(false);
    };

    const handleRevokeCode = async (code: string) => {
        if (!confirm('Are you sure you want to revoke this code?')) return;

        const result = await revokeCode(code);
        if (result.success) {
            await loadData();
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const handleDeleteUser = async (userId: string, username: string) => {
        if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

        const result = await removeUser(userId);
        if (result.success) {
            await loadData();
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const handlePromoteUser = async (userId: string, username: string, currentRole: 'admin' | 'user') => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        const actionName = newRole === 'admin' ? 'promote to Admin' : 'demote to User';

        if (!confirm(`Are you sure you want to ${actionName} "${username}"?`)) return;

        const result = await promoteUser(userId, newRole);
        if (result.success) {
            await loadData();
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Code copied to clipboard!');
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    if (loading) {
        return <div className={styles.loading}>Loading...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>User Management</h2>
                <p>Manage invitation codes and user accounts</p>
            </div>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'codes' ? styles.active : ''}`}
                    onClick={() => setActiveTab('codes')}
                >
                    <Ticket size={18} />
                    Invitation Codes
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    <Users size={18} />
                    Users
                </button>
            </div>

            {activeTab === 'codes' && (
                <div className={styles.section}>
                    <div className={styles.generateSection}>
                        <h3>Generate New Code</h3>
                        <div className={styles.generateForm}>
                            <div className={styles.inputGroup}>
                                <label>Expiry (days, optional)</label>
                                <input
                                    type="number"
                                    placeholder="No expiry"
                                    value={expiryDays || ''}
                                    onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Uses (max)</label>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Max uses"
                                    value={maxUses}
                                    onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
                                    className={styles.input}
                                />
                            </div>
                            <button
                                onClick={handleGenerateCode}
                                disabled={generating}
                                className={styles.generateBtn}
                            >
                                <UserPlus size={18} />
                                {generating ? 'Generating...' : 'Generate Code'}
                            </button>
                        </div>
                    </div>

                    <div className={styles.codesList}>
                        <h3>Invitation Codes ({codes.length})</h3>
                        {codes.length === 0 ? (
                            <p className={styles.empty}>No invitation codes yet. Generate one above.</p>
                        ) : (
                            <div className={styles.table}>
                                {codes.map((code) => (
                                    <div key={code.code} className={`${styles.codeItem} ${!code.isActive ? styles.inactive : ''}`}>
                                        <div className={styles.codeInfo}>
                                            <div className={styles.codeValue}>
                                                <Ticket size={16} />
                                                <code>{code.code}</code>
                                                <button
                                                    onClick={() => copyToClipboard(code.code)}
                                                    className={styles.copyBtn}
                                                    title="Copy to clipboard"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                            <div className={styles.codeDetails}>
                                                <span>Created by: {code.createdBy}</span>
                                                <span>Created: {formatDate(code.createdAt)}</span>
                                                {code.expiresAt && (
                                                    <span>Expires: {formatDate(code.expiresAt)}</span>
                                                )}
                                                <span>Uses: {code.uses} / {code.maxUses}</span>
                                                {code.usedBy && code.usedBy.length > 0 && (
                                                    <span className={styles.usedByList}>
                                                        Used by: {code.usedBy.join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.codeActions}>
                                            <span className={`${styles.status} ${code.isActive ? styles.active : styles.revoked}`}>
                                                {code.uses >= code.maxUses ? 'Used Up' : code.isActive ? 'Active' : 'Revoked'}
                                            </span>
                                            {code.isActive && code.uses < code.maxUses && (
                                                <button
                                                    onClick={() => handleRevokeCode(code.code)}
                                                    className={styles.revokeBtn}
                                                    title="Revoke code"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className={styles.section}>
                    <div className={styles.usersList}>
                        <h3>Registered Users ({users.length})</h3>
                        {users.length === 0 ? (
                            <p className={styles.empty}>No users registered yet.</p>
                        ) : (
                            <div className={styles.table}>
                                {users.map((user) => (
                                    <div key={user.id} className={styles.userItem}>
                                        <div className={styles.userInfo}>
                                            <div className={styles.userName}>
                                                <Users size={16} />
                                                <strong>{user.username}</strong>
                                                <span className={`${styles.role} ${styles[user.role]}`}>
                                                    {user.role}
                                                </span>
                                            </div>
                                            <div className={styles.userDetails}>
                                                <span>ID: {user.id}</span>
                                                <span>Joined: {formatDate(user.createdAt)}</span>
                                            </div>
                                        </div>
                                        <div className={styles.userActions}>
                                            <button
                                                onClick={() => handlePromoteUser(user.id, user.username, user.role)}
                                                className={user.role === 'admin' ? styles.demoteBtn : styles.promoteBtn}
                                                title={user.role === 'admin' ? "Demote to User" : "Make Admin"}
                                            >
                                                <ShieldCheck size={16} />
                                            </button>
                                            {user.role !== 'admin' && (
                                                <button
                                                    onClick={() => handleDeleteUser(user.id, user.username)}
                                                    className={styles.deleteBtn}
                                                    title="Delete user"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
