import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import listingsRouter from './routes/listings';
import snapshotsRouter from './routes/snapshots';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/listings', listingsRouter);
app.use('/api/snapshots', snapshotsRouter);

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
