'use server';

import { exec } from 'child_process';
import { promisify } from 'util';
import docker from '@/lib/docker';
import { readFile } from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Détecte automatiquement le chemin absolu du projet sur l'hôte
 * en inspectant les mounts du conteneur actuel via l'API Docker.
 * Fallback sur HOST_PROJECT_PATH si la détection échoue.
 */
async function getHostProjectPath(): Promise<string> {
    // Fallback explicite
    if (process.env.HOST_PROJECT_PATH) {
        return process.env.HOST_PROJECT_PATH;
    }

    try {
        // Le hostname d'un conteneur Docker est son container ID (short)
        const hostname = (await readFile('/etc/hostname', 'utf-8')).trim();
        const container = docker.getContainer(hostname);
        const info = await container.inspect();

        // Chercher le mount dont la destination est /app_host
        const appHostMount = info.Mounts.find(
            (m: { Destination: string }) => m.Destination === '/app_host'
        );

        if (appHostMount?.Source) {
            console.log(`Auto-detected host project path: ${appHostMount.Source}`);
            return appHostMount.Source;
        }
    } catch (err) {
        console.warn('Could not auto-detect host path:', err);
    }

    throw new Error(
        'Cannot detect host project path. Set HOST_PROJECT_PATH in your .env file.'
    );
}

export async function checkForUpdates() {
    try {
        await execAsync('git fetch', { cwd: '/app_host' });

        const { stdout } = await execAsync('git rev-list --count HEAD..@{u}', {
            cwd: '/app_host'
        });

        const count = parseInt(stdout.trim(), 10);

        if (count > 0) {
            const { stdout: commitMsg } = await execAsync(
                'git log -1 --pretty=%B origin/$(git rev-parse --abbrev-ref HEAD)',
                { cwd: '/app_host' }
            );

            return {
                hasUpdate: true,
                commitsBehind: count,
                latestMessage: commitMsg.trim()
            };
        }

        return { hasUpdate: false };
    } catch (error) {
        console.error('Check failed:', error);
        return { hasUpdate: false, error: 'Could not connect to GitHub' };
    }
}

export async function updateApplication() {
    try {
        console.log('Starting application update...');

        // 1. Récupérer les dernières sources depuis GitHub
        console.log('Running git pull...');
        const { stdout: pullOutput, stderr: pullError } = await execAsync('git pull', {
            cwd: '/app_host'
        });
        console.log('Git Pull Output:', pullOutput);
        if (pullError) console.error('Git Pull Stderr:', pullError);

        // 2. Détecter le chemin hôte automatiquement
        const hostPath = await getHostProjectPath();

        console.log(`Triggering docker rebuild with host path: ${hostPath}`);
        const rebuildCmd = `nohup sh -c 'sleep 3 && docker compose -f /app_host/docker-compose.yml --project-directory ${hostPath} up -d --build' > /app_host/update.log 2>&1 &`;

        // Lancer sans attendre (le conteneur actuel sera remplacé)
        exec(rebuildCmd);

        return {
            success: true,
            message: 'Update started. The dashboard will restart in a few moments.'
        };
    } catch (error: unknown) {
        console.error('Update failed:', error);
        const errMessage = error instanceof Error ? error.message : 'An error occurred during update';
        return {
            success: false,
            message: errMessage
        };
    }
}
