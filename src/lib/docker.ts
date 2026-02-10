import Docker from 'dockerode';

// Initialize Docker client
// Default setup works for Windows (npipe) and Linux (socket)
// If environment variable is set, it overrides the default
const docker = new Docker(
    process.env.DOCKER_SOCKET_PATH
        ? { socketPath: process.env.DOCKER_SOCKET_PATH }
        : undefined
);

export default docker;
