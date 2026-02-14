'use server';

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

        // 2. Retourner les instructions pour le redémarrage manuel
        return {
            success: true,
            message: 'Files updated successfully! To apply the changes, please run: docker compose up -d --build'
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

