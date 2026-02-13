# 🎮 Minecraft Dashboard

A modern, high-performance, and secure web interface for managing your Minecraft servers with ease.

![Minecraft Dashboard Banner](public/next.svg) <!-- Placeholder for a better banner if generated later -->

## 🚀 Overview

**Minecraft Dashboard** is a professional-grade control panel built with Next.js 15+, designed to give server administrators full control over their Dockerized Minecraft instances. It combines a sleek, premium UI with robust backend management capabilities.

## ✨ Key Features

- **📂 File Management**: Full-featured File Explorer and Code Editor (Monaco-powered) for instant configuration tweaks.
- **🖥️ Live Console**: Real-time terminal access to your Minecraft server for commands and log monitoring.
- **🗺️ Map Manager**: Effortlessly manage and visualize your server worlds.
- **👥 Player Control**: Real-time player monitoring and management actions.
- **📦 Addon Support**: Integrated system for managing plugins, mods, and data packs.
- **⚙️ Setup Manager**: Centralized server configuration, identity settings (name/icon), and advanced management.
- **🔒 Secure Architecture**: Follows best practices to prevent Command Injection and Path Traversal (verified via security audit).
- **🐳 Docker Integrated**: Native support for managing servers as Docker containers using `dockerode`.

## 🛠️ Tech Stack

- **Frontend**: [Next.js 15+](https://nextjs.org/) (App Router), [React 19](https://react.dev/)
- **Styling**: [Sass (SCSS Modules)](https://sass-lang.com/), [Lucide React Icons](https://lucide.dev/)
- **Backend Management**: [Dockerode](https://github.com/apocas/dockerode)
- **Security**: Strict path sanitization and command streaming.

## 📦 Getting Started

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/minecraft-dashboard.git
   cd minecraft-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Environment Variables**:
   Create a `.env` file based on `.env.example`.

4. **Run the dev server**:
   ```bash
   npm run dev
   ```

### 🐳 Docker Deployment

The dashboard is designed to be easily deployable via Docker:

```bash
docker-compose up -d
```

Ensure your `docker-compose.yml` is correctly configured with your server mount paths.

## 🛡️ Security

This project has undergone a documented security audit and includes protections against:
- **Command Injection**: Using direct stream execution instead of shell interpolation.
- **Path Traversal**: Strict validation and sanitization of file access paths.

*Note: For production deployments, ensure the dashboard is behind a reverse proxy (like Nginx) with SSL and appropriate access controls.*

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
