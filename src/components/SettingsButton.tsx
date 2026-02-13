'use client';

import { Settings } from 'lucide-react';
import Link from 'next/link';
import styles from './SettingsButton.module.scss';

export default function SettingsButton() {
    return (
        <Link href="/settings" className={styles.settingsBtn} title="Settings">
            <Settings size={20} />
            <span>Settings</span>
        </Link>
    );
}
