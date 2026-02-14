'use client';

import { useState, useEffect } from 'react';
import { getServerFiles, FileInfo } from '@/actions/server';
import styles from './FileExplorer.module.scss';
import FileEditor from './FileEditor';

export default function FileExplorer({ serverId }: { serverId: string }) {
    const [currentPath, setCurrentPath] = useState('/data');
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingFile, setEditingFile] = useState<FileInfo | null>(null);

    useEffect(() => {
        loadFiles(currentPath);
    }, [serverId, currentPath]);

    const loadFiles = async (path: string) => {
        setLoading(true);
        const data = await getServerFiles(serverId, path);
        setFiles(data);
        setLoading(false);
    };

    const handleNavigate = (path: string) => {
        setCurrentPath(path);
    };

    const breadcrumbs = currentPath.split('/').filter(Boolean);

    return (
        <div className={styles.explorer}>
            <div className={styles.breadcrumb}>
                <span onClick={() => handleNavigate('/data')}>/data</span>
                {breadcrumbs.map((folder, idx) => {
                    if (folder === 'data') return null;
                    const path = '/' + breadcrumbs.slice(0, idx + 1).join('/');
                    return (
                        <span key={path} onClick={() => handleNavigate(path)}>
                            / {folder}
                        </span>
                    );
                })}
            </div>

            <div className={styles.fileList}>
                {loading ? (
                    <div className={styles.loading}>Loading files...</div>
                ) : files.length === 0 ? (
                    <div className={styles.empty}>This folder is empty.</div>
                ) : (
                    files.map((file) => (
                        <div
                            key={file.path}
                            className={styles.fileItem}
                            onClick={() => {
                                if (file.isDirectory) handleNavigate(file.path);
                                else setEditingFile(file);
                            }}
                        >
                            {file.isDirectory ? (
                                <svg className={styles.directoryIcon} viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg>
                            ) : (
                                <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                            )}
                            {file.name}
                        </div>
                    ))
                )}
            </div>

            {editingFile && (
                <FileEditor
                    serverId={serverId}
                    filePath={editingFile.path}
                    fileName={editingFile.name}
                    onClose={() => {
                        setEditingFile(null);
                        loadFiles(currentPath);
                    }}
                />
            )}
        </div>
    );
}
