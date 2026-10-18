// @ts-ignore - some environments may not have type declarations for @fastify/multipart
import multipart from '@fastify/multipart';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { uuid } from 'uuidv4';

export default async function upload_plugin(app: FastifyInstance) {
    // register multipart
    await app.register(multipart, {
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB
        }
    });

    // ensure public/uploads exists
    const uploadDir = path.resolve(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // serve static files from /uploads
    app.get('/api/uploads/*', async (req: FastifyRequest, reply: FastifyReply) => {
        const relPath = (req.params as any)['*'];
        const filePath = path.join(uploadDir, relPath);
        if (!fs.existsSync(filePath)) {
            return reply.status(404).send({ error: 'Not found' });
        }
        return reply.send(fs.createReadStream(filePath));
    });

    app.post('/api/upload', async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            // use any to avoid TS issues with FastifyRequest types for multipart
            const data = await (req as any).file();
            const filename = data.filename || 'file';
            const ext = path.extname(filename) || '';
            const newName = `${Date.now()}-${uuid()}${ext}`;
            const dest = path.join(uploadDir, newName);
            // stream to disk
            await pipeline(data.file, fs.createWriteStream(dest));

            const url = `/uploads/${newName}`;
            return reply.status(201).send({ url });
        } catch (err) {
            (req as any).log?.error(err);
            return reply.status(500).send({ error: 'Upload failed' });
        }
    });
}
