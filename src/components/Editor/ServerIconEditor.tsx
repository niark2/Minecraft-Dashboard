'use client';

import { useState, useEffect, useRef } from 'react';
import { getServerIcon, uploadServerIcon } from '@/actions/server';
import { useToast } from '@/components/Toast/ToastContext';
import styles from './ServerIconEditor.module.scss';

export default function ServerIconEditor({ serverId }: { serverId: string }) {
    const [icon, setIcon] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchIcon();
    }, [serverId]);

    const fetchIcon = async () => {
        setLoading(true);
        const data = await getServerIcon(serverId);
        setIcon(data);
        setLoading(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Minecraft icons must be 64x64 PNG
        // We'll use a canvas to resize it on the client side
        setUploading(true);

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, 64, 64);
                    const base64 = canvas.toDataURL('image/png');
                    const res: any = await uploadServerIcon(serverId, base64);
                    if (res.success) {
                        setIcon(base64);
                        showToast('Icon updated! Restart the server to apply.', 'success');
                    } else {
                        showToast('Failed to upload icon: ' + res.error, 'error');
                    }
                }
                setUploading(false);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className={styles.iconCard}>
            <h3 className={styles.title}>Server Icon</h3>

            <div className={styles.previewWrapper}>
                {loading ? (
                    <div className={styles.placeholder}>Loading...</div>
                ) : icon ? (
                    <img src={icon} alt="Server Icon" className={styles.preview} />
                ) : (
                    <div className={styles.placeholder}>No Icon (64x64 PNG)</div>
                )}
            </div>

            <input
                type="file"
                className={styles.hiddenInput}
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
            />

            <button
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
            >
                {uploading ? 'Uploading...' : 'Upload New Icon'}
            </button>

            <p className={styles.info}>
                Image will be automatically resized to 64x64 PNG.<br />
                Server restart required.
            </p>
        </div>
    );
}
