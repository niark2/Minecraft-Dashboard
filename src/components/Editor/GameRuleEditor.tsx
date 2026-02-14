'use client';

import { useState, useEffect } from 'react';
import { getGameRules, updateGameRule } from '@/actions/server';
import { useToast } from '@/components/Toast/ToastContext';
import styles from './GameRuleEditor.module.scss';

export default function GameRuleEditor({ serverId, serverState }: { serverId: string, serverState: string }) {
    const [rules, setRules] = useState<{ name: string, value: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        if (serverState === 'running') {
            fetchRules();
        } else {
            setLoading(false);
        }
    }, [serverId, serverState]);

    const fetchRules = async () => {
        setLoading(true);
        const res = await getGameRules(serverId);
        if (res.success && res.rules) {
            setRules(res.rules);
        }
        setLoading(false);
    };

    const handleToggle = async (ruleName: string, currentValue: string) => {
        const newValue = currentValue === 'true' ? 'false' : 'true';

        // Optimistic update
        setRules(rules.map(r => r.name === ruleName ? { ...r, value: newValue } : r));

        const res = await updateGameRule(serverId, ruleName, newValue);
        if (res.success) {
            showToast(`GameRule ${ruleName} updated to ${newValue}`, 'success');
        } else {
            showToast(`Failed to update ${ruleName}: ${res.error}`, 'error');
            // Rollback
            setRules(rules.map(r => r.name === ruleName ? { ...r, value: currentValue } : r));
        }
    };

    if (serverState !== 'running') {
        return (
            <div className={styles.container}>
                <h3 className={styles.title}>GameRules</h3>
                <div className={styles.offlineMessage}>
                    Server must be running to manage live GameRules.
                </div>
            </div>
        );
    }

    if (loading) return <div className={styles.loading}>Loading GameRules...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>GameRules (Live)</h3>
                <button className={styles.refreshBtn} onClick={fetchRules} title="Refresh">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                </button>
            </div>

            <div className={styles.rulesList}>
                {rules.map((rule) => (
                    <div key={rule.name} className={styles.ruleItem}>
                        <div className={styles.ruleInfo}>
                            <span className={styles.ruleName}>{rule.name}</span>
                        </div>
                        <div className={styles.ruleAction}>
                            <button
                                className={`${styles.toggle} ${rule.value === 'true' ? styles.active : ''}`}
                                onClick={() => handleToggle(rule.name, rule.value)}
                            >
                                <div className={styles.slider} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
