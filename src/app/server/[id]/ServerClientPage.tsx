'use client';

import { useState } from 'react';
import { MinecraftServer } from '@/types/server';
import { startServer, stopServer, restartServer, deleteServer, getServerMetrics } from '@/actions/server';
import { useEffect } from 'react';
import { RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import Console from '@/components/Console/Console';
import PropertiesEditor from '@/components/Editor/PropertiesEditor';
import ServerIconEditor from '@/components/Editor/ServerIconEditor';
import FileExplorer from '@/components/FileExplorer/FileExplorer';
import PlayerManager from '@/components/PlayerManager/PlayerManager';
import MapManager from '@/components/MapManager/MapManager';
import AddonManager from '@/components/AddonManager/AddonManager';
import DashboardMetadataEditor from '@/components/Editor/DashboardMetadataEditor';
import GameRuleEditor from '@/components/Editor/GameRuleEditor';
import SystemResourcesEditor from '@/components/Editor/SystemResourcesEditor';
import SetupManager from '@/components/SetupManager/SetupManager';
import LogoutButton from '@/components/LogoutButton';
import SettingsButton from '@/components/SettingsButton';
import styles from './page.module.scss';
import Link from 'next/link';

type Tab = 'console' | 'files' | 'properties' | 'setup' | 'players' | 'map' | 'addons';

export default function ServerClientPage({ initialServer }: { initialServer: MinecraftServer }) {
    const [server, setServer] = useState(initialServer);
    const [activeTab, setActiveTab] = useState<Tab>('console');
    const [loading, setLoading] = useState(false);
    const [metrics, setMetrics] = useState({
        cpu: '0.0',
        memory: { usage: '0.0', limit: server.memory },
        uptimeMs: 0
    });

    useEffect(() => {
        const fetchMetrics = async () => {
            if (server.state !== 'running') return;
            const res = await getServerMetrics(server.id);
            if (res.success) {
                setMetrics({
                    cpu: res.cpu!,
                    memory: res.memory!,
                    uptimeMs: res.uptimeMs!
                });
            }
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 5000);
        return () => clearInterval(interval);
    }, [server.id, server.state]);

    const formatUptime = (ms: number) => {
        if (ms <= 0) return 'Offline';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    const handleAction = async (action: 'start' | 'stop' | 'restart') => {
        setLoading(true);
        let res;
        if (action === 'start') res = await startServer(server.id);
        if (action === 'stop') res = await stopServer(server.id);
        if (action === 'restart') res = await restartServer(server.id);

        if (res?.success) {
            setServer({ ...server, state: action === 'stop' ? 'exited' : 'running' });
        }
        setLoading(false);
    };

    const statusColor = server.state === 'running' ? 'var(--success)' : 'var(--danger)';

    return (
        <div className={styles.manageContainer}>
            <Link href="/" className={styles.backLink}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to Dashboard
            </Link>

            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <h1>{server.name}.</h1>
                    <div className={styles.statusLine}>
                        <div className={styles.dot} style={{ background: statusColor }} />
                        {server.state.toUpperCase()} • {server.version} • {server.type.toUpperCase()}
                    </div>
                </div>

                <div className={styles.quickActions}>
                    {server.state === 'running' ? (
                        <>
                            <button onClick={() => handleAction('restart')} disabled={loading} className={styles.btn}>
                                Reboot
                            </button>
                            <button onClick={() => handleAction('stop')} disabled={loading} className={styles.btn}>
                                Stop
                            </button>
                        </>
                    ) : (
                        <button onClick={() => handleAction('start')} disabled={loading} className={`${styles.btn} ${styles.btnPrimary}`}>
                            Start Server
                        </button>
                    )}
                </div>
            </header>

            <nav className={styles.tabNav}>
                {(['console', 'players', 'addons', 'files', 'properties', 'map', 'setup'] as Tab[])
                    .filter(tab => {
                        // Hide addons tab for vanilla servers
                        if (tab === 'addons') {
                            const type = server.type.toLowerCase();
                            return type.includes('forge') || type.includes('fabric') || type.includes('spigot') || type.includes('paper') || type.includes('purpur');
                        }
                        return true;
                    })
                    .map((tab) => (
                        <button
                            key={tab}
                            className={`${styles.tabItem} ${activeTab === tab ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
            </nav>

            <div key={activeTab} className={`${styles.tabContent} animate-fade`}>
                {activeTab === 'map' && (
                    <div style={{ maxWidth: '900px' }}>
                        <MapManager serverId={server.id} />
                    </div>
                )}
                {activeTab === 'console' && (
                    <div className={styles.gridSection}>
                        <div>
                            <h2 className={styles.sectionTitle}>Live Logs</h2>
                            <Console serverId={server.id} />
                        </div>
                        <aside>
                            <h2 className={styles.sectionTitle}>Resources</h2>
                            <div className={styles.configCard}>
                                <div className={styles.setupList}>
                                    <div className={styles.setupItem}>
                                        <label>CPU Usage</label>
                                        <div className={styles.value}>{metrics.cpu}%</div>
                                    </div>
                                    <div className={styles.setupItem}>
                                        <label>Memory Usage</label>
                                        <div className={styles.value}>{metrics.memory.usage} GB / {metrics.memory.limit} GB</div>
                                    </div>
                                    <div className={styles.setupItem}>
                                        <label>Uptime</label>
                                        <div className={styles.value}>{formatUptime(metrics.uptimeMs)}</div>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                )}

                {activeTab === 'files' && (
                    <div>
                        <h2 className={styles.sectionTitle}>File Explorer</h2>
                        <FileExplorer serverId={server.id} />
                    </div>
                )}

                {activeTab === 'properties' && (
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: '400px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div>
                                <h2 className={styles.sectionTitle}>Server Configuration</h2>
                                <SystemResourcesEditor server={server} />
                                <div style={{ height: '2rem' }} />
                                <PropertiesEditor serverId={server.id} />
                            </div>
                            <div>
                                <h2 className={styles.sectionTitle}>GameRules (Live)</h2>
                                <GameRuleEditor serverId={server.id} serverState={server.state} />
                            </div>
                        </div>
                        <div style={{ width: '350px' }}>
                            <h2 className={styles.sectionTitle}>In-Game Icon</h2>
                            <ServerIconEditor serverId={server.id} />
                        </div>
                    </div>
                )}

                {activeTab === 'setup' && (
                    <SetupManager server={server} />
                )}

                {activeTab === 'players' && (
                    <div style={{ width: '100%' }}>
                        <PlayerManager serverId={server.id} />
                    </div>
                )}

                {activeTab === 'addons' && (
                    <div style={{ width: '100%' }}>
                        <h2 className={styles.sectionTitle}>Plugin & Mod Manager</h2>
                        <AddonManager server={server} />
                    </div>
                )}
            </div>
        </div>
    );
}
