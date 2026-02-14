'use client';

import { useState, useEffect } from 'react';
import { getAddons, toggleAddon, deleteAddon, uploadAddon, installAddon } from '@/actions/server';
import styles from './AddonManager.module.scss';
import { useToast } from '@/components/Toast/ToastContext';
import { MinecraftServer } from '@/types/server';

const CATALOG = {
    plugins: [
        { name: 'EssentialsX', desc: 'Essential commands (Home, Warp, TPA)', url: 'https://github.com/EssentialsX/Essentials/releases/download/2.20.1/EssentialsX-2.20.1.jar', filename: 'EssentialsX.jar' },
        { name: 'LuckPerms', desc: 'Advanced permissions management', url: 'https://download.luckperms.net/v5.4.131/bukkit/LuckPerms-Bukkit-5.4.131.jar', filename: 'LuckPerms.jar' },
        { name: 'Vault', desc: 'Economy & Permissions API', url: 'https://github.com/MilkBowl/Vault/releases/download/1.7.3/Vault.jar', filename: 'Vault.jar' },
        { name: 'ViaVersion', desc: 'Allow newer clients to join', url: 'https://github.com/ViaVersion/ViaVersion/releases/download/5.2.1/ViaVersion-5.2.1.jar', filename: 'ViaVersion.jar' },
        { name: 'Geyser', desc: 'Allow Bedrock players to join', url: 'https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot', filename: 'Geyser-Spigot.jar' },
    ],
    mods: [
        { name: 'LuckPerms (Fabric)', desc: 'Permissions for Fabric servers', url: 'https://download.luckperms.net/v5.4.131/fabric/LuckPerms-Fabric-5.4.131.jar', filename: 'LuckPerms-Fabric.jar' },
        { name: 'Lithium', desc: 'Game engine optimization (TICK rate)', url: 'https://github.com/CaffeineMC/lithium-fabric/releases/download/mc1.21.1-0.13.0/lithium-fabric-mc1.21.1-0.13.0.jar', filename: 'lithium.jar' },
        { name: 'FerriteCore (Fabric)', desc: 'Memory usage optimization', url: 'https://github.com/malte0811/FerriteCore/releases/download/6.0.1/ferritecore-6.0.1-fabric.jar', filename: 'ferritecore.jar' },
    ]
};

export default function AddonManager({ server }: { server: MinecraftServer }) {
    const [addons, setAddons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState<string | null>(null);
    const { showToast } = useToast();

    const isModded = server.type.toLowerCase().includes('fabric') || server.type.toLowerCase().includes('forge');
    const activeCategory = isModded ? 'mods' : 'plugins';
    const label = isModded ? 'Mod (Fabric)' : 'Plugin';

    useEffect(() => {
        fetchAddons();
    }, [server.id]);

    const fetchAddons = async () => {
        setLoading(true);
        const res = await getAddons(server.id);
        if (res.success) {
            setAddons(res.addons || []);
        }
        setLoading(false);
    };

    const handleInstall = async (item: any) => {
        setInstalling(item.name);
        showToast(`Installing ${item.name}...`, 'info');
        const res: any = await installAddon(server.id, item.url, item.filename, activeCategory);
        if (res.success) {
            showToast(`${item.name} installed!`, 'success');
            fetchAddons();
        } else {
            showToast(`Failed to install: ${res.error}`, 'error');
        }
        setInstalling(null);
    };

    const handleToggle = async (addon: any) => {
        const res: any = await toggleAddon(server.id, addon.name, addon.type, !addon.enabled);
        if (res.success) {
            showToast(`${activeCategory === 'plugins' ? 'Plugin' : 'Mod'} ${addon.enabled ? 'Disabled' : 'Enabled'}`, 'success');
            fetchAddons();
        } else {
            showToast('Failed to toggle', 'error');
        }
    };

    const handleDelete = async (addon: any) => {
        if (!confirm(`Delete ${addon.name}?`)) return;
        const res: any = await deleteAddon(server.id, addon.name, addon.type);
        if (res.success) {
            showToast('Deleted successfully', 'success');
            fetchAddons();
        } else {
            showToast('Failed to delete', 'error');
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showToast(`Uploading ${file.name} to ${activeCategory}...`, 'info');

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const res: any = await uploadAddon(server.id, base64, file.name, activeCategory);

            if (res.success) {
                showToast('Upload successful!', 'success');
                fetchAddons();
            } else {
                showToast('Upload failed: ' + res.error, 'error');
            }
        };
        reader.readAsDataURL(file);
    };

    if (loading) return <div className={styles.container}>Loading addons...</div>;

    const filteredAddons = addons.filter(a => a.type === activeCategory);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>
                    Installed {label}s ({filteredAddons.length})
                </h3>
                <label className={styles.uploadLabel}>
                    + Upload {label} (.jar)
                    <input type="file" accept=".jar" hidden onChange={handleUpload} />
                </label>
            </div>

            <div className={styles.list}>
                {filteredAddons.length === 0 && (
                    <div className={styles.emptyState}>
                        <p>No {label.toLowerCase()}s found in /data/{activeCategory}</p>
                    </div>
                )}
                {filteredAddons.map((addon) => (
                    <div key={addon.id} className={styles.addonCard}>
                        <div className={styles.addonInfo}>
                            <div className={styles.icon}>📦</div>
                            <div className={styles.details}>
                                <div className={styles.name} style={{ textDecoration: addon.enabled ? 'none' : 'line-through', color: addon.enabled ? 'white' : 'gray' }}>
                                    {addon.cleanName}
                                </div>
                                <div className={styles.meta}>
                                    <span>{addon.size} bytes</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            <div
                                className={`${styles.toggleSwitch} ${addon.enabled ? styles.active : ''}`}
                                onClick={() => handleToggle(addon)}
                                title={addon.enabled ? "Disable" : "Enable"}
                            >
                                <div className={styles.slider} />
                            </div>
                            <button className={styles.deleteBtn} onClick={() => handleDelete(addon)} title="Delete">🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            <h3 className={styles.title} style={{ marginTop: '3rem', marginBottom: '1.2rem' }}>One-Click {label} Catalog</h3>
            <div className={styles.catalogGrid}>
                {CATALOG[activeCategory].map((item: any) => (
                    <div key={item.name} className={styles.catalogCard}>
                        <div style={{ marginBottom: '1rem' }}>
                            <div className={styles.catalogName}>{item.name}</div>
                            <div className={styles.catalogDesc}>{item.desc}</div>
                        </div>
                        <button
                            className={styles.installBtn}
                            onClick={() => handleInstall(item)}
                            disabled={!!installing}
                        >
                            {installing === item.name ? 'Installing...' : 'Install'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
