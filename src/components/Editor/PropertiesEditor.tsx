'use client';

import { useState, useEffect } from 'react';
import { getServerFileContent, updateServerConfig } from '@/actions/server';
import { useToast } from '@/components/Toast/ToastContext';
import styles from './PropertiesEditor.module.scss';

const DEFAULT_KEYS = [
    'motd',
    'max-players',
    'difficulty',
    'pvp',
    'level-seed',
    'gamemode',
    'view-distance',
    'online-mode',
    'white-list'
];

export default function PropertiesEditor({ serverId }: { serverId: string }) {
    const [properties, setProperties] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        loadProperties();
    }, [serverId]);

    const loadProperties = async () => {
        setLoading(true);
        const content = await getServerFileContent(serverId, '/data/server.properties');

        if (!content.startsWith('Error:')) {
            const parsed: Record<string, string> = {};
            content.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                    const [key, ...rest] = trimmed.split('=');
                    parsed[key.trim()] = rest.join('=').trim();
                }
            });
            setProperties(parsed);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const res: any = await updateServerConfig(serverId, properties);
        if (res.success) {
            showToast('Properties saved! Restart the server to apply.', 'success');
        } else {
            showToast('Failed to save config: ' + res.error, 'error');
        }
        setSaving(false);
    };

    if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Loading properties...</div>;

    // We only show the principal keys to keep the interface clean
    const principalKeys = DEFAULT_KEYS;

    return (
        <div className={styles.editor}>
            <h3 className={styles.title}>Server Properties</h3>
            <table className={styles.propertiesTable}>
                <tbody>
                    {principalKeys.map((key) => (
                        <tr key={key}>
                            <td className={styles.key}>{key}</td>
                            <td className={styles.value}>
                                {properties[key] === 'true' || properties[key] === 'false' ? (
                                    <button
                                        className={`${styles.toggle} ${properties[key] === 'true' ? styles.active : ''}`}
                                        onClick={() => {
                                            setProperties({
                                                ...properties,
                                                [key]: properties[key] === 'true' ? 'false' : 'true'
                                            });
                                        }}
                                    >
                                        <div className={styles.slider} />
                                    </button>
                                ) : (
                                    <input
                                        value={properties[key] || ''}
                                        placeholder="Enter value"
                                        onChange={(e) => {
                                            setProperties({
                                                ...properties,
                                                [key]: e.target.value
                                            });
                                        }}
                                    />
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
            </button>
        </div>
    );
}
