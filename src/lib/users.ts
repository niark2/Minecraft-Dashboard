import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { UsersDatabase, User, InvitationCode } from '@/types/user';

const DB_PATH = path.join(process.cwd(), 'data', 'users.json');

// Fonction pour hasher les mots de passe
export function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Initialiser la base de données si elle n'existe pas
async function initDatabase(): Promise<UsersDatabase> {
    try {
        await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

        // Créer l'admin par défaut depuis les variables d'environnement
        const defaultAdmin: User = {
            id: crypto.randomUUID(),
            username: process.env.DASHBOARD_USERNAME || 'admin',
            password: hashPassword(process.env.DASHBOARD_PASSWORD || 'changeme'),
            createdAt: new Date().toISOString(),
            role: 'admin'
        };

        const initialDb: UsersDatabase = {
            users: [defaultAdmin],
            invitationCodes: []
        };

        await fs.writeFile(DB_PATH, JSON.stringify(initialDb, null, 2));
        return initialDb;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
}

// Lire la base de données
export async function readDatabase(): Promise<UsersDatabase> {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        const db: UsersDatabase = JSON.parse(data);

        // Simple migration for invitation codes
        let modified = false;
        db.invitationCodes = db.invitationCodes.map(code => {
            const updated = { ...code };
            const raw = code as unknown as Record<string, unknown>;

            if (updated.maxUses === undefined) {
                updated.maxUses = 1;
                modified = true;
            }
            if (updated.uses === undefined) {
                updated.uses = raw.usedBy && typeof raw.usedBy === 'string' ? 1 : 0;
                modified = true;
            }
            if (!Array.isArray(updated.usedBy)) {
                const oldUsedBy = raw.usedBy as string | undefined;
                updated.usedBy = oldUsedBy ? [oldUsedBy] : [];
                modified = true;
            }
            if (!Array.isArray(updated.usedAt)) {
                const oldUsedAt = raw.usedAt as string | undefined;
                updated.usedAt = oldUsedAt ? [oldUsedAt] : [];
                modified = true;
            }
            return updated;
        });

        if (modified) {
            await writeDatabase(db);
        }

        return db;
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return await initDatabase();
        }
        throw error;
    }
}

// Écrire dans la base de données
export async function writeDatabase(db: UsersDatabase): Promise<void> {
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

// Vérifier les credentials d'un utilisateur
export async function verifyUser(username: string, password: string): Promise<User | null> {
    const db = await readDatabase();
    const hashedPassword = hashPassword(password);
    const user = db.users.find(u => u.username === username && u.password === hashedPassword);
    return user || null;
}

// Créer un nouveau code d'invitation
export async function createInvitationCode(createdBy: string, expiresInDays?: number, maxUses: number = 1): Promise<InvitationCode> {
    const db = await readDatabase();

    const code: InvitationCode = {
        code: crypto.randomBytes(16).toString('hex'),
        createdBy,
        createdAt: new Date().toISOString(),
        maxUses,
        uses: 0,
        usedBy: [],
        usedAt: [],
        expiresAt: expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
            : undefined,
        isActive: true
    };

    db.invitationCodes.push(code);
    await writeDatabase(db);

    return code;
}

// Valider un code d'invitation
export async function validateInvitationCode(code: string): Promise<boolean> {
    const db = await readDatabase();
    const invitation = db.invitationCodes.find(c => c.code === code);

    if (!invitation || !invitation.isActive) {
        return false;
    }

    if (invitation.uses >= invitation.maxUses) {
        return false;
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return false;
    }

    return true;
}

// Utiliser un code d'invitation
export async function consumeInvitationCode(code: string, username: string): Promise<boolean> {
    const db = await readDatabase();
    const invitation = db.invitationCodes.find(c => c.code === code);

    if (!invitation) return false;

    invitation.uses++;
    if (!invitation.usedBy) invitation.usedBy = [];
    if (!invitation.usedAt) invitation.usedAt = [];

    invitation.usedBy.push(username);
    invitation.usedAt.push(new Date().toISOString());

    if (invitation.uses >= invitation.maxUses) {
        invitation.isActive = false;
    }

    await writeDatabase(db);
    return true;
}

// Créer un nouvel utilisateur
export async function createUser(username: string, password: string, invitationCode: string): Promise<{ success: boolean; error?: string }> {
    const db = await readDatabase();

    // Vérifier si l'utilisateur existe déjà
    if (db.users.some(u => u.username === username)) {
        return { success: false, error: 'Username already exists' };
    }

    // Valider le code d'invitation
    const isValid = await validateInvitationCode(invitationCode);
    if (!isValid) {
        return { success: false, error: 'Invalid or expired invitation code' };
    }

    // Créer l'utilisateur
    const newUser: User = {
        id: crypto.randomUUID(),
        username,
        password: hashPassword(password),
        createdAt: new Date().toISOString(),
        role: 'user'
    };

    db.users.push(newUser);
    await consumeInvitationCode(invitationCode, username);
    await writeDatabase(db);

    return { success: true };
}

// Récupérer tous les codes d'invitation
export async function getInvitationCodes(): Promise<InvitationCode[]> {
    const db = await readDatabase();
    return db.invitationCodes;
}

// Révoquer un code d'invitation
export async function revokeInvitationCode(code: string): Promise<boolean> {
    const db = await readDatabase();
    const invitation = db.invitationCodes.find(c => c.code === code);

    if (!invitation) return false;

    invitation.isActive = false;
    await writeDatabase(db);

    return true;
}

// Récupérer tous les utilisateurs
export async function getUsers(): Promise<Omit<User, 'password'>[]> {
    const db = await readDatabase();
    return db.users.map(({ password, ...user }) => user);
}

// Supprimer un utilisateur
export async function deleteUser(userId: string): Promise<boolean> {
    const db = await readDatabase();
    const userIndex = db.users.findIndex(u => u.id === userId);

    if (userIndex === -1) return false;

    // Ne pas permettre la suppression du dernier admin
    const user = db.users[userIndex];
    if (user.role === 'admin') {
        const adminCount = db.users.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
            return false; // Cannot delete the last admin
        }
    }

    db.users.splice(userIndex, 1);
    await writeDatabase(db);

    return true;
}
// Mettre à jour le rôle d'un utilisateur
export async function setRole(userId: string, role: 'admin' | 'user'): Promise<boolean> {
    const db = await readDatabase();
    const user = db.users.find(u => u.id === userId);

    if (!user) return false;

    // Ne pas permettre de s'auto-rétrograder s'il n'y a pas d'autre admin (pourrait être géré côté action)
    user.role = role;
    await writeDatabase(db);
    return true;
}

// Récupérer un utilisateur par son nom d'utilisateur
export async function getUserByUsername(username: string): Promise<Omit<User, 'password'> | null> {
    const db = await readDatabase();
    const user = db.users.find(u => u.username === username);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

// Récupérer un utilisateur par son ID
export async function getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const db = await readDatabase();
    const user = db.users.find(u => u.id === userId);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

