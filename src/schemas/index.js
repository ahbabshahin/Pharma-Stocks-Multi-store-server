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
    bid: Int!
    name: String!
    address: String
    phone: String
    type: String!
    createdAt: String!
  }

  type Product {
    id: ID!
    name: String!
    brand: String!
    sku: String!
    quantity: Int!
    price: Float!
    lowStockAmount: Int!
    lowStockAlert: Boolean!
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

  type ActivityLog {
    id: ID!
    user: User!
    name: String!
    action: String!
    when: String!
    description: String!
  }

  type PaginatedBusinesses {
    items: [Business!]!
    totalCount: Int!
    hasMore: Boolean!
  }

  type PaginatedProducts {
    items: [Product!]!
    totalCount: Int!
    hasMore: Boolean!
  }

  type PaginatedCustomers {
    items: [Customer!]!
    totalCount: Int!
    hasMore: Boolean!
  }

  type PaginatedInvoices {
    items: [Invoice!]!
    totalCount: Int!
    hasMore: Boolean!
  }

  type PaginatedSales {
    items: [Sale!]!
    totalCount: Int!
    hasMore: Boolean!
  }

  type PaginatedActivityLogs {
    items: [ActivityLog!]!
    totalCount: Int!
    hasMore: Boolean!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    businesses(first: Int, offset: Int): PaginatedBusinesses!
    business(id: ID!): Business
    searchBusinesses(searchTerm: String!, first: Int, offset: Int): PaginatedBusinesses!
    products(first: Int, offset: Int): PaginatedProducts!
    product(id: ID!): Product
    searchProducts(searchTerm: String!, businessId: ID, first: Int, offset: Int): PaginatedProducts!
    lowStockProducts(first: Int, offset: Int): PaginatedProducts!
    customers(first: Int, offset: Int): PaginatedCustomers!
    customer(id: ID!): Customer
    invoices(first: Int, offset: Int): PaginatedInvoices!
    invoice(id: ID!): Invoice
    sales(first: Int, offset: Int): PaginatedSales!
    sale(id: ID!): Sale
    salesReport(startDate: String!, endDate: String!): [Sale!]!
    activityLogs(first: Int, offset: Int): PaginatedActivityLogs!
    me: User
  }

  type Mutation {
    register(username: String!, password: String!, role: String, businessId: ID): AuthPayload!
    login(username: String!, password: String!): AuthPayload!
    updateUser(id: ID!, username: String, password: String, role: String, businessId: ID): User!
    deleteUser(id: ID!): Boolean!
    createBusiness(name: String!, address: String, phone: String, type: String!): Business!
    updateBusiness(id: ID!, name: String, address: String, phone: String, type: String): Business!
    deleteBusiness(id: ID!): Boolean!
    createProduct(name: String!, brand: String!, sku: String!, quantity: Int!, price: Float!, lowStockAmount: Int): Product!
    updateProduct(id: ID!, name: String, brand: String, sku: String, quantity: Int, price: Float, lowStockAmount: Int): Product!
    deleteProduct(id: ID!): Boolean!
    createCustomer(name: String!, email: String!, phone: String, address: String): Customer!
    updateCustomer(id: ID!, name: String, email: String, phone: String, address: String): Customer!
    deleteCustomer(id: ID!): Boolean!
    createInvoice(customerId: ID!, items: [InvoiceItemInput!]!): Invoice!
    updateInvoice(id: ID!, customerId: ID, items: [InvoiceItemInput!], status: String): Invoice!
    deleteInvoice(id: ID!): Boolean!
    deleteSale(id: ID!): Boolean!
  }

  input InvoiceItemInput {
    productId: ID!
    quantity: Int!
    price: Float!
  }
`);

module.exports = schema;
