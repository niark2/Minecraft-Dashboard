'use server'

import { revalidatePath } from 'next/cache';
import docker from '@/lib/docker';
import { MinecraftServer } from '@/types/server';

const CONTAINER_LABEL = 'com.minecraft.managed';

function validateAndSanitizePath(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    if (!normalized.startsWith('/data')) {
        throw new Error('Access denied: Path must start with /data');
    }
    if (normalized.includes('..')) {
        throw new Error('Access denied: Directory traversal detected');
    }
    // Allow alphanumeric, dot, dash, underscore, slash, space
    if (!/^[a-zA-Z0-9_\-\.\/ ]+$/.test(normalized)) {
        throw new Error('Invalid characters in path');
    }
    return normalized;
}

export async function getPublicIp(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json', { next: { revalidate: 3600 } });
        if (!response.ok) throw new Error('Failed to fetch IP');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Failed to resolve public IP:', error);
        return ''; // Return empty to let frontend fallback to window.location
    }
}

export async function getServers(): Promise<MinecraftServer[]> {
    try {
        // Get current user to filter servers
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return [];
        }

        const containers = await docker.listContainers({ all: true });

        const results = await Promise.all(containers
            .filter(c => c.Labels && c.Labels[CONTAINER_LABEL] === 'true')
            .map(async c => {
                const id = c.Id.substring(0, 12);
                const owner = c.Labels['com.minecraft.owner'];

                // Admins see everything
                let hasAccess = currentUser.role === 'admin' || owner === currentUser.userId;

                // Fetch extra metadata from file
                let logoUrl = c.Labels['com.minecraft.logo_url'] || '';
                let displayName = c.Names[0].replace('/', '');
                let sharedWith: string[] = [];

                try {
                    // Note: We bypass the ownership check in getServerFileContent here because we ARE the server-side logic determining access
                    // We'll use a raw helper or just the logic to avoid circularity if needed
                    // But for now, we'll try to use it if it doesn't cause issues
                    const container = docker.getContainer(id);
                    const exec = await container.exec({
                        Cmd: ['cat', '/data/.dashboard_meta.json'],
                        AttachStdout: true,
                        AttachStderr: true,
                        Tty: false
                    });
                    const stream = await exec.start({});
                    const metaContent: string = await new Promise((resolve) => {
                        let out = '';
                        stream.on('data', chunk => {
                            let offset = 0;
                            while (offset < chunk.length) {
                                if (chunk.length < offset + 8) break;
                                const type = chunk.readUInt8(offset);
                                const size = chunk.readUInt32BE(offset + 4);
                                offset += 8;
                                if (type === 1) out += chunk.slice(offset, offset + size).toString();
                                offset += size;
                            }
                        });
                        stream.on('end', () => resolve(out));
                        stream.on('error', () => resolve(''));
                        setTimeout(() => resolve(''), 1000);
                    });

                    if (metaContent) {
                        const meta = JSON.parse(metaContent);
                        if (meta.logoUrl) logoUrl = meta.logoUrl;
                        if (meta.name) displayName = meta.name;
                        if (Array.isArray(meta.sharedWith)) {
                            sharedWith = meta.sharedWith;
                            if (sharedWith.includes(currentUser.userId)) {
                                hasAccess = true;
                            }
                        }
                    }
                } catch (e) { }

                if (!hasAccess) return null;

                const server: MinecraftServer = {
                    id,
                    name: displayName,
                    image: c.Image,
                    state: c.State as MinecraftServer['state'],
                    status: c.Status,
                    port: parseInt(c.Labels['com.minecraft.port'] || '25565'),
                    memory: c.Labels['com.minecraft.max_memory'] || c.Labels['com.minecraft.memory'] || '2G',
                    minMemory: c.Labels['com.minecraft.min_memory'] || c.Labels['com.minecraft.memory'] || '2G',
                    maxMemory: c.Labels['com.minecraft.max_memory'] || c.Labels['com.minecraft.memory'] || '2G',
                    version: c.Labels['com.minecraft.version'] || 'latest',
                    type: c.Labels['com.minecraft.type'] || 'vanilla',
                    logoUrl,
                    owner: owner,
                    sharedWith: sharedWith
                };

                return server;
            }));

        return results.filter((s): s is MinecraftServer => s !== null);
    } catch (error) {
        console.error('Failed to list containers (Is Docker running?):', error);
        return [];
    }
}


export async function updateServerResources(id: string, minRam: string, maxRam: string) {
    try {
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();
        if (!currentUser) return { success: false, error: 'Unauthorized' };

        const { checkServerDirectOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerDirectOwnership(id, currentUser);
        if (!hasAccess) return { success: false, error: 'Only the server owner can update resources' };

        const container = docker.getContainer(id);
        const info = await container.inspect();

        // Prepare new configuration
        const oldEnv = info.Config.Env || [];
        // Filter out old memory variables
        const newEnv = oldEnv.filter(e => !e.startsWith('MEMORY=') && !e.startsWith('INIT_MEMORY=') && !e.startsWith('MAX_MEMORY='));

        // Add new memory variables
        newEnv.push(`INIT_MEMORY=${minRam}`);
        newEnv.push(`MAX_MEMORY=${maxRam}`);

        // Update labels
        const labels = { ...info.Config.Labels };
        labels['com.minecraft.min_memory'] = minRam;
        labels['com.minecraft.max_memory'] = maxRam;
        // Keep old memory label for compatibility or update it to max
        labels['com.minecraft.memory'] = maxRam;

        const config = {
            ...info.Config,
            Env: newEnv,
            Labels: labels,
            HostConfig: info.HostConfig,
            name: info.Name // Name comes from createContainer options, not Config
        };

        // We need to stop and remove, then recreate
        // Warning: This changes the container ID.
        // But we want to preserve port bindings etc.
        // info.HostConfig has PortBindings.

        const name = info.Name.replace('/', '');

        await container.stop().catch(() => { });
        await container.remove();

        await docker.createContainer({
            ...config,
            name: name, // Important to keep same name
            HostConfig: info.HostConfig,
            NetworkingConfig: info.NetworkSettings ? { EndpointsConfig: info.NetworkSettings.Networks } : undefined
        });

        // We probably want to start it if it was running? 
        // Or just leave it stopped. User can start it.
        // But usually update implies restart.
        // Let's start it.
        const newContainer = docker.getContainer(name);
        await newContainer.start();

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to update resources:', error);
        return { success: false, error: error.message };
    }
}

export async function createServer(formData: FormData) {
    const name = formData.get('name') as string;
    const version = formData.get('version') as string;
    const type = formData.get('type') as string;
    const memory = formData.get('memory') as string;
    const port = formData.get('port') as string || '25565';
    const icon = formData.get('icon') as string || '🌳';

    if (!name || !version || !type) {
        return { success: false, error: 'Missing required fields' };
    }

    try {
        // Get current user to set as owner
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        // Initial pull might take time, ensuring image exists is good practice
        // but docker.createContainer usually fails if image not present unless pulled.
        // We let Docker handle pulling implicitly or user can pre-pull.
        // However, dockerode createContainer doesn't auto-pull.
        // We need to pull explicitly or ensure image exists.
        // For simplicity, we assume `itzg/minecraft-server` is available or try to pull.

        await new Promise((resolve, reject) => {
            docker.pull('itzg/minecraft-server', (err: any, stream: any) => {
                if (err) return resolve(null); // Continue even if pull 'fails' (maybe exists)
                // Need to follow stream to wait for finish
                docker.modem.followProgress(stream, onFinished, onProgress);
                function onFinished(err: any, output: any) {
                    if (err) reject(err);
                    else resolve(output);
                }
                function onProgress(event: any) { }
            });
        });

        await docker.createContainer({
            Image: 'itzg/minecraft-server',
            name: name,
            Env: [
                'EULA=TRUE',
                `TYPE=${type.toUpperCase()}`,
                `VERSION=${version}`,
                `MEMORY=${memory}`,
                'ONLINE_MODE=FALSE'
            ],
            HostConfig: {
                PortBindings: {
                    '25565/tcp': [{ HostPort: port }]
                },
                Binds: [
                    `${name}_data:/data`
                ],
                RestartPolicy: {
                    Name: 'unless-stopped'
                }
            },
            Labels: {
                [CONTAINER_LABEL]: 'true',
                'com.minecraft.type': type,
                'com.minecraft.version': version,
                'com.minecraft.memory': memory,
                'com.minecraft.port': port,
                'com.minecraft.logo_url': icon,
                'com.minecraft.owner': currentUser.userId, // Add owner
                'com.minecraft.owner_username': currentUser.username // Optional: for easier debugging
            },
            Tty: true,
            OpenStdin: true
        });

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to create server:', error);
        return { success: false, error: error.message };
    }
}

export async function startServer(id: string) {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return { success: false, error: 'You do not have permission to start this server' };
        }

        const container = docker.getContainer(id);
        await container.start();
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to start server:', error);
        return { success: false, error: error.message };
    }
}

export async function stopServer(id: string) {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return { success: false, error: 'You do not have permission to stop this server' };
        }

        const container = docker.getContainer(id);
        await container.stop();
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to stop server:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteServer(id: string) {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        const { checkServerDirectOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerDirectOwnership(id, currentUser);

        if (!hasAccess) {
            return { success: false, error: 'Only the server owner can delete this server' };
        }

        const container = docker.getContainer(id);
        try {
            await container.stop();
        } catch { }
        await container.remove({ v: true });
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to delete server:', error);
        return { success: false, error: error.message };
    }
}

export async function getServerStatus(id: string): Promise<MinecraftServer | null> {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return null;
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return null;
        }

        const container = docker.getContainer(id);
        const data = await container.inspect();
        const labels = data.Config.Labels || {};
        const portInfo = data.NetworkSettings.Ports['25565/tcp']?.[0];

        let logoUrl = labels['com.minecraft.logo_url'] || '';
        let displayName = data.Name.replace('/', '');

        try {
            const metaContent = await getServerFileContent(id, '/data/.dashboard_meta.json');
            if (!metaContent.startsWith('Error')) {
                const meta = JSON.parse(metaContent);
                if (meta.logoUrl) logoUrl = meta.logoUrl;
                if (meta.name) displayName = meta.name;
            }
        } catch (e) { }

        return {
            id: data.Id.substring(0, 12),
            name: displayName,
            image: data.Config.Image,
            state: data.State.Status as MinecraftServer['state'],
            status: data.State.Status,
            port: portInfo ? parseInt(portInfo.HostPort) : 0,
            memory: labels['com.minecraft.memory'] || '2G',
            version: labels['com.minecraft.version'] || 'latest',
            type: labels['com.minecraft.type'] || 'vanilla',
            startedAt: data.State.StartedAt,
            logoUrl,
            owner: labels['com.minecraft.owner']
        };
    } catch (error) {
        console.error('Failed to get server status:', error);
        return null;
    }
}

export async function getServerLogs(id: string, since?: number): Promise<string> {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return 'Unauthorized';
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return 'You do not have permission to view logs for this server';
        }

        const container = docker.getContainer(id);
        const options: any = {
            stdout: true,
            stderr: true,
            timestamps: false
        };

        if (since) {
            options.since = since;
        } else {
            options.tail = 100;
        }

        const logs: any = await container.logs(options);
        return logs ? logs.toString('utf-8') : '';
    } catch (error) {
        console.error('Failed to fetch logs:', error);
        return 'Failed to fetch logs.';
    }
}
export async function restartServer(id: string) {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return { success: false, error: 'You do not have permission to restart this server' };
        }

        const container = docker.getContainer(id);
        await container.restart();
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to restart server:', error);
        return { success: false, error: error.message };
    }
}

export async function updateServerConfig(id: string, updates: Record<string, string>) {
    const path = '/data/server.properties';
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return { success: false, error: 'You do not have permission to configure this server' };
        }

        const content = await getServerFileContent(id, path);
        if (content.startsWith('Error:')) {
            return { success: false, error: 'Could not find server.properties. Is the server initialized?' };
        }

        const lines = content.split('\n');
        const updatedLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;

            const [key] = trimmed.split('=');
            if (updates[key.trim()] !== undefined) {
                return `${key.trim()}=${updates[key.trim()]}`;
            }
            return line;
        });

        // Add keys that didn't exist
        const existingKeys = lines
            .filter(l => l.trim() && !l.trim().startsWith('#'))
            .map(l => l.trim().split('=')[0].trim());

        Object.entries(updates).forEach(([key, value]) => {
            if (!existingKeys.includes(key)) {
                updatedLines.push(`${key}=${value}`);
            }
        });

        const newContent = updatedLines.join('\n');
        return await saveServerFileContent(id, path, newContent);
    } catch (error: any) {
        console.error('Failed to update config:', error);
        return { success: false, error: error.message };
    }
}

export interface FileInfo {
    name: string;
    isDirectory: boolean;
    path: string;
}

export async function getServerFiles(id: string, path: string = '/data'): Promise<FileInfo[]> {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return [];
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return [];
        }

        const cleanPath = validateAndSanitizePath(path);
        const container = docker.getContainer(id);
        const exec = await container.exec({
            Cmd: ['ls', '-ap', cleanPath],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });

        const stream = await exec.start({});

        return new Promise((resolve) => {
            let output = '';
            let errorOutput = '';

            stream.on('data', (chunk: Buffer) => {
                let offset = 0;
                while (offset < chunk.length) {
                    if (chunk.length < offset + 8) break;
                    const type = chunk.readUInt8(offset);
                    const size = chunk.readUInt32BE(offset + 4);
                    offset += 8;
                    const payload = chunk.slice(offset, Math.min(offset + size, chunk.length)).toString('utf-8');
                    if (type === 1) output += payload;
                    else if (type === 2) errorOutput += payload;
                    offset += size;
                }
            });

            stream.on('end', () => {
                if (errorOutput && !output) {
                    console.error('LS Error:', errorOutput);
                    // If we have an error (like invalid argument), return special file to show error in UI
                    resolve([{
                        name: `Error: ${errorOutput.split(':')[0]}`,
                        isDirectory: false,
                        path: path
                    }]);
                    return;
                }

                const files = output.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && line !== './' && line !== '../' && !line.startsWith('total'))
                    .map(name => ({
                        name: name.replace(/\/$/, ''),
                        isDirectory: name.endsWith('/'),
                        path: `${path}/${name.replace(/\/$/, '')}`.replace(/\/+/g, '/')
                    }))
                    .sort((a, b) => {
                        if (a.isDirectory && !b.isDirectory) return -1;
                        if (!a.isDirectory && b.isDirectory) return 1;
                        return a.name.localeCompare(b.name);
                    });
                resolve(files);
            });
            stream.on('error', (err) => {
                console.error('Stream error:', err);
                resolve([]);
            });
        });
    } catch (error) {
        console.error('Failed to list files:', error);
        return [];
    }
}

export async function getServerFileContent(id: string, path: string): Promise<string> {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return 'Error: Unauthorized';
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return 'Error: You do not have permission to access this server';
        }

        const cleanPath = validateAndSanitizePath(path);
        const container = docker.getContainer(id);
        // Using base64 for reading ensures UTF-8 and special characters are preserved
        const exec = await container.exec({
            Cmd: ['base64', cleanPath],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });

        const stream = await exec.start({});

        return new Promise((resolve, reject) => {
            let encodedOutput = '';
            // Docker multiplexes stdout/stderr into a single stream with an 8-byte header
            // if Tty is false. We need to skip these headers.
            stream.on('data', (chunk: Buffer) => {
                // Simplified demux: The first byte defines the stream (1=stdout, 2=stderr).
                // The next 3 are null, and the last 4 are the payload size (BigEndian).
                // We'll just collect and skip headers.
                let offset = 0;
                while (offset < chunk.length) {
                    const type = chunk.readUInt8(offset);
                    const size = chunk.readUInt32BE(offset + 4);
                    offset += 8;
                    if (type === 1) { // stdout
                        encodedOutput += chunk.slice(offset, offset + size).toString();
                    }
                    offset += size;
                }
            });

            stream.on('end', () => {
                try {
                    // Remove any whitespace/newlines added by the base64 command
                    const cleanBase64 = encodedOutput.replace(/\s/g, '');
                    const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
                    resolve(decoded);
                } catch (e) {
                    console.error('Failed to decode base64 file content:', e);
                    resolve('Error: Could not decode file content.');
                }
            });
            stream.on('error', reject);
        });
    } catch (error) {
        console.error('Failed to read file:', error);
        return 'Error: Could not read file.';
    }
}
export async function saveServerFileContent(id: string, path: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return { success: false, error: 'You do not have permission to modify this server' };
        }

        // Convert to base64 to leverage the safe binary save function which uses streams
        const base64Content = Buffer.from(content, 'utf8').toString('base64');
        return await saveBinaryFile(id, path, base64Content);
    } catch (error: any) {
        console.error('Failed to save file:', error);
        return { success: false, error: error.message };
    }
}

export async function sendServerCommand(id: string, command: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        // Check ownership
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        const { checkServerOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerOwnership(id, currentUser);

        if (!hasAccess) {
            return { success: false, error: 'You do not have permission to send commands to this server' };
        }

        const container = docker.getContainer(id);

        const exec = await container.exec({
            Cmd: ['rcon-cli', command],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });

        const stream = await exec.start({});

        return new Promise((resolve) => {
            let output = '';
            let errorOutput = '';

            // Docker multiplexes stdout/stderr into a single stream with an 8-byte header
            stream.on('data', (chunk: Buffer) => {
                let offset = 0;
                while (offset < chunk.length) {
                    if (chunk.length < offset + 8) break;
                    const type = chunk.readUInt8(offset);
                    const size = chunk.readUInt32BE(offset + 4);
                    offset += 8;

                    const payload = chunk.slice(offset, Math.min(offset + size, chunk.length)).toString('utf-8');
                    if (type === 1) output += payload;
                    else if (type === 2) errorOutput += payload;

                    offset += size;
                }
            });

            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Command timed out' });
            }, 5000);

            stream.on('end', () => {
                clearTimeout(timeout);

                // Strip ANSI escape codes (common in Forge or colorful servers)
                const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

                const cleanOutput = stripAnsi(output).trim();
                const cleanError = stripAnsi(errorOutput).trim();

                // Remove non-printable characters and control chars (like the [0m sometimes left)
                const finalMsg = cleanOutput.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();

                if (finalMsg.toLowerCase().includes('failed') || finalMsg.toLowerCase().includes('error')) {
                    resolve({ success: false, error: finalMsg || cleanError });
                } else {
                    resolve({ success: true, message: finalMsg || cleanError });
                }
            });

            stream.on('error', (err) => {
                clearTimeout(timeout);
                resolve({ success: false, error: err.message });
            });
        });
    } catch (error: any) {
        console.error('Failed to send command:', error);
        return { success: false, error: error.message };
    }
}

export async function getOnlinePlayers(id: string): Promise<string[]> {
    try {
        const res = await sendServerCommand(id, 'list');
        if (res.success && res.message) {
            // Flatten multiline and handle different formats
            const msg = res.message.replace(/\r?\n|\r/g, " ");
            const parts = msg.split(':');
            if (parts.length > 1) {
                const listStr = parts[parts.length - 1]; // Names are always after the last colon
                return listStr.split(',').map((p: string) => p.trim()).filter((p: string) => p && !p.includes('online') && !p.includes('max'));
            }
        }
        return [];
    } catch (error) {
        console.error('Failed to get online players:', error);
        return [];
    }
}

export async function getPlayerManagementData(id: string) {
    try {
        const opsContent = await getServerFileContent(id, '/data/ops.json');
        const bannedContent = await getServerFileContent(id, '/data/banned-players.json');

        let ops = [];
        let banned = [];

        try {
            // Only try to parse if it looks like JSON array
            if (opsContent.trim().startsWith('[')) {
                ops = JSON.parse(opsContent);
            }
        } catch (e) {
            console.error('Ops parsing error:', e, 'Content:', opsContent);
        }

        try {
            if (bannedContent.trim().startsWith('[')) {
                banned = JSON.parse(bannedContent);
            }
        } catch (e) {
            console.error('Banned parsing error:', e, 'Content:', bannedContent);
        }

        return { ops, banned };
    } catch (error) {
        console.error('Failed to get player management data:', error);
        return { ops: [], banned: [] };
    }
}

export async function getPlayerStats(id: string, playerName: string) {
    try {
        const [posRes, dimRes, healthRes, foodRes, xpRes, modeRes, itemRes] = await Promise.all([
            sendServerCommand(id, `data get entity ${playerName} Pos`),
            sendServerCommand(id, `data get entity ${playerName} Dimension`),
            sendServerCommand(id, `data get entity ${playerName} Health`),
            sendServerCommand(id, `data get entity ${playerName} foodLevel`),
            sendServerCommand(id, `data get entity ${playerName} XpLevel`),
            sendServerCommand(id, `data get entity ${playerName} playerGameType`),
            sendServerCommand(id, `data get entity ${playerName} SelectedItem`)
        ]);

        let pos = 'Unknown';
        if (posRes.success && posRes.message) {
            const match = posRes.message.match(/\[(.+?)\]/);
            if (match) {
                const coordsArr = match[1].split(',').map(c => {
                    const val = parseFloat(c.trim().replace(/[fdsb]$/i, ''));
                    return isNaN(val) ? 0 : Math.floor(val);
                });

                if (coordsArr.length >= 3) {
                    pos = `${coordsArr[0]}, ${coordsArr[1]}, ${coordsArr[2]}`;
                }
            }
        }

        let dim = 'Overworld';
        if (dimRes.success && dimRes.message) {
            if (dimRes.message.includes('the_nether')) dim = 'Nether';
            else if (dimRes.message.includes('the_end')) dim = 'End';
        }

        const parseVal = (res: any) => {
            if (!res.success || !res.message) return null;
            const msg = res.message.toString().trim();

            // Extract everything after the last colon
            const parts = msg.split(':');
            let val = parts[parts.length - 1].trim();

            // Clean up Minecraft NBT type suffixes (e.g., 20.0f, 0b, 1s)
            val = val.replace(/[fdsb]$/i, '');
            // Remove quotes
            val = val.replace(/"/g, '');

            return val;
        };

        const health = parseVal(healthRes) || '20';
        const food = parseVal(foodRes) || '20';
        const xp = parseVal(xpRes) || '0';

        let mode = 'Survival';
        const rawMode = parseVal(modeRes);
        if (rawMode === '1' || rawMode?.toLowerCase() === 'creative') mode = 'Creative';
        else if (rawMode === '2' || rawMode?.toLowerCase() === 'adventure') mode = 'Adventure';
        else if (rawMode === '3' || rawMode?.toLowerCase() === 'spectator') mode = 'Spectator';

        let item = 'Empty';
        if (itemRes.success && itemRes.message && itemRes.message.includes('id:')) {
            // Find the ID specifically since it's inside an object
            const match = itemRes.message.match(/id: "minecraft:(.+?)"/i);
            if (match) item = match[1].replace(/_/g, ' ');
        }

        return { success: true, pos, dim, health, food, xp, mode, item };
    } catch (error) {
        return { success: false };
    }
}

export async function getMinecraftVersions() {
    try {
        const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json', {
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        const data = await response.json();

        // We only return actual versions (release or snapshot) 
        // to keep the list clean, primarily focusing on releases.
        return data.versions
            .filter((v: any) => v.type === 'release')
            .map((v: any) => v.id)
            .slice(0, 50); // Get the last 50 releases
    } catch (error) {
        console.error('Failed to fetch versions:', error);
        return ['latest', '1.21.1', '1.20.4', '1.19.4', '1.18.2'];
    }
}

export async function getServerMetrics(id: string) {
    try {
        const container = docker.getContainer(id);
        const [stats, data] = await Promise.all([
            container.stats({ stream: false }),
            container.inspect()
        ]);

        // CPU Calculation
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const onlineCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
        const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100.0 : 0.0;

        // Memory usage
        const memUsage = stats.memory_stats.usage;
        const memLimit = stats.memory_stats.limit;

        // Uptime calculation
        const startedAt = new Date(data.State.StartedAt).getTime();
        const uptimeMs = data.State.Running && startedAt > 0 ? Date.now() - startedAt : 0;

        return {
            success: true,
            cpu: cpuPercent.toFixed(1),
            memory: {
                usage: (memUsage / 1024 / 1024 / 1024).toFixed(1), // GB
                limit: (memLimit / 1024 / 1024 / 1024).toFixed(1)   // GB
            },
            uptimeMs: uptimeMs
        };
    } catch (error: any) {
        console.error('Failed to get metrics:', error);
        return { success: false, error: error.message };
    }
}

export async function saveBinaryFile(id: string, path: string, base64Data: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[saveBinaryFile] Starting to save to ${path}...`);
    try {
        const cleanPath = validateAndSanitizePath(path);
        const container = docker.getContainer(id);

        // Security Fix: Use dd to write directly from stdin to file
        // avoiding shell injection risks entirely.
        const exec = await container.exec({
            Cmd: ['dd', `of=${cleanPath}`],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await exec.start({ hijack: true, stdin: true });

        return new Promise((resolve) => {
            stream.write(Buffer.from(base64Data, 'base64'));
            stream.end();

            let output = '';
            stream.on('data', (chunk) => output += chunk.toString());

            stream.on('end', () => {
                console.log(`[saveBinaryFile] Finished saving to ${cleanPath}`);
                resolve({ success: true });
            });

            stream.on('error', (e) => {
                console.error(`[saveBinaryFile] Stream error:`, e);
                resolve({ success: false, error: e.message });
            });

            // Safety timeout
            setTimeout(() => {
                resolve({ success: true });
            }, 5000);
        });
    } catch (error: any) {
        console.error('[saveBinaryFile] Critical failure:', error);
        return { success: false, error: error.message };
    }
}

export async function getAddons(id: string) {
    try {
        const container = docker.getContainer(id);
        const addons: any[] = [];
        const paths = ['plugins', 'mods'];

        for (const p of paths) {
            try {
                const exec = await container.exec({
                    Cmd: ['ls', '-l', `/data/${p}`],
                    AttachStdout: true,
                    AttachStderr: true,
                    Tty: false
                });

                const stream = await exec.start({});

                const output = await new Promise<string>((resolve) => {
                    let out = '';
                    stream.on('data', (chunk: Buffer) => {
                        let offset = 0;
                        while (offset < chunk.length) {
                            if (chunk.length < offset + 8) break;
                            const type = chunk.readUInt8(offset);
                            const size = chunk.readUInt32BE(offset + 4);
                            offset += 8;
                            if (type === 1) out += chunk.slice(offset, offset + size).toString('utf-8');
                            offset += size;
                        }
                    });
                    stream.on('end', () => resolve(out));
                });

                if (output && !output.includes('No such file') && !output.includes('cannot access')) {
                    const lines = output.split('\n');
                    lines.forEach(line => {
                        if (!line.startsWith('-')) return;

                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 8) {
                            const size = parts[4];
                            const name = parts.slice(8).join(' ');

                            if (name && (name.endsWith('.jar') || name.endsWith('.disabled'))) {
                                const isDis = name.endsWith('.disabled');
                                addons.push({
                                    id: name,
                                    name: name,
                                    cleanName: name.replace('.disabled', ''),
                                    size: size,
                                    type: p,
                                    enabled: !isDis
                                });
                            }
                        }
                    });
                }
            } catch (e) { }
        }
        return { success: true, addons };
    } catch (e: any) {
        return { success: false, addons: [], error: e.message };
    }
}

export async function toggleAddon(id: string, path: string, type: 'plugins' | 'mods', enabled: boolean) {
    try {
        const container = docker.getContainer(id);
        const oldPath = `/data/${type}/${path}`;
        const newPath = enabled
            ? `/data/${type}/${path.replace('.disabled', '')}`
            : `/data/${type}/${path}.disabled`;

        const exec = await container.exec({
            Cmd: ['mv', oldPath, newPath],
            AttachStdout: true,
            AttachStderr: true
        });
        await exec.start({});

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteAddon(id: string, path: string, type: 'plugins' | 'mods') {
    try {
        const container = docker.getContainer(id);
        const exec = await container.exec({
            Cmd: ['rm', `/data/${type}/${path}`],
            AttachStdout: true,
            AttachStderr: true
        });
        await exec.start({});
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function installAddon(id: string, url: string, filename: string, type: 'plugins' | 'mods') {
    try {
        console.log(`[installAddon] Downloading ${url}...`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch addon: ${res.statusText}`);

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        return await uploadAddon(id, base64, filename, type);
    } catch (e: any) {
        console.error('[installAddon] Error:', e);
        return { success: false, error: e.message };
    }
}

export async function uploadAddon(id: string, base64Data: string, filename: string, type: 'plugins' | 'mods') {
    // Ensure directory exists
    try {
        const container = docker.getContainer(id);
        await container.exec({ Cmd: ['mkdir', '-p', `/data/${type}`] }).then(e => e.start({}));
    } catch (ignored) { }

    return await saveBinaryFile(id, `/data/${type}/${filename}`, base64Data);
}


export async function getServerIcon(id: string): Promise<string | null> {
    try {
        const container = docker.getContainer(id);
        const exec = await container.exec({
            Cmd: ['base64', '/data/server-icon.png'],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });

        const stream = await exec.start({});
        return new Promise((resolve) => {
            let encoded = '';
            stream.on('data', (chunk: Buffer) => {
                let offset = 0;
                while (offset < chunk.length) {
                    const type = chunk.readUInt8(offset);
                    const size = chunk.readUInt32BE(offset + 4);
                    offset += 8;
                    if (type === 1) encoded += chunk.slice(offset, offset + size).toString();
                    offset += size;
                }
            });
            stream.on('end', () => {
                encoded = encoded.replace(/\s/g, '');
                if (!encoded || encoded.includes('Error') || encoded.includes('No such file')) {
                    resolve(null);
                } else {
                    resolve(`data:image/png;base64,${encoded}`);
                }
            });
            stream.on('error', () => resolve(null));
        });
    } catch {
        return null;
    }
}

export async function uploadServerIcon(id: string, base64Data: string) {
    // Remove data URL prefix if present
    const pureBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    return await saveBinaryFile(id, '/data/server-icon.png', pureBase64);
}

export async function getWorldInfo(id: string) {
    try {
        const configContent = await getServerFileContent(id, '/data/server.properties');
        let worldName = 'world';
        const match = configContent.match(/level-name=(.+)/);
        if (match) worldName = match[1].trim();

        const container = docker.getContainer(id);
        const exec = await container.exec({
            Cmd: ['sh', '-c', `du -sh "/data/${worldName}" | cut -f1`],
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await exec.start({});
        const size = await new Promise<string>((resolve) => {
            let output = '';
            stream.on('data', (chunk) => {
                // Remove Docker header if present (8 bytes)
                if (chunk.length > 8 && chunk[0] < 3) {
                    output += chunk.slice(8).toString();
                } else {
                    output += chunk.toString();
                }
            });
            stream.on('end', () => resolve(output.trim()));
        });

        return { success: true, name: worldName, size: size || '0B' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createWorldBackup(id: string) {
    try {
        const info = await getWorldInfo(id);
        if (!info.success) return info;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `${info.name}_${timestamp}.tar.gz`;

        const container = docker.getContainer(id);
        // Ensure backup dir exists
        await container.exec({ Cmd: ['mkdir', '-p', '/data/backups'] }).then(e => e.start({}));

        const exec = await container.exec({
            Cmd: ['sh', '-c', `tar -czf "/data/backups/${backupName}" -C /data "${info.name}"`],
            AttachStdout: true,
            AttachStderr: true
        });

        await exec.start({});
        return { success: true, message: `Backup created: backups/${backupName}` };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function resetWorld(id: string) {
    try {
        const info = await getWorldInfo(id);
        if (!info.success) return info;

        const container = docker.getContainer(id);

        // 1. Stop server
        await stopServer(id);

        // 2. Delete world folder
        const exec = await container.exec({
            Cmd: ['rm', '-rf', `/data/${info.name}`],
            AttachStdout: true,
            AttachStderr: true
        });
        await exec.start({});

        // 3. Start server (it will regenerate a new world)
        await startServer(id);

        return { success: true, message: 'World reset successfully. A new world is being generated.' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function listBackups(id: string) {
    try {
        const container = docker.getContainer(id);

        await container.exec({ Cmd: ['mkdir', '-p', '/data/backups'] }).then((e: any) => e.start({}));

        const exec = await container.exec({
            Cmd: ['sh', '-c', 'ls -lt /data/backups/*.tar.gz'],
            AttachStdout: true,
            AttachStderr: true
        });

        const stream: any = await exec.start({});
        let output = '';

        await new Promise((resolve, reject) => {
            container.modem.demuxStream(stream, {
                write: (chunk: Buffer) => { output += chunk.toString('utf8'); }
            }, {
                write: (chunk: Buffer) => { }
            });
            stream.on('end', resolve);
            stream.on('error', reject);
        });

        if (!output || output.includes('No such file')) {
            return { success: true, backups: [] };
        }

        const backups: any[] = [];
        const lines = output.trim().split('\n');

        for (const line of lines) {
            if (!line.includes('.tar.gz')) continue;

            const parts = line.split(/\s+/);
            if (parts.length < 8) continue;

            const path = parts[parts.length - 1];
            const name = path.split('/').pop();
            const size = parseInt(parts[4]);

            // Basic date parsing (Month Day Time)
            const dateStr = `${parts[5]} ${parts[6]} ${parts[7]}`;

            backups.push({ name, size, date: dateStr });
        }

        return { success: true, backups };
    } catch (error: any) {
        console.error('List backups error:', error);
        return { success: true, backups: [] };
    }
}

export async function deleteBackup(id: string, filename: string) {
    try {
        if (!filename) return { success: false, error: 'Invalid filename' };

        // Use the validator properly, constructing the full path to check it
        const fullPath = `/data/backups/${filename}`;
        validateAndSanitizePath(fullPath);

        const container = docker.getContainer(id);
        const exec = await container.exec({
            Cmd: ['rm', fullPath],
            AttachStdout: true,
            AttachStderr: true
        });
        await exec.start({});
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateDashboardMetadata(id: string, updates: { name?: string, logoUrl?: string }) {
    try {
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();
        if (!currentUser) return { success: false, error: 'Unauthorized' };

        const { checkServerDirectOwnership } = await import('@/lib/serverOwnership');
        const hasAccess = await checkServerDirectOwnership(id, currentUser);
        if (!hasAccess) return { success: false, error: 'Only the server owner can update dashboard settings' };

        const container = docker.getContainer(id);
        const data = await container.inspect();
        const existingLabels = data.Config.Labels || {};

        const newLabels = { ...existingLabels };
        if (updates.name) newLabels['com.minecraft.name'] = updates.name; // We should probably use a label for the name too if we want to rename the display name without renaming the container
        if (updates.logoUrl) newLabels['com.minecraft.logo_url'] = updates.logoUrl;

        // Note: Docker doesn't support updating labels on a running container without recreating it.
        // For simplicity, we'll just update the labels in our memory/DB if we had one, 
        // but here we are using Docker labels as DB. 
        // To really update them, we'd need to recreate the container.

        // Alternative: Just update the label if possible? No.
        // Let's use a simpler approach: we'll use 'com.minecraft.logo_url' and 'com.minecraft.display_name'

        // If we want it to be "instant" without recreation, we'd need a real database.
        // But since we use Docker as truth, let's just say for now we update it.
        // To make it work, I'll update getServers to prioritize 'com.minecraft.display_name' if it exists.

        // Actually, let's just do the recreation or just accept it's a limitation of "no-db" architecture.
        // OR: We store it in a small JSON file in the container's volume! That's "Plug & Play".

        const metadataPath = '/data/.dashboard_meta.json';
        const currentMeta = await getServerFileContent(id, metadataPath);
        let meta = {};
        try {
            if (!currentMeta.startsWith('Error')) {
                meta = JSON.parse(currentMeta);
            }
        } catch (e) { }

        const newMeta = { ...meta, ...updates };
        await saveServerFileContent(id, metadataPath, JSON.stringify(newMeta));

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getGameRules(id: string) {
    const rulesToFetch = [
        'keepInventory',
        'doDaylightCycle',
        'doWeatherCycle',
        'mobGriefing',
        'doMobSpawning',
        'doFireTick',
        'showDeathMessages',
        'doImmediateRespawn',
        'fallDamage',
        'fireDamage',
        'drowningDamage'
    ];

    try {
        const results = await Promise.all(
            rulesToFetch.map(async (rule) => {
                const res = await sendServerCommand(id, `gamerule ${rule}`);
                if (res.success && res.message) {
                    // Message format: "gamerule <name> is currently: <value>"
                    const parts = res.message.split('is currently:');
                    if (parts.length > 1) {
                        return { name: rule, value: parts[1].trim() };
                    }
                }
                return { name: rule, value: 'unknown' };
            })
        );
        return { success: true, rules: results };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateGameRule(id: string, rule: string, value: string) {
    try {
        const res = await sendServerCommand(id, `gamerule ${rule} ${value}`);
        return res;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function shareServerWithUser(serverId: string, username: string) {
    try {
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();
        if (!currentUser) return { success: false, error: 'Unauthorized' };

        // Check if user is the DIRECT owner (only owners can share)
        const container = docker.getContainer(serverId);
        const info = await container.inspect();
        const owner = info.Config.Labels?.['com.minecraft.owner'];

        if (currentUser.role !== 'admin' && owner !== currentUser.userId) {
            return { success: false, error: 'Only the server owner can share it' };
        }

        const { getUserByUsername } = await import('@/lib/users');
        const targetUser = await getUserByUsername(username);

        if (!targetUser) {
            return { success: false, error: 'User not found' };
        }

        if (targetUser.id === owner) {
            return { success: false, error: 'You are already the owner' };
        }

        // Get current metadata
        const metaPath = '/data/.dashboard_meta.json';
        const metaContent = await getServerFileContent(serverId, metaPath);
        let meta = { sharedWith: [] as string[] };
        if (!metaContent.startsWith('Error')) {
            meta = JSON.parse(metaContent);
        }

        if (!meta.sharedWith) meta.sharedWith = [];
        if (meta.sharedWith.includes(targetUser.id)) {
            return { success: false, error: 'Server already shared with this user' };
        }

        meta.sharedWith.push(targetUser.id);
        await saveServerFileContent(serverId, metaPath, JSON.stringify(meta, null, 2));

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function unshareServerWithUser(serverId: string, targetUserId: string) {
    try {
        const { getCurrentUser } = await import('@/actions/auth');
        const currentUser = await getCurrentUser();
        if (!currentUser) return { success: false, error: 'Unauthorized' };

        // Check permissions
        const container = docker.getContainer(serverId);
        const info = await container.inspect();
        const owner = info.Config.Labels?.['com.minecraft.owner'];

        if (currentUser.role !== 'admin' && owner !== currentUser.userId) {
            return { success: false, error: 'Only the server owner can unshare it' };
        }

        const metaPath = '/data/.dashboard_meta.json';
        const metaContent = await getServerFileContent(serverId, metaPath);
        if (metaContent.startsWith('Error')) return { success: false, error: 'Metadata not found' };

        const meta = JSON.parse(metaContent);
        if (!meta.sharedWith) return { success: true };

        meta.sharedWith = meta.sharedWith.filter((id: string) => id !== targetUserId);
        await saveServerFileContent(serverId, metaPath, JSON.stringify(meta, null, 2));

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSharedUsers(serverId: string) {
    try {
        const metaPath = '/data/.dashboard_meta.json';
        const metaContent = await getServerFileContent(serverId, metaPath);
        if (metaContent.startsWith('Error')) return [];

        const meta = JSON.parse(metaContent);
        if (!meta.sharedWith || !Array.isArray(meta.sharedWith)) return [];

        const { getUserById } = await import('@/lib/users');
        const sortedUsers = await Promise.all(
            meta.sharedWith.map(async (id: string) => {
                const user = await getUserById(id);
                return user ? { id: user.id, username: user.username } : null;
            })
        );

        return sortedUsers.filter(u => u !== null);
    } catch (error) {
        console.error('Failed to get shared users:', error);
        return [];
    }
}

