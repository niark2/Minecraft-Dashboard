'use client';

import { createServer, getMinecraftVersions } from '@/actions/server';
import { useState, useEffect } from 'react';
import styles from './CreateServerForm.module.scss';
import { useRouter } from 'next/navigation';

export default function CreateServerForm({ onSuccess }: { onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState<string[]>(['latest']);
    const router = useRouter();
    const [selectedIcon, setSelectedIcon] = useState('🌳');

    useEffect(() => {
        getMinecraftVersions().then(items => {
            setVersions(['latest', ...items]);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        try {
            const res = await createServer(formData);
            if (res.success) {
                router.refresh();
                onSuccess();
            } else {
                alert('Error: ' + res.error);
            }
        } catch (err) {
            alert('Failed to create server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.group}>
                <label>Dashboard Icon</label>
                <div className={styles.iconPicker}>
                    {['🌳', '🏔️', '⚔️', '📦', '🏗️', '🧪', '💎', '🔥', '💀'].map(icon => (
                        <button
                            key={icon}
                            type="button"
                            className={`${styles.iconBtn} ${selectedIcon === icon ? styles.activeIcon : ''}`}
                            onClick={() => setSelectedIcon(icon)}
                        >
                            {icon}
                        </button>
                    ))}
                    <input type="hidden" name="icon" value={selectedIcon} />
                </div>
            </div>

            <div className={styles.group}>
                <label>Server Name</label>
                <input name="name" placeholder="my-survival-world" required pattern="[a-zA-Z0-9-]+" />
                <small>Only letters, numbers, and dashes.</small>
            </div>

            <div className={styles.row}>
                <div className={styles.group}>
                    <label>Type</label>
                    <select name="type">
                        <option value="vanilla">Vanilla</option>
                        <option value="paper">Paper (Optimized Plugins)</option>
                        <option value="fabric">Fabric (Modern Modded)</option>
                    </select>
                </div>
                <div className={styles.group}>
                    <label>Version</label>
                    <select name="version">
                        {versions.map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className={styles.row}>
                <div className={styles.group}>
                    <label>Memory</label>
                    <select name="memory">
                        <option value="2G">2 GB</option>
                        <option value="4G">4 GB</option>
                        <option value="8G">8 GB</option>
                        <option value="12G">12 GB</option>
                    </select>
                </div>
                <div className={styles.group}>
                    <label>Port</label>
                    <input name="port" defaultValue="25565" type="number" />
                </div>
            </div>

            <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? 'Deploying Container...' : 'Create Server'}
            </button>
        </form>
    );
}
