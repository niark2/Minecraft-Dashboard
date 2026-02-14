'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast/ToastContext';
import styles from './SetupManager.module.scss';
import { MinecraftServer } from '@/types/server';
import DashboardMetadataEditor from '@/components/Editor/DashboardMetadataEditor';
import { deleteServer } from '@/actions/server';
import { Settings, Server, Trash2, Cpu, Tag, HardDrive } from 'lucide-react';

export default function SetupManager({ server }: { server: MinecraftServer }) {
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

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
