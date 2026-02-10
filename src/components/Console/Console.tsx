'use client';

import { useEffect, useRef, useState } from 'react';
import { getServerLogs, sendServerCommand } from '@/actions/server';
import styles from './Console.module.scss';

export default function Console({ serverId }: { serverId: string }) {
    const [logs, setLogs] = useState<string>('');
    const [command, setCommand] = useState('');
    const [sending, setSending] = useState(false);
    const [startTime, setStartTime] = useState<number>(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        const newLogs = await getServerLogs(serverId, startTime);
        setLogs(newLogs);
    };

    const handleClear = () => {
        setLogs('');
        setStartTime(Math.floor(Date.now() / 1000));
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, [serverId, startTime]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleSendCommand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim() || sending) return;

        setSending(true);
        const res = await sendServerCommand(serverId, command.trim());
        if (res.success) {
            setCommand('');
            setTimeout(fetchLogs, 500);
        }
        setSending(false);
    };

    return (
        <div className={styles.consoleWrapper} style={{ height: '600px', maxHeight: '600px', display: 'flex', flexDirection: 'column' }}>
            <div className={styles.header}>
                <span>System Console</span>
                <button onClick={handleClear} className={styles.clearBtn} title="Clear Console View">
                    Clear Log
                </button>
            </div>
            <div className={styles.console} ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {logs.split('\n').map((line, i) => {
                    if (!line.trim()) return null;

                    const timeMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
                    let content = line;
                    let time = '';

                    if (timeMatch) {
                        time = timeMatch[1];
                        content = line.substring(timeMatch[0].length).trim();
                    }

                    // Determine style
                    let lineStyle = {};
                    let contentStyle = {};

                    if (content.toLowerCase().includes('error') || content.toLowerCase().includes('exception') || content.includes('Failed')) {
                        contentStyle = { color: '#ff5555', fontWeight: 'bold' };
                    } else if (content.includes('WARN')) {
                        contentStyle = { color: '#ffaa00' };
                    } else if (content.includes('INFO')) {
                        contentStyle = { color: '#e0e0e0' };
                    }

                    // Special event highlighting
                    if (content.includes('joined the game')) {
                        contentStyle = { color: '#ffff55' };
                    } else if (content.includes('left the game')) {
                        contentStyle = { color: '#ffff55' };
                    } else if (content.includes('UUID of player')) {
                        contentStyle = { color: '#55ffff', fontStyle: 'italic', fontSize: '0.8rem' };
                    } else if (content.includes('Done') && content.includes('For help')) {
                        contentStyle = { color: '#55ff55', fontWeight: 'bold' };
                    } else if (content.includes('Stopping server')) {
                        contentStyle = { color: '#ff5555', fontWeight: 'bold' };
                    } else if (content.match(/<.+>/)) {
                        // Player chat: <Name> Message
                        contentStyle = { color: '#fff' };
                    } else if (content.includes('[Server thread/INFO]:')) {
                        // Clean up the thread info for cleaner look if desired, or keep it
                        // Let's dim the thread info
                        const parts = content.split(']:');
                        if (parts.length > 1) {
                            return (
                                <div key={i} className={styles.logLine}>
                                    {time && <span className={styles.logTime}>{time}</span>}
                                    <span style={{ color: '#666' }}>{parts[0]}]:</span>
                                    <span style={{ color: '#eee', marginLeft: '6px' }}>{parts.slice(1).join(']:')}</span>
                                </div>
                            );
                        }
                    }

                    return (
                        <div key={i} className={styles.logLine} style={lineStyle}>
                            {time && <span className={styles.logTime}>{time}</span>}
                            <span style={contentStyle}>{content}</span>
                        </div>
                    );
                })}
            </div>
            <form className={styles.inputArea} onSubmit={handleSendCommand}>
                <span className={styles.prompt}>$</span>
                <input
                    type="text"
                    className={styles.commandInput}
                    placeholder="Type a command (e.g. say hello, op player...)"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    disabled={sending}
                />
            </form>
        </div>
    );
}
