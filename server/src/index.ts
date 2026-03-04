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
    origin: [
        'https://www.airbnb.com',
        'https://enthusiastic-contentment-production-3bf3.up.railway.app',
        'http://localhost:5173',
        `chrome-extension://kfolainbdpdnngbojeemhjkjjpgiedah`
    ]
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
