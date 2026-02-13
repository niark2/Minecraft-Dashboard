'use server';

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function checkForUpdates() {
    try {
        // 1. On récupère les infos de GitHub sans fusionner
        await execAsync('git fetch', { cwd: '/app_host' });

        // 2. On compare la branche locale avec la branche distante
        // 'HEAD..@{u}' compte combien de commits on a de retard sur le serveur distant
        const { stdout } = await execAsync('git rev-list --count HEAD..@{u}', {
            cwd: '/app_host'
        });

        const count = parseInt(stdout.trim(), 10);

        if (count > 0) {
            // Optionnel : on récupère le message du dernier commit pour l'afficher
            const { stdout: commitMsg } = await execAsync('git log -1 --pretty=%B origin/$(git rev-parse --abbrev-ref HEAD)', {
                cwd: '/app_host'
            });

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

        // 1. On récupère les dernières sources depuis GitHub
        // On suppose que le projet est monté dans /app_host dans le conteneur
        console.log('Running git pull...');
        const { stdout: pullOutput, stderr: pullError } = await execAsync('git pull', {
            cwd: '/app_host'
        });
        console.log('Git Pull Output:', pullOutput);
        if (pullError) console.error('Git Pull Stderr:', pullError);

        // 2. On lance la reconstruction en arrière-plan
        // Cette commande va reconstruire l'image et redémarrer le conteneur.
        // Comme c'est cette même application qui tourne, elle va se couper.
        // Le "nohup" et "&" permettent de détacher le processus pour qu'il survive à l'arrêt du conteneur actuel.
        console.log('Triggering docker rebuild...');

        // On utilise 'docker compose' (version moderne)
        const rebuildCmd = 'docker compose -f /app_host/docker-compose.yml up -d --build';

        // On lance sans attendre (car le conteneur va mourir)
        exec(rebuildCmd, { cwd: '/app_host' });

        return {
            success: true,
            message: 'Update started. The dashboard will restart in a few moments.'
        };
    } catch (error: any) {
        console.error('Update failed:', error);
        return {
            success: false,
            message: error.message || 'An error occurred during update'
        };
    }
}
