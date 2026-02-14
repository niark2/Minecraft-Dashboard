'use client';

import { useState, useEffect } from 'react';
import { updateDashboardMetadata } from '@/actions/server';
import { useToast } from '@/components/Toast/ToastContext';
import styles from './DashboardMetadataEditor.module.scss';
import { MinecraftServer } from '@/types/server';

export default function DashboardMetadataEditor({ server }: { server: MinecraftServer }) {
    const [name, setName] = useState(server.name);
    const [selectedIcon, setSelectedIcon] = useState(server.logoUrl || '🌳');
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    const icons = ['🌳', '🏔️', '⚔️', '📦', '🏗️', '🧪', '💎', '🔥', '💀'];

    const handleSave = async () => {
        setSaving(true);
        const res = await updateDashboardMetadata(server.id, {
            name: name,
            logoUrl: selectedIcon
        });

        if (res.success) {
            showToast('Dashboard metadata updated!', 'success');
        } else {
            showToast('Failed to update metadata: ' + res.error, 'error');
        }
        setSaving(false);
    };

    return (
        <div className={styles.editor}>
            <h3 className={styles.title}>Dashboard Appearance</h3>

            <div className={styles.group}>
                <label>Display Name</label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. My Awesome Server"
                />
                <small>This name is only for the dashboard display.</small>
            </div>

            <div className={styles.group}>
                <label>Dashboard Icon</label>
                <div className={styles.iconPicker}>
                    {icons.map(icon => (
                        <button
                            key={icon}
                            type="button"
                            className={`${styles.iconBtn} ${selectedIcon === icon ? styles.activeIcon : ''}`}
                            onClick={() => setSelectedIcon(icon)}
                        >
                            {icon}
                        </button>
                    ))}
                </div>
            </div>

            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Updating...' : 'Save Appearance'}
            </button>
        </div>
    );
}
