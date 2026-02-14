import docker from '@/lib/docker';

const CONTAINER_LABEL = 'com.minecraft.managed';

/**
 * Vérifie si l'utilisateur actuel a le droit d'accéder au serveur
 * Les admins ont accès à tous les serveurs
 * Les utilisateurs normaux n'ont accès qu'à leurs propres serveurs
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

        // Check if server belongs to user
        const container = docker.getContainer(serverId);
        const info = await container.inspect();

        const owner = info.Config.Labels?.['com.minecraft.owner'];
        return owner === currentUser.userId;
    } catch (error) {
        console.error('Error checking server ownership:', error);
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
