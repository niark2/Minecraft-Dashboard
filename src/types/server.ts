export interface MinecraftServer {
  id: string;
  name: string;
  image: string;
  state: 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'dead';
  status: string;
  port: number;
  memory: string;
  version: string;
  type: string;
  startedAt?: string;
  logoUrl?: string;
  minMemory?: string;
  maxMemory?: string;
  owner?: string; // User ID of the server owner
}
