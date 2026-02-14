'use client';

import { User } from 'lucide-react';
import styles from './TopBar.module.scss';

interface UserInfoDisplayProps {
    username: string;
    role: string;
}

export default function UserInfoDisplay({ username, role }: UserInfoDisplayProps) {
    return (
        <div className={styles.userInfo}>
            <User size={16} />
            <span>{username}</span>
            {role === 'admin' && (
                <span className={styles.adminBadge}>Admin</span>
            )}
        </div>
    );
}
