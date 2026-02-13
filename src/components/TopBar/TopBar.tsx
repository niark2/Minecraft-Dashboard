'use client';

import Link from 'next/link';
import SettingsButton from '@/components/SettingsButton';
import LogoutButton from '@/components/LogoutButton';
import styles from './TopBar.module.scss';
import { usePathname } from 'next/navigation';

export default function TopBar() {
    const pathname = usePathname();

    // Don't show top bar on login page
    if (pathname === '/login') return null;

    return (
        <nav className={styles.topBar}>
            <div className={styles.container}>
                <Link href="/" className={styles.logo}>
                    <div className={styles.iconWrapper}>
                        <img src="/favicon.svg" alt="Logo" width={24} height={24} />
                    </div>
                    <span>Minecraft Dashboard.</span>
                </Link>

                <div className={styles.actions}>
                    <SettingsButton />
                    <LogoutButton />
                </div>
            </div>
        </nav>
    );
}
