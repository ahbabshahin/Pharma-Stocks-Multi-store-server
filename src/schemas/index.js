const { buildSchema } = require('graphql');

const schema = buildSchema(`
  type User {
    id: ID!
    username: String!
    role: String!
    business: Business
    createdAt: String!
  }

  type Business {
    id: ID!
    name: String!
    address: String
    phone: String
    type: String!
    createdAt: String!
  }

  type Product {
    id: ID!
    name: String!
    sku: String!
    quantity: Int!
    price: Float!
    business: Business!
    createdAt: String!
  }

  type Customer {
    id: ID!
    name: String!
    email: String!
    phone: String
    address: String
    business: Business!
    createdAt: String!
  }

  type InvoiceItem {
    product: Product!
    quantity: Int!
    price: Float!
  }

  type Invoice {
    id: ID!
    customer: Customer!
    business: Business!
    items: [InvoiceItem!]!
    total: Float!
    status: String!
    createdAt: String!
  }

  type Sale {
    id: ID!
    invoice: Invoice!
    customer: Customer!
    business: Business!
    total: Float!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    businesses: [Business!]!
    business(id: ID!): Business
    products: [Product!]!
    product(id: ID!): Product
    customers: [Customer!]!
    customer(id: ID!): Customer
    invoices: [Invoice!]!
    invoice(id: ID!): Invoice
    sales: [Sale!]!
    salesReport(startDate: String!, endDate: String!): [Sale!]!
    me: User
  }

  type Mutation {
    register(username: String!, password: String!, role: String, businessId: ID): AuthPayload!
    login(username: String!, password: String!): AuthPayload!
    createBusiness(name: String!, address: String, phone: String, type: String!): Business!
    updateBusiness(id: ID!, name: String, address: String, phone: String, type: String): Business!
    createProduct(name: String!, sku: String!, quantity: Int!, price: Float!): Product!
    updateProduct(id: ID!, name: String, sku: String, quantity: Int, price: Float): Product!
    createCustomer(name: String!, email: String!, phone: String, address: String): Customer!
    createInvoice(customerId: ID!, items: [InvoiceItemInput!]!): Invoice!
  }

  input InvoiceItemInput {
    productId: ID!
    quantity: Int!
    price: Float!
  }
`);

module.exports = schema;
