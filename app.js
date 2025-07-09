import { config } from 'dotenv';
config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './src/config/db.js';
import typeDefs from './src/schemas/index.js';
import resolvers from './src/resolvers/index.js';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import jwt from 'jsonwebtoken';
import User from './src/models/User.js';

const app = express();

// Connect to MongoDB
connectDB();

// Middleware for non-GraphQL routes
app.use(
	cors({
		origin: ['http://localhost:3000', 'http://localhost:5000'],
		methods: ['POST', 'GET'],
		allowedHeaders: [
			'Content-Type',
			'Authorization',
			'x-apollo-operation-name',
			'apollo-require-preflight',
		],
	})
);
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				scriptSrc: ["'self'", "'unsafe-inline'"],
				connectSrc: [
					"'self'",
					'http://localhost:5000',
					'http://localhost:3000',
				],
				imgSrc: ["'self'", 'data:'],
				fontSrc: ["'self'"],
			},
		},
	})
);
app.use(express.json());

// Rate limiting for non-GraphQL routes
const rateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message:
		'Too many requests from this IP, please try again after 15 minutes',
	standardHeaders: true,
	legacyHeaders: false,
});
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
	res.status(200).json({ status: 'OK' });
});

// const getTokenForRequest = async (req) => {
// 	console.log('Context function triggered:', {
// 		operationName: req.body.operationName,
// 		headers: req.headers,
// 		body: req.body,
// 	});
// 	const operationName = req.body.operationName || 'unknown';
// 	if (operationName === 'login' || operationName === 'register') {
// 		return { user: null };
// 	}
// 	const token = req.headers.authorization?.replace('Bearer ', '');
// 	if (!token) {
// 		throw new Error('Not authenticated');
// 	}
// 	try {
// 		const decoded = jwt.verify(token, process.env.JWT_SECRET);

// 		const user = await User.findById(decoded.id).populate('business');
// 		if (!user) {
// 			throw new Error('User not found');
// 		}

// 		return { user };
// 	} catch (error) {
// 		throw new Error('Invalid token');
// 	}
// };

// Apollo Server
const server = new ApolloServer({
	typeDefs,
	resolvers,
	csrfPrevention: false,
	introspection: true,
	formatError: (error) => {
		return error;
	},
});

// Start server
const PORT = process.env.PORT || 5000;
startStandaloneServer(server, {
	listen: { port: PORT },
	context: async ({ req }) => {
		const {
			headers,
			headers: { authorization, operationname: operationName },
		} = req;
		if (headers) {
			console.log('Context function triggered:', {
				operationName: operationName,
				headers: headers,
				body: req.body,
			});
			// operationName = operationName || 'unknown';

			if (operationName === 'login' || operationName === 'register') {
				return { user: null };
			}
			const token = authorization?.replace('Bearer ', '');
			if (!token) {
				throw new Error('Not authenticated');
			}
			try {
				const decoded = jwt.verify(token, process.env.JWT_SECRET);

				const user = await User.findById(decoded.id).populate(
					'business'
				);
				if (!user) {
					throw new Error('User not found');
				}

				return { user };
			} catch (error) {
				throw new Error('Invalid token');
			}
		}
	},
}).then(({ url }) => {});
