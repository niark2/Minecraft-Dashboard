'use client';

import { useState } from 'react';
import CreateServerForm from './CreateServerForm';
import styles from './CreateServerModal.module.scss';

export default function CreateServerModal() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button className={styles.triggerBtn} onClick={() => setIsOpen(true)}>
                + New Instance
            </button>

            {isOpen && (
                <div className={styles.overlay} onClick={() => setIsOpen(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.header}>
                            <h2>Deploy Server</h2>
                            <button onClick={() => setIsOpen(false)} className={styles.close}>×</button>
                        </div>
                        <CreateServerForm onSuccess={() => setIsOpen(false)} />
                    </div>
                </div>
            )}
        </>
    );
}
