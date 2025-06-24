require('dotenv').config();
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const cors = require('cors');
const connectDB = require('./src/config/db');
const schema = require('./src/schemas');
const resolvers = require('./src/resolvers');
const authMiddleware = require('./src/middleware/auth');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/graphql', authMiddleware, graphqlHTTP((req) => ({
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
