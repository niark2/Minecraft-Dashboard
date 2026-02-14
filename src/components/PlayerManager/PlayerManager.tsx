'use client';

import { useState, useEffect } from 'react';
import { getOnlinePlayers, getPlayerManagementData, sendServerCommand, getPlayerStats } from '@/actions/server';
import { useToast } from '@/components/Toast/ToastContext';
import styles from './PlayerManager.module.scss';

export default function PlayerManager({ serverId }: { serverId: string }) {
    const [onlinePlayers, setOnlinePlayers] = useState<string[]>([]);
    const [ops, setOps] = useState<any[]>([]);
    const [banned, setBanned] = useState<any[]>([]);
    const [playerDetails, setPlayerDetails] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { showToast } = useToast();

    const fetchData = async () => {
        const [online, data] = await Promise.all([
            getOnlinePlayers(serverId),
            getPlayerManagementData(serverId)
        ]);

        setOnlinePlayers(online);
        setOps(data.ops || []);
        setBanned(data.banned || []);
        setLoading(false);

        // Fetch extra stats for online players individually to avoid massive state jumps
        online.forEach(async (player) => {
            const stats = await getPlayerStats(serverId, player);
            if (stats.success) {
                setPlayerDetails(prev => ({
                    ...prev,
                    [player]: { ...prev[player], ...stats }
                }));
            }
        });
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [serverId]);

    const handleAction = async (player: string, action: string) => {
        setActionLoading(player + action);
        let command = '';
        switch (action) {
            case 'op': command = `op ${player}`; break;
            case 'deop': command = `deop ${player}`; break;
            case 'kick': command = `kick ${player}`; break;
            case 'ban': command = `ban ${player}`; break;
            case 'unban': command = `pardon ${player}`; break;
        }

        if (command) {
            const res = await sendServerCommand(serverId, command);
            if (res.success) {
                showToast(`Action ${action} successful for ${player}`, 'success');
                await fetchData();
            } else {
                showToast(`Action failed: ${res.error}`, 'error');
            }
        }
        setActionLoading(null);
    };

    const isOp = (name: string) => ops.some(o => o.name?.toLowerCase() === name.toLowerCase());

    if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Gathering player data...</div>;

    return (
        <div className={styles.container}>
            <section className={styles.section}>
                <h2 className={styles.title}>Connected Players</h2>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Mode</th>
                                <th>Health</th>
                                <th>Food</th>
                                <th>XP</th>
                                <th>Held Item</th>
                                <th>Location</th>
                                <th>Dimension</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {onlinePlayers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className={styles.emptyState}>No players online.</td>
                                </tr>
                            ) : (
                                onlinePlayers.map(player => (
                                    <tr key={player}>
                                        <td>
                                            <div className={styles.playerCell}>
                                                <img
                                                    src={`https://minotar.net/helm/${player}/32.png`}
                                                    alt={player}
                                                    className={styles.avatar}
                                                />
                                                <span className={styles.name}>{player}</span>
                                                {isOp(player) && <span className={`${styles.badge} ${styles.opBadge}`}>OP</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                color: playerDetails[player]?.mode === 'Creative' ? '#5ff' : '#fff'
                                            }}>
                                                {playerDetails[player]?.mode || '...'}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 700, color: '#f44' }}>
                                            {playerDetails[player]?.health ? `❤ ${(parseFloat(playerDetails[player].health) / 2 || 0).toFixed(1)}` : '...'}
                                        </td>
                                        <td style={{ color: '#d94' }}>
                                            {playerDetails[player]?.food ? `🍖 ${(parseInt(playerDetails[player].food) / 2 || 0).toFixed(1)}` : '...'}
                                        </td>
                                        <td style={{ color: '#5f5', fontWeight: 800 }}>
                                            {playerDetails[player]?.xp !== undefined ? `Lvl ${parseInt(playerDetails[player].xp) || 0}` : '...'}
                                        </td>
                                        <td style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#aaa' }}>
                                            {playerDetails[player]?.item || '...'}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                            {playerDetails[player]?.pos || '...'}
                                        </td>
                                        <td>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: playerDetails[player]?.dim === 'Nether' ? '#511' : playerDetails[player]?.dim === 'End' ? '#313' : '#131'
                                            }}>
                                                {playerDetails[player]?.dim || '...'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.actions}>
                                                {isOp(player) ? (
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => handleAction(player, 'deop')}
                                                        disabled={!!actionLoading}
                                                    >
                                                        DEOP
                                                    </button>
                                                ) : (
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => handleAction(player, 'op')}
                                                        disabled={!!actionLoading}
                                                    >
                                                        OP
                                                    </button>
                                                )}
                                                <button
                                                    className={styles.actionBtn}
                                                    onClick={() => handleAction(player, 'kick')}
                                                    disabled={!!actionLoading}
                                                >
                                                    KICK
                                                </button>
                                                <button
                                                    className={`${styles.actionBtn} ${styles.dangerBtn}`}
                                                    onClick={() => handleAction(player, 'ban')}
                                                    disabled={!!actionLoading}
                                                >
                                                    BAN
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {banned.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.title}>Banned Users</h2>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>Reason</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {banned.map(player => (
                                    <tr key={player.name}>
                                        <td>
                                            <div className={styles.playerCell}>
                                                <img
                                                    src={`https://minotar.net/helm/${player.name}/32.png`}
                                                    alt={player.name}
                                                    className={styles.avatar}
                                                />
                                                <span className={styles.name}>{player.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            {player.reason || 'No reason given'}
                                        </td>
                                        <td>
                                            <div className={styles.actions}>
                                                <button
                                                    className={styles.actionBtn}
                                                    onClick={() => handleAction(player.name, 'unban')}
                                                    disabled={!!actionLoading}
                                                >
                                                    PARDON
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}
