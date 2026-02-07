import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Session data structure
 */
export interface WalletSession {
    address: string;
    token: string;
    nonce: string;
    expiresAt: Date;
    createdAt: Date;
}

/**
 * Nonce storage (temporary, for signature verification)
 */
interface NonceStore {
    [address: string]: {
        nonce: string;
        createdAt: Date;
    };
}

/**
 * WalletAuth - Signature-based wallet authentication
 * 
 * Implements SIWE-like authentication flow:
 * 1. Generate nonce for wallet address
 * 2. User signs message with nonce
 * 3. Verify signature
 * 4. Create session token
 */
export class WalletAuth {
    private dataDir: string;
    private sessionsFile: string;
    private sessions: Map<string, WalletSession>;
    private nonces: NonceStore;
    private readonly SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
    private readonly NONCE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

    constructor(dataDir: string = './data') {
        this.dataDir = dataDir;
        this.sessionsFile = path.join(dataDir, 'wallet-sessions.json');
        this.sessions = new Map();
        this.nonces = {};
        this.load();
    }

    /**
     * Load sessions from disk
     */
    private load(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        if (fs.existsSync(this.sessionsFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));

                // Convert array back to Map, filtering expired sessions
                const now = new Date();
                data.forEach((session: any) => {
                    const expiresAt = new Date(session.expiresAt);
                    if (expiresAt > now) {
                        this.sessions.set(session.token, {
                            ...session,
                            expiresAt,
                            createdAt: new Date(session.createdAt)
                        });
                    }
                });
            } catch (error) {
                console.error('Failed to load wallet sessions:', error);
            }
        }
    }

    /**
     * Save sessions to disk
     */
    private save(): void {
        const data = Array.from(this.sessions.values()).map(session => ({
            ...session,
            expiresAt: session.expiresAt.toISOString(),
            createdAt: session.createdAt.toISOString()
        }));

        fs.writeFileSync(this.sessionsFile, JSON.stringify(data, null, 2));
    }

    /**
     * Generate a nonce for wallet address
     */
    generateNonce(address: string): string {
        const normalizedAddress = address.toLowerCase();

        // Generate random nonce
        const nonce = crypto.randomBytes(16).toString('hex');

        // Store nonce with timestamp
        this.nonces[normalizedAddress] = {
            nonce,
            createdAt: new Date()
        };

        return nonce;
    }

    /**
     * Verify signature (simplified - in production use ethers.js verifyMessage)
     * 
     * For now, we'll do a simplified verification that checks:
     * 1. Nonce exists and is not expired
     * 2. Signature is provided (format validation only)
     * 
     * TODO: Replace with actual signature verification using ethers.js
     */
    verifySignature(address: string, signature: string, nonce: string): boolean {
        const normalizedAddress = address.toLowerCase();

        // Check if nonce exists
        const storedNonce = this.nonces[normalizedAddress];
        if (!storedNonce) {
            console.error('No nonce found for address:', normalizedAddress);
            return false;
        }

        // Check if nonce matches
        if (storedNonce.nonce !== nonce) {
            console.error('Nonce mismatch');
            return false;
        }

        // Check if nonce is expired
        const now = new Date();
        const nonceAge = now.getTime() - storedNonce.createdAt.getTime();
        if (nonceAge > this.NONCE_DURATION_MS) {
            console.error('Nonce expired');
            delete this.nonces[normalizedAddress];
            return false;
        }

        // Check signature format (basic validation)
        if (!signature || signature.length < 10) {
            console.error('Invalid signature format');
            return false;
        }

        // TODO: Actual signature verification
        // const message = `Sign this message to authenticate with CLAWGER\n\nNonce: ${nonce}`;
        // const recoveredAddress = ethers.utils.verifyMessage(message, signature);
        // if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        //     return false;
        // }

        // Clean up used nonce
        delete this.nonces[normalizedAddress];

        return true;
    }

    /**
     * Create a session for authenticated wallet
     */
    createSession(address: string): { token: string; expiresAt: Date } {
        const normalizedAddress = address.toLowerCase();

        // Generate session token
        const token = `session_${crypto.randomBytes(32).toString('hex')}`;

        // Calculate expiry
        const expiresAt = new Date(Date.now() + this.SESSION_DURATION_MS);

        // Create session
        const session: WalletSession = {
            address: normalizedAddress,
            token,
            nonce: '', // Nonce already consumed
            expiresAt,
            createdAt: new Date()
        };

        // Store session
        this.sessions.set(token, session);
        this.save();

        return { token, expiresAt };
    }

    /**
     * Validate session token and return wallet address
     */
    validateSession(token: string): { address: string } | null {
        const session = this.sessions.get(token);

        if (!session) {
            return null;
        }

        // Check if expired
        if (new Date() > session.expiresAt) {
            this.sessions.delete(token);
            this.save();
            return null;
        }

        return { address: session.address };
    }

    /**
     * Revoke a session
     */
    revokeSession(token: string): void {
        this.sessions.delete(token);
        this.save();
    }

    /**
     * Revoke all sessions for a wallet address
     */
    revokeAllSessions(address: string): void {
        const normalizedAddress = address.toLowerCase();

        for (const [token, session] of this.sessions.entries()) {
            if (session.address === normalizedAddress) {
                this.sessions.delete(token);
            }
        }

        this.save();
    }

    /**
     * Clean up expired sessions and nonces
     */
    cleanup(): void {
        const now = new Date();

        // Clean expired sessions
        for (const [token, session] of this.sessions.entries()) {
            if (session.expiresAt < now) {
                this.sessions.delete(token);
            }
        }

        // Clean expired nonces
        for (const [address, data] of Object.entries(this.nonces)) {
            const age = now.getTime() - data.createdAt.getTime();
            if (age > this.NONCE_DURATION_MS) {
                delete this.nonces[address];
            }
        }

        this.save();
    }

    /**
     * Get all active sessions (for debugging)
     */
    getActiveSessions(): WalletSession[] {
        const now = new Date();
        return Array.from(this.sessions.values()).filter(
            session => session.expiresAt > now
        );
    }
}
