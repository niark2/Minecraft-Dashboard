'use client';

import { useState, useEffect } from 'react';
import { getServerFileContent, saveServerFileContent } from '@/actions/server';
import styles from './FileEditor.module.scss';

interface FileEditorProps {
    serverId: string;
    filePath: string;
    fileName: string;
    onClose: () => void;
}

export default function FileEditor({ serverId, filePath, fileName, onClose }: FileEditorProps) {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadContent = async () => {
            const data = await getServerFileContent(serverId, filePath);
            setContent(data);
            setLoading(false);
        };
        loadContent();
    }, [serverId, filePath]);

    const handleSave = async () => {
        setSaving(true);
        const res = await saveServerFileContent(serverId, filePath, content);
        if (res.success) {
            onClose();
        } else {
            alert('Failed to save file: ' + res.error);
        }
        setSaving(false);
    };

    return (
        <div className={styles.editorOverlay} onClick={onClose}>
            <div className={styles.editorModal} onClick={e => e.stopPropagation()}>
                <header className={styles.editorHeader}>
                    <div>
                        <h3>Editor.</h3>
                        <span className={styles.fileName}>{fileName}</span>
                    </div>
                    <button className={styles.cancelBtn} onClick={onClose}>×</button>
                </header>

                <div className={styles.content}>
                    {loading ? (
                        <div style={{ color: 'var(--text-secondary)' }}>Loading content...</div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            spellCheck={false}
                            autoFocus
                        />
                    )}
                </div>

                <footer className={styles.editorFooter}>
                    <button className={`${styles.btn} ${styles.cancelBtn}`} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={`${styles.btn} ${styles.saveBtn}`}
                        onClick={handleSave}
                        disabled={saving || loading}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
