'use client';

import { MinecraftServer } from '@/types/server';
import { startServer, stopServer, deleteServer, getPublicIp } from '@/actions/server';
import { useState, useEffect } from 'react';
import styles from './ServerCard.module.scss';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Play, Square, RotateCcw, LayoutDashboard, Copy, Check, Cpu } from 'lucide-react';

export default function ServerCard({ server }: { server: MinecraftServer }) {
    const [loading, setLoading] = useState(false);
    const [hostname, setHostname] = useState('localhost');
    const [copied, setCopied] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchIp = async () => {
            // Fallback default
            if (typeof window !== 'undefined') {
                setHostname(window.location.hostname);
            }
            try {
                // Try to get real public IP from server
                const ip = await getPublicIp();
                if (ip) setHostname(ip);
            } catch (e) {
                // Keep window.location.hostname on failure
            }
        };
        fetchIp();
    }, []);

    const handleAction = async (action: 'start' | 'stop' | 'delete' | 'restart') => {
        setLoading(true);
        try {
            if (action === 'start') await startServer(server.id);
            if (action === 'stop') await stopServer(server.id);
            if (action === 'restart') {
                await stopServer(server.id);
                await startServer(server.id);
            }
            if (action === 'delete') {
                if (confirm('Are you sure you want to delete this server? Data will be lost.')) {
                    await deleteServer(server.id);
                }
            }
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Action failed');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        const address = `${hostname}:${server.port}`;
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const statusColor = server.state === 'running' ? '#4ade80' : '#ef4444';

    return (
        <div className={styles.card}>
            <div className={styles.icon}>
                {server.logoUrl ? (
                    <span className={styles.customLogo}>{server.logoUrl}</span>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                )}
                MINECRAFT SERVER
            </div>

            <div className={styles.header}>
                <div className={styles.nameRow}>
                    <h3>{server.name}</h3>
                    {server.state === 'running' && <div className={styles.pulse} />}
                </div>
            </div>

            <div className={styles.details}>
                <div className={styles.addressBox} onClick={copyToClipboard} title="Click to copy address">
                    <div className={styles.addressLabel}>Server Address</div>
                    <div className={styles.addressValue}>
                        <span className={styles.hostname}>{hostname}</span>
                        <span className={styles.port}>:{server.port}</span>
                        {copied ? <Check size={14} className={styles.copyIcon} style={{ color: 'var(--success)' }} /> : <Copy size={14} className={styles.copyIcon} />}
                    </div>

                    <div className={styles.engineMeta}>
                        <span className={styles.engineName}>{server.type} engine</span>
                        <span className={`${styles.versionBadge} ${server.version.includes('1.20') ? styles.ver_cherry :
                            server.version.includes('1.19') ? styles.ver_wild :
                                server.version.includes('1.18') ? styles.ver_caves :
                                    server.version.includes('1.16') ? styles.ver_nether :
                                        styles.ver_default
                            }`}>
                            {server.version}
                        </span>
                    </div>
                </div>

                <div className={styles.stats}>
                    <span className={styles.statusSpan}>
                        <div className={styles.dot} style={{ background: statusColor }} />
                        {server.state.toUpperCase()}
                    </span>
                    <span className={styles.ramSpan}>
                        <Cpu size={14} />
                        {server.memory} RAM
                    </span>
                </div>
            </div>

            <div className={styles.actions}>
                <Link href={`/server/${server.id}`} className={`${styles.actionBtn} ${styles.manageBtn}`}>
                    <LayoutDashboard size={16} /> Manage Server
                </Link>

                <div className={styles.row}>
                    {server.state === 'running' ? (
                        <>
                            <button onClick={() => handleAction('stop')} disabled={loading} className={`${styles.actionBtn} ${styles.stopBtn}`}>
                                <Square size={14} fill="currentColor" /> Stop
                            </button>
                            <button onClick={() => handleAction('restart')} disabled={loading} className={`${styles.actionBtn} ${styles.restartActionBtn}`}>
                                <RotateCcw size={14} /> Reboot
                            </button>
                        </>
                    ) : (
                        <button onClick={() => handleAction('start')} disabled={loading} className={`${styles.actionBtn} ${styles.startBtn}`}>
                            <Play size={14} fill="currentColor" /> Start Server
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
