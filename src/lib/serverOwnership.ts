import docker from '@/lib/docker';

const CONTAINER_LABEL = 'com.minecraft.managed';

/**
 * Vérifie si l'utilisateur actuel a le droit d'accéder au serveur
 * Les admins ont accès à tous les serveurs
 * Les utilisateurs normaux n'ont accès qu'à leurs propres serveurs ou ceux partagés avec eux
 */
export async function checkServerOwnership(serverId: string, currentUser: { userId: string; role: string }): Promise<boolean> {
    try {
        if (!currentUser) {
            return false;
        }

        // Admins can access all servers
        if (currentUser.role === 'admin') {
            return true;
        }

        // 1. Check direct ownership via labels
        const container = docker.getContainer(serverId);
        const info = await container.inspect();

        const owner = info.Config.Labels?.['com.minecraft.owner'];
        if (owner === currentUser.userId) {
            return true;
        }

        // 2. Check shared access via metadata file in container
        // We use a simplified version of getServerFileContent to avoid circular dependencies
        try {
            const exec = await container.exec({
                Cmd: ['cat', '/data/.dashboard_meta.json'],
                AttachStdout: true,
                AttachStderr: true,
                Tty: false
            });

            const stream = await exec.start({});

            const content: string = await new Promise((resolve) => {
                let output = '';
                stream.on('data', (chunk: Buffer) => {
                    // Minimal demux: skip Docker headers if they exist
                    let offset = 0;
                    while (offset < chunk.length) {
                        if (chunk.length < offset + 8) break;
                        const type = chunk.readUInt8(offset);
                        const size = chunk.readUInt32BE(offset + 4);
                        offset += 8;
                        if (type === 1) { // stdout
                            output += chunk.slice(offset, offset + size).toString();
                        }
                        offset += size;
                    }
                });
                stream.on('end', () => resolve(output));
                stream.on('error', () => resolve(''));
                // Timeout after 2s
                setTimeout(() => resolve(''), 2000);
            });

            if (content) {
                const meta = JSON.parse(content);
                if (Array.isArray(meta.sharedWith)) {
                    return meta.sharedWith.includes(currentUser.userId);
                }
            }
        } catch (e) {
            // File might not exist or be invalid, ignore
        }

        return false;
    } catch (error) {
        console.error('Error checking server ownership:', error);
        return false;
    }
}

/**
 * Vérifie si l'utilisateur est le propriétaire DIRECT (label com.minecraft.owner)
 * Utilisé pour les actions sensibles (suppression, partage, changement de ressources)
 */
export async function checkServerDirectOwnership(serverId: string, currentUser: { userId: string; role: string }): Promise<boolean> {
    try {
        if (!currentUser) return false;
        if (currentUser.role === 'admin') return true;

        const container = docker.getContainer(serverId);
        const info = await container.inspect();
        const owner = info.Config.Labels?.['com.minecraft.owner'];

        return owner === currentUser.userId;
    } catch (error) {
        console.error('Error checking server direct ownership:', error);
        return false;
    }
}



/**
 * Wrapper pour les actions sur les serveurs avec vérification de propriété
 */
export async function withOwnershipCheck<T>(
    serverId: string,
    action: () => Promise<T>,
    errorMessage: string = 'Unauthorized access to server'
): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: 'Not authenticated' };
        }

        const hasAccess = await checkServerOwnership(serverId, currentUser);
        if (!hasAccess) {
            return { success: false, error: errorMessage };
        }

        const result = await action();
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
