import Link from 'next/link';
import SettingsButton from '@/components/SettingsButton';
import LogoutButton from '@/components/LogoutButton';
import UserInfoDisplay from './UserInfoDisplay';
import styles from './TopBar.module.scss';
import { getCurrentUser } from '@/actions/auth';

export default async function TopBar() {
    const currentUser = await getCurrentUser();

    if (!currentUser) return null;

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
                    <UserInfoDisplay username={currentUser.username} role={currentUser.role} />
                    <SettingsButton />
                    <LogoutButton />
                </div>
            </div>
        </nav>
    );
}
