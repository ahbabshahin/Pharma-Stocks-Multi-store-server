require('dotenv').config();
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const schema = require('./src/schemas');
const resolvers = require('./src/resolvers');
const authMiddleware = require('./src/middleware/auth');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "http://localhost:4000"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"]
    }
  }
}));
app.use(express.json());

// Rate limiting for GraphQL endpoint
const graphqlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/graphql', graphqlLimiter, authMiddleware, graphqlHTTP((req) => ({
  schema,
  rootValue: resolvers,
  graphiql: true,
  context: { user: req.user }
})));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
