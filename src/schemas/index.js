import { gql } from 'graphql-tag';

const typeDefs = gql`
	type User {
		_id: ID!
		username: String!
		role: String!
		business: Business
		createdAt: String!
	}

	type Business {
		_id: ID!
		bid: Int!
		name: String!
		address: String
		phone: String
		type: String!
		createdAt: String!
	}

	type Product {
		_id: ID!
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
		_id: ID!
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
		_id: ID!
		customer: Customer!
		business: Business!
		body: [InvoiceItem!]!
		total: Float!
		status: String!
		createdAt: String!
	}

	type Sale {
		_id: ID!
		invoice: Invoice!
		customer: Customer!
		business: Business!
		total: Float!
		createdAt: String!
	}

	type ActivityLog {
		_id: ID!
		user: User!
		name: String!
		action: String!
		when: String!
		description: String!
	}

	type PaginatedUsers {
		body: [User!]!
		total: Int!
		hasMore: Boolean!
	}


	type PaginatedBusinesses {
		body: [Business!]!
		total: Int!
		hasMore: Boolean!
	}

	type PaginatedProducts {
		body: [Product!]!
		total: Int!
		hasMore: Boolean!
	}

	type PaginatedCustomers {
		body: [Customer!]!
		total: Int!
		hasMore: Boolean!
	}

	type PaginatedInvoices {
		body: [Invoice!]!
		total: Int!
		hasMore: Boolean!
	}

	type PaginatedSales {
		body: [Sale!]!
		total: Int!
		hasMore: Boolean!
	}

	type PaginatedActivityLogs {
		body: [ActivityLog!]!
		total: Int!
		hasMore: Boolean!
	}

	type AuthPayload {
		token: String!
		user: User!
	}

	type Query {
		getUsers(first: Int, offset: Int): PaginatedUsers!
		businesses(first: Int, offset: Int): PaginatedBusinesses!
		business(id: ID!): Business
		searchBusinesses(
			searchTerm: String!
			first: Int
			offset: Int
		): PaginatedBusinesses!
		products(first: Int, offset: Int): PaginatedProducts!
		product(id: ID!): Product
		searchProducts(
			searchTerm: String!
			businessId: ID
			first: Int
			offset: Int
		): PaginatedProducts!
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
		register(
			username: String!
			password: String!
			role: String
			businessId: ID
		): AuthPayload!
		login(username: String!, password: String!): AuthPayload!
		updateUser(
			id: ID!
			username: String
			password: String
			role: String
			businessId: ID
		): User!
		deleteUser(id: ID!): Boolean!
		createBusiness(
			name: String!
			address: String
			phone: String
			type: String!
		): Business!
		updateBusiness(
			id: ID!
			name: String
			address: String
			phone: String
			type: String
		): Business!
		deleteBusiness(id: ID!): Boolean!
		createProduct(
			name: String!
			brand: String!
			sku: String!
			quantity: Int!
			price: Float!
			lowStockAmount: Int
		): Product!
		updateProduct(
			id: ID!
			name: String
			brand: String
			sku: String
			quantity: Int
			price: Float
			lowStockAmount: Int
		): Product!
		deleteProduct(id: ID!): Boolean!
		createCustomer(
			name: String!
			email: String!
			phone: String
			address: String
		): Customer!
		updateCustomer(
			id: ID!
			name: String
			email: String
			phone: String
			address: String
		): Customer!
		deleteCustomer(id: ID!): Boolean!
		createInvoice(customerId: ID!, body: [InvoiceItemInput!]!): Invoice!
		updateInvoice(
			id: ID!
			customerId: ID
			body: [InvoiceItemInput!]
			status: String
		): Invoice!
		deleteInvoice(id: ID!): Boolean!
		deleteSale(id: ID!): Boolean!
	}

	input InvoiceItemInput {
		productId: ID!
		quantity: Int!
		price: Float!
	}
`;

export default typeDefs;
