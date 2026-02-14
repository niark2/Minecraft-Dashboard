'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast/ToastContext';
import styles from './SetupManager.module.scss';
import { MinecraftServer } from '@/types/server';
import DashboardMetadataEditor from '@/components/Editor/DashboardMetadataEditor';
import { deleteServer, shareServerWithUser, unshareServerWithUser, getSharedUsers } from '@/actions/server';
import { Settings, Server, Trash2, Cpu, Tag, HardDrive, Users, UserPlus, X } from 'lucide-react';

interface SharedUser {
    id: string;
    username: string;
}

export default function SetupManager({ server }: { server: MinecraftServer }) {
    const [loading, setLoading] = useState(false);
    const [sharingLoading, setSharingLoading] = useState(false);
    const [shareUsername, setShareUsername] = useState('');
    const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
    const { showToast } = useToast();

    useEffect(() => {
        const fetchSharedUsers = async () => {
            const users = await getSharedUsers(server.id);
            setSharedUsers(users);
        };
        fetchSharedUsers();
    }, [server.id]);

    const handleDelete = async () => {
        if (confirm('Are you ABSOLUTELY sure? This will permanently delete the server and all its data.')) {
            setLoading(true);
            const res = await deleteServer(server.id);
            if (res.success) {
                window.location.href = '/';
            } else {
                showToast('Failed to delete server: ' + res.error, 'error');
                setLoading(false);
            }
        }
    };

    const handleShare = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shareUsername.trim()) return;

        setSharingLoading(true);
        try {
            const res = await shareServerWithUser(server.id, shareUsername.trim());
            if (res.success) {
                showToast(`Server shared with ${shareUsername}`, 'success');
                setShareUsername('');
                // Refresh list
                const users = await getSharedUsers(server.id);
                setSharedUsers(users);
            } else {
                showToast(res.error || 'Failed to share server', 'error');
            }
        } catch (err) {
            showToast('An error occurred', 'error');
        } finally {
            setSharingLoading(false);
        }
    };

    const handleUnshare = async (userId: string, username: string) => {
        if (!confirm(`Are you sure you want to remove access for ${username}?`)) return;

        try {
            const res = await unshareServerWithUser(server.id, userId);
            if (res.success) {
                showToast(`Access removed for ${username}`, 'success');
                // Refresh list
                const users = await getSharedUsers(server.id);
                setSharedUsers(users);
            } else {
                showToast(res.error || 'Failed to remove access', 'error');
            }
        } catch (err) {
            showToast('An error occurred', 'error');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                {/* Dashboard Identity */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <Tag size={20} className={styles.icon} />
                        <h3>Dashboard Identity</h3>
                    </div>

                    {/* Reusing existing component but wrapped in our new layout */}
                    <DashboardMetadataEditor server={server} />
                </div>

                {/* Server Sharing */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <Users size={20} className={styles.icon} />
                        <h3>Server Sharing</h3>
                    </div>

                    <div className={styles.sharingContent}>
                        <div className={styles.sharingList}>
                            {sharedUsers.length > 0 ? (
                                sharedUsers.map(user => (
                                    <div key={user.id} className={styles.sharedUser}>
                                        <div className={styles.userInfo}>
                                            <Users size={16} />
                                            <span>{user.username}</span>
                                        </div>
                                        <button
                                            className={styles.removeBtn}
                                            onClick={() => handleUnshare(user.id, user.username)}
                                            title="Remove access"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.noSharing}>
                                    This server is not shared with anyone yet.
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleShare} className={styles.shareForm}>
                            <input
                                type="text"
                                placeholder="Username to share with..."
                                value={shareUsername}
                                onChange={(e) => setShareUsername(e.target.value)}
                                disabled={sharingLoading}
                            />
                            <button
                                type="submit"
                                className={styles.shareBtn}
                                disabled={sharingLoading || !shareUsername.trim()}
                            >
                                {sharingLoading ? 'Sharing...' : (
                                    <>
                                        <UserPlus size={18} />
                                        <span>Share</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Technical Details */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <Server size={20} className={styles.icon} />
                        <h3>Container Details</h3>
                    </div>

                    <div className={styles.infoList}>
                        <div className={styles.infoItem}>
                            <label>Docker Image</label>
                            <div className={styles.value}>{server.image}</div>
                        </div>
                        <div className={styles.infoItem}>
                            <label>Internal Port</label>
                            <div className={styles.value}>25565 (TCP)</div>
                        </div>
                        <div className={styles.infoItem}>
                            <label>Public Port</label>
                            <div className={styles.value}>{server.port}</div>
                        </div>
                        <div className={styles.infoItem}>
                            <label>Container ID</label>
                            <div className={styles.value}>{server.id}</div>
                        </div>
                        <div className={styles.infoItem}>
                            <label>Server Type</label>
                            <div className={styles.value}>{server.type.toUpperCase()}</div>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className={`${styles.card} ${styles.dangerCard}`}>
                    <div className={`${styles.cardHeader} ${styles.dangerHeader}`}>
                        <Trash2 size={20} className={styles.icon} />
                        <h3>Danger Zone</h3>
                    </div>

                    <div className={styles.dangerContent}>
                        <p>
                            Irreversibly delete this server and all its associated data (world, configs, backups).
                            This action cannot be undone. Please ensure you have backed up any important data before proceeding.
                        </p>

                        <button
                            className={styles.deleteBtn}
                            onClick={handleDelete}
                            disabled={loading}
                        >
                            <Trash2 size={16} />
                            {loading ? 'Deleting Server...' : 'Delete Server Permanently'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

