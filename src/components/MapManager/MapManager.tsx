'use client';

import { useState, useEffect } from 'react';
import { getWorldInfo, createWorldBackup, resetWorld, listBackups, deleteBackup } from '@/actions/server';
import { useToast } from '@/components/Toast/ToastContext';
import styles from './MapManager.module.scss';
import { Archive, Download, Upload, Trash2, HardDrive, Globe, RefreshCw, AlertTriangle, FileArchive, Calendar } from 'lucide-react';

export default function MapManager({ serverId }: { serverId: string }) {
    const [world, setWorld] = useState<{ name: string; size: string } | null>(null);
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const { showToast } = useToast();

    const loadData = async () => {
        setLoading(true);
        const [infoRes, backupsRes] = await Promise.all([
            getWorldInfo(serverId),
            listBackups(serverId)
        ]);

        if (infoRes.success) {
            setWorld({ name: infoRes.name!, size: infoRes.size! });
        }

        if (backupsRes.success) {
            setBackups(backupsRes.backups || []);
        }

        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [serverId]);

    const handleBackup = async () => {
        setActionLoading(true);
        const res: any = await createWorldBackup(serverId);
        if (res.success) {
            showToast(res.message!, 'success');
            loadData(); // Refresh list
        } else {
            showToast('Backup failed: ' + res.error, 'error');
        }
        setActionLoading(false);
    };

    const handleDownload = () => {
        showToast('Preparing download archive...', 'info');
        window.location.href = `/api/server/${serverId}/download-world`;
    };

    const handleDownloadBackup = (filename: string) => {
        // We'll need an endpoint for this too, or just use the same download logic if we can target a file
        // For now, let's assume we can add a route later or just support world download.
        // Actually, downloading a specific backup file is different.
        // Let's postpone specific backup download unless we add the API route.
        // For now, just show a toast that it's manual via FTP or similar?
        // Or better: Use the file explorer download link if available.
        // Let's implement a simple "Download" button that points to a new API route we'll need to create or just placeholder.
        showToast('Direct backup download coming soon. Use File Explorer to download tar.gz files.', 'info');
    };

    const handleDeleteBackup = async (filename: string) => {
        if (!confirm(`Delete backup ${filename}?`)) return;

        setActionLoading(true);
        const res = await deleteBackup(serverId, filename);
        if (res.success) {
            showToast('Backup deleted', 'success');
            setBackups(backups.filter(b => b.name !== filename));
        } else {
            showToast('Failed to delete: ' + res.error, 'error');
        }
        setActionLoading(false);
    };

    const handleReset = async () => {
        if (!confirm('CRITICAL: This will PERMANENTLY delete your world and generate a new one. All progress will be lost. Are you sure?')) return;

        setActionLoading(true);
        showToast('Stopping server and deleting world...', 'info');
        const res: any = await resetWorld(serverId);
        if (res.success) {
            showToast(res.message, 'success');
            await loadData();
        } else {
            showToast('Reset failed: ' + res.error, 'error');
        }
        setActionLoading(false);
    };

    if (loading) return (
        <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <span>Reading world data...</span>
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                {/* Active World Card */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <Globe size={20} className={styles.icon} />
                        <h3>Active World</h3>
                    </div>

                    <div className={styles.worldInfo}>
                        <div className={styles.infoRow}>
                            <span className={styles.label}>Folder Name</span>
                            <span className={styles.value}>{world?.name}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.label}>Disk Usage</span>
                            <span className={styles.value}>{world?.size}</span>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={handleBackup}
                            disabled={actionLoading}
                        >
                            <Archive size={16} /> Create Backup
                        </button>
                        <button
                            className={styles.btn}
                            onClick={handleDownload}
                            disabled={actionLoading}
                        >
                            <Download size={16} /> Download World
                        </button>
                    </div>
                </div>

                {/* Reset Zone */}
                <div className={`${styles.card} ${styles.dangerCard}`}>
                    <div className={styles.cardHeader}>
                        <AlertTriangle size={20} className={styles.icon} />
                        <h3>Danger Zone</h3>
                    </div>
                    <p className={styles.dangerText}>
                        Resetting the world will delete the current world folder and generate a new seed. This action cannot be undone unless you have a backup.
                    </p>
                    <button
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={handleReset}
                        disabled={actionLoading}
                    >
                        <RefreshCw size={16} /> Reset World
                    </button>
                </div>
            </div>

            {/* Backups List */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <HardDrive size={20} className={styles.icon} />
                    <h3>Backups ({backups.length})</h3>
                </div>

                <div className={styles.backupsList}>
                    {backups.length === 0 ? (
                        <div className={styles.emptyState}>No backups found. Create one above!</div>
                    ) : (
                        backups.map((backup) => (
                            <div key={backup.name} className={styles.backupItem}>
                                <div className={styles.backupInfo}>
                                    <FileArchive size={24} className={styles.fileIcon} />
                                    <div>
                                        <div className={styles.backupName}>{backup.name}</div>
                                        <div className={styles.backupMeta}>
                                            <span className={styles.size}>{Math.round(backup.size / 1024 / 1024 * 10) / 10} MB</span>
                                            <span className={styles.date}><Calendar size={12} /> {backup.date}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.backupActions}>
                                    {/* Placeholder for download */}
                                    {/* <button className={styles.iconBtn} title="Download" onClick={() => handleDownloadBackup(backup.name)}>
                                        <Download size={16} />
                                    </button> */}
                                    <button
                                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                        title="Delete"
                                        onClick={() => handleDeleteBackup(backup.name)}
                                        disabled={actionLoading}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
