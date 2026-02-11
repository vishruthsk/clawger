import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ArtifactMetadata {
    filename: string;              // Sanitized filename with timestamp prefix
    original_filename: string;     // Original uploaded filename
    url: string;                   // Download URL
    size: number;                  // File size in bytes
    mime_type: string;             // MIME type
    uploaded_by: string;           // Agent ID or wallet address
    uploaded_at: Date;             // Upload timestamp
}

/**
 * ArtifactStorage - Handles file uploads for mission artifacts
 * 
 * Features:
 * - Sanitizes filenames to prevent path traversal
 * - Adds timestamp prefix to prevent collisions
 * - Creates mission-specific directories
 * - Validates file types and sizes
 * - Generates download URLs
 */
export class ArtifactStorage {
    private baseDir: string;
    private maxFileSize: number = 10 * 1024 * 1024; // 10MB per file
    private maxTotalSize: number = 50 * 1024 * 1024; // 50MB total per submission

    // Allowed file extensions
    private allowedExtensions = new Set([
        // Documents
        '.pdf', '.md', '.txt',
        // Images
        '.png', '.jpg', '.jpeg', '.gif', '.svg',
        // Archives
        '.zip', '.tar.gz', '.tar',
        // Code files
        '.ts', '.tsx', '.js', '.jsx', '.py', '.sol', '.rs',
        '.go', '.java', '.c', '.cpp', '.h', '.hpp',
        '.css', '.scss', '.html', '.json', '.yaml', '.yml'
    ]);

    constructor(dataDir: string) {
        this.baseDir = path.join(dataDir, 'artifacts');
        this.ensureBaseDir();
    }

    /**
     * Ensure base artifacts directory exists
     */
    private ensureBaseDir(): void {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
            console.log(`[ArtifactStorage] Created base directory: ${this.baseDir}`);
        }
    }

    /**
     * Ensure mission-specific directory exists
     */
    private ensureMissionDir(missionId: string): string {
        const missionDir = path.join(this.baseDir, missionId);
        if (!fs.existsSync(missionDir)) {
            fs.mkdirSync(missionDir, { recursive: true });
            console.log(`[ArtifactStorage] Created mission directory: ${missionDir}`);
        }
        return missionDir;
    }

    /**
     * Sanitize filename to prevent path traversal and special characters
     */
    private sanitizeFilename(filename: string): string {
        // Remove path components
        const basename = path.basename(filename);

        // Remove special characters except dots, dashes, underscores
        const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');

        // Prevent multiple dots (except for extensions like .tar.gz)
        const cleaned = sanitized.replace(/\.{2,}/g, '.');

        return cleaned;
    }

    /**
     * Generate unique filename with timestamp prefix
     */
    private generateFilename(originalFilename: string): string {
        const sanitized = this.sanitizeFilename(originalFilename);
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');

        // Extract extension
        const ext = path.extname(sanitized);
        const nameWithoutExt = path.basename(sanitized, ext);

        return `${timestamp}_${random}_${nameWithoutExt}${ext}`;
    }

    /**
     * Validate file extension
     */
    private isAllowedExtension(filename: string): boolean {
        const ext = path.extname(filename).toLowerCase();

        // Check for .tar.gz
        if (filename.toLowerCase().endsWith('.tar.gz')) {
            return this.allowedExtensions.has('.tar.gz');
        }

        return this.allowedExtensions.has(ext);
    }

    /**
     * Get MIME type from filename
     */
    private getMimeType(filename: string): string {
        const ext = path.extname(filename).toLowerCase();

        const mimeTypes: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.md': 'text/markdown',
            '.txt': 'text/plain',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.zip': 'application/zip',
            '.tar': 'application/x-tar',
            '.tar.gz': 'application/gzip',
            '.ts': 'text/typescript',
            '.tsx': 'text/typescript',
            '.js': 'text/javascript',
            '.jsx': 'text/javascript',
            '.py': 'text/x-python',
            '.sol': 'text/plain',
            '.rs': 'text/x-rust',
            '.json': 'application/json',
            '.yaml': 'text/yaml',
            '.yml': 'text/yaml',
        };

        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Save uploaded file to mission artifacts directory
     */
    async saveFile(
        missionId: string,
        file: File,
        uploadedBy: string
    ): Promise<ArtifactMetadata> {
        console.log(`[ArtifactStorage] Saving file for mission ${missionId}: ${file.name}`);

        // Validate file extension
        if (!this.isAllowedExtension(file.name)) {
            throw new Error(`File type not allowed: ${path.extname(file.name)}`);
        }

        // Validate file size
        if (file.size > this.maxFileSize) {
            throw new Error(`File too large: ${file.size} bytes (max ${this.maxFileSize})`);
        }

        // Ensure mission directory exists
        const missionDir = this.ensureMissionDir(missionId);

        // Generate unique filename
        const filename = this.generateFilename(file.name);
        const filePath = path.join(missionDir, filename);

        // Save file to disk
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(filePath, buffer);

        console.log(`[ArtifactStorage] File saved: ${filePath}`);

        // Generate metadata
        const metadata: ArtifactMetadata = {
            filename,
            original_filename: file.name,
            url: `/api/artifacts/${missionId}/${filename}`,
            size: file.size,
            mime_type: file.type || this.getMimeType(file.name),
            uploaded_by: uploadedBy,
            uploaded_at: new Date()
        };

        return metadata;
    }

    /**
     * Get absolute path to artifact file
     */
    getArtifactPath(missionId: string, filename: string): string {
        // Sanitize to prevent path traversal
        const sanitized = this.sanitizeFilename(filename);
        return path.join(this.baseDir, missionId, sanitized);
    }

    /**
     * List all artifacts for a mission
     */
    listArtifacts(missionId: string): ArtifactMetadata[] {
        const missionDir = path.join(this.baseDir, missionId);

        if (!fs.existsSync(missionDir)) {
            return [];
        }

        const files = fs.readdirSync(missionDir);
        const artifacts: ArtifactMetadata[] = [];

        for (const filename of files) {
            const filePath = path.join(missionDir, filename);
            const stats = fs.statSync(filePath);

            if (stats.isFile()) {
                artifacts.push({
                    filename,
                    original_filename: filename,
                    url: `/api/artifacts/${missionId}/${filename}`,
                    size: stats.size,
                    mime_type: this.getMimeType(filename),
                    uploaded_by: 'unknown',
                    uploaded_at: stats.mtime
                });
            }
        }

        return artifacts;
    }

    /**
     * Delete artifact file
     */
    deleteArtifact(missionId: string, filename: string): boolean {
        const filePath = this.getArtifactPath(missionId, filename);

        if (!fs.existsSync(filePath)) {
            console.warn(`[ArtifactStorage] File not found: ${filePath}`);
            return false;
        }

        fs.unlinkSync(filePath);
        console.log(`[ArtifactStorage] Deleted artifact: ${filePath}`);
        return true;
    }

    /**
     * Check if artifact exists
     */
    exists(missionId: string, filename: string): boolean {
        const filePath = this.getArtifactPath(missionId, filename);
        return fs.existsSync(filePath);
    }

    /**
     * Get file stats
     */
    getFileStats(missionId: string, filename: string): fs.Stats | null {
        const filePath = this.getArtifactPath(missionId, filename);

        if (!fs.existsSync(filePath)) {
            return null;
        }

        return fs.statSync(filePath);
    }
}
