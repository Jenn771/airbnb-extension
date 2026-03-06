import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import listingsRouter from './routes/listings';
import snapshotsRouter from './routes/snapshots';
import ogImageRouter from './routes/og-image';
import { initializeDatabase } from './db/client';

dotenv.config();

const app = express();

app.use(cors({
    origin: (origin, callback) => {
        const allowed = [
            'https://www.airbnb.com',
            'https://enthusiastic-contentment-production-66a6.up.railway.app',
            'http://localhost:5173',
        ];
        if (!origin || allowed.includes(origin) || origin.startsWith('chrome-extension://')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json());

app.use('/api/listings', listingsRouter);
app.use('/api/snapshots', snapshotsRouter);
app.use('/api/og-image', ogImageRouter);

const port = process.env.PORT || 3000;

initializeDatabase()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server listening on port ${port}`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });
