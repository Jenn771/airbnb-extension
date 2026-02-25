import express from 'express';
import dotenv from 'dotenv';
import listingsRouter from './routes/listings';

dotenv.config();

const app = express();

app.use(express.json());

app.use('/api/listings', listingsRouter);

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
