const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Sale = require('../models/Sale');

const resolvers = {
  Query: {
    businesses: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role === 'platform') {
        return await Business.find();
      }
      throw new Error('Unauthorized');
    },
    business: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role === 'platform' || (user.business && user.business._id.toString() === id)) {
        return await Business.findById(id);
      }
      throw new Error('Unauthorized');
    },
    products: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role === 'platform') {
        return await Product.find().populate('business');
      }
      return await Product.find({ business: user.business._id }).populate('business');
    },
    product: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const product = await Product.findById(id).populate('business');
      if (user.role === 'platform' || (user.business && user.business._id.equals(product.business._id))) {
        return product;
      }
      throw new Error('Unauthorized');
    },
    customers: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role === 'platform') {
        return await Customer.find().populate('business');
      }
      return await Customer.find({ business: user.business._id }).populate('business');
    },
    customer: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const customer = await Customer.findById(id).populate('business');
      if (user.role === 'platform' || (user.business && user.business._id.equals(customer.business._id))) {
        return customer;
      }
      throw new Error('Unauthorized');
    },
    invoices: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role === 'platform') {
        return await Invoice.find().populate('customer').populate('business').populate('items.product');
      }
      return await Invoice.find({ business: user.business._id })
        .populate('customer')
        .populate('business')
        .populate('items.product');
    },
    invoice: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const invoice = await Invoice.findById(id)
        .populate('customer')
        .populate('business')
        .populate('items.product');
      if (user.role === 'platform' || (user.business && user.business._id.equals(invoice.business._id))) {
        return invoice;
      }
      throw new Error('Unauthorized');
    },
    sales: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role === 'platform') {
        return await Sale.find().populate('customer').populate('business').populate('invoice');
      }
      return await Sale.find({ business: user.business._id })
        .populate('customer')
        .populate('business')
        .populate('invoice');
    },
    salesReport: async (_, { startDate, endDate }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const query = {
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      };
      if (user.role !== 'platform') {
        query.business = user.business._id;
      }
      return await Sale.find(query)
        .populate('customer')
        .populate('business')
        .populate('invoice');
    },
    me: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      return user;
    }
  },
  Mutation: {
    register: async (_, { username, password, role, businessId }) => {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userData = { username, password: hashedPassword };
      if (role) userData.role = role;
      if (businessId && role !== 'platform') userData.business = businessId;
      const user = await User.create(userData);
      const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
      return { token, user };
    },
    login: async (_, { username, password }) => {
      const user = await User.findOne({ username }).populate('business');
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new Error('Invalid credentials');
      }
      const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
      return { token, user };
    },
    createBusiness: async (_, { name, address, phone, type }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      return await Business.create({ name, address, phone, type });
    },
    updateBusiness: async (_, { id, name, address, phone, type }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      return await Business.findByIdAndUpdate(id, { name, address, phone, type }, { new: true });
    },
    createProduct: async (_, { name, sku, quantity, price }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      if (user.role === 'platform') throw new Error('Platform users must specify a business');
      return await Product.create({ name, sku, quantity, price, business: user.business._id });
    },
    updateProduct: async (_, { id, name, sku, quantity, price }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const product = await Product.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(product.business)) {
        throw new Error('Unauthorized');
      }
      return await Product.findByIdAndUpdate(id, { name, sku, quantity, price }, { new: true });
    },
    createCustomer: async (_, { name, email, phone, address }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      if (user.role === 'platform') throw new Error('Platform users must specify a business');
      return await Customer.create({ name, email, phone, address, business: user.business._id });
    },
    createInvoice: async (_, { customerId, items }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      if (user.role === 'platform') throw new Error('Platform users must specify a business');
      const customer = await Customer.findById(customerId);
      if (!customer || !user.business._id.equals(customer.business)) {
        throw new Error('Customer does not belong to this business');
      }
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product || !user.business._id.equals(product.business)) {
          throw new Error('Product does not belong to this business');
        }
      }
      const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const invoice = await Invoice.create({
        customer: customerId,
        business: user.business._id,
        items,
        total
      });
      await Sale.create({
        invoice: invoice._id,
        customer: customerId,
        business: user.business._id,
        total
      });
      return invoice.populate('customer').populate('business').populate('items.product');
    }
  }
};

module.exports = resolvers;
