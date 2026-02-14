export interface User {
    id: string;
    username: string;
    password: string; // Hashed
    createdAt: string;
    role: 'admin' | 'user';
}

export interface InvitationCode {
    code: string;
    createdBy: string;
    createdAt: string;
    maxUses: number;
    uses: number;
    usedBy?: string[];
    usedAt?: string[];
    expiresAt?: string;
    isActive: boolean;
}

export interface UsersDatabase {
    users: User[];
    invitationCodes: InvitationCode[];
}
