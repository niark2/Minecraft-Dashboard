'use client';

import { logout } from '@/actions/auth';
import { LogOut } from 'lucide-react';
import styles from './LogoutButton.module.scss';
import { useTransition } from 'react';

export default function LogoutButton() {
    const [isPending, startTransition] = useTransition();

    const handleLogout = () => {
        startTransition(async () => {
            await logout();
        });
    };

    return (
        <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            disabled={isPending}
            title="Logout"
        >
            <LogOut size={20} />
            <span>{isPending ? 'Logging out...' : 'Logout'}</span>
        </button>
    );
}
