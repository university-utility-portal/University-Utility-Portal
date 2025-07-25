import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

//intialize express App
const app = express();

//configure middlewares
app.use(
	cors({
		origin: [],
		allowedHeaders: ['Content-Type', 'Authorization'],
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
		credentials: true,
	})
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('/public/images'));
app.use(cookieParser());

//routes
import studentRoutes from './routes/student.routes.js';
app.use('/api/v1/student', studentRoutes);

export default app;
