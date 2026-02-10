import { getServerStatus } from '@/actions/server';
import { notFound } from 'next/navigation';
import ServerClientPage from './ServerClientPage';

export default async function ServerManagementPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const server = await getServerStatus(id);

    if (!server) {
        return notFound();
    }

    return <ServerClientPage initialServer={server} />;
}
