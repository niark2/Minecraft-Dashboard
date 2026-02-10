import styles from './page.module.scss';
import { getServers } from '@/actions/server';
import ServerCard from '@/components/ServerCard';
import CreateServerModal from '@/components/CreateServerModal'; // We'll create a wrapper for the modal

export const dynamic = 'force-dynamic';

export default async function Home() {
  const servers = await getServers();

  return (
    <main className={`${styles.main} page-transition`}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1>Minecraft Dashboard</h1>
            <p>Your personal gaming infrastructure. 100% self-hosted.</p>
          </div>
          <CreateServerModal />
        </div>
      </header>

      <div className={`${styles.grid} animate-slide`}>
        {servers.length === 0 ? (
          <div className={styles.empty}>
            <p>No active servers found on this host.</p>
            <p>Deploy a new instance to get started.</p>
          </div>
        ) : (
          servers.map(server => (
            <ServerCard key={server.id} server={server} />
          ))
        )}
      </div>
    </main>
  );
}
