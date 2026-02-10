'use client';

import { useState } from 'react';
import { updateServerResources } from '@/actions/server';
import { useToast } from '@/components/Toast/ToastContext';
import styles from './PropertiesEditor.module.scss'; // Reusing styles
import { MinecraftServer } from '@/types/server';

export default function SystemResourcesEditor({ server }: { server: MinecraftServer }) {
    const [minRam, setMinRam] = useState(server.minMemory || '2G');
    const [maxRam, setMaxRam] = useState(server.maxMemory || '2G');
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    const handleSave = async () => {
        setSaving(true);
        const res = await updateServerResources(server.id, minRam, maxRam);
        if (res.success) {
            showToast('Resources updated! Server is restarting...', 'success');
            // We might want to trigger a refresh or let the revalidatePath handle it
            // But since this component is inside a client component that holds state,
            // we should probably trust the revalidation or manual reload if needed.
            // For now, revalidatePath in action should trigger a server component refresh, 
            // but client component state (server) won't update unless parent re-renders with new props.
            // We can reload the page to be sure?
            window.location.reload();
        } else {
            showToast('Failed to update resources: ' + res.error, 'error');
        }
        setSaving(false);
    };

    return (
        <div className={styles.editor}>
            <h3 className={styles.title}>System Resources</h3>
            <table className={styles.propertiesTable}>
                <tbody>
                    <tr>
                        <td className={styles.key}>Minimum RAM (Xms)</td>
                        <td className={styles.value}>
                            <input
                                value={minRam}
                                placeholder="e.g. 1G, 512M"
                                onChange={(e) => setMinRam(e.target.value)}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td className={styles.key}>Maximum RAM (Xmx)</td>
                        <td className={styles.value}>
                            <input
                                value={maxRam}
                                placeholder="e.g. 4G, 2048M"
                                onChange={(e) => setMaxRam(e.target.value)}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                * Changing these values will restart the server container.
            </div>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Updating & Restarting...' : 'Apply Resources'}
            </button>
        </div>
    );
}
