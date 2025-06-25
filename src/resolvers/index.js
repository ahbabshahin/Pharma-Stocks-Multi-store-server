const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');
const Counter = require('../models/Counter');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Sale = require('../models/Sale');
const ActivityLog = require('../models/ActivityLog');

const getNextSequence = async (name) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );
  return counter.sequence;
};

const createActivityLog = async (user, name, action, description) => {
  await ActivityLog.create({
    user: user._id,
    name,
    action,
    description,
  });
};

const generateUpdateDescription = (oldData, newData, fields) => {
  const changes = [];
  fields.forEach((field) => {
    if (oldData[field] !== newData[field] && newData[field] !== undefined) {
      changes.push(`${field} from "${oldData[field]}" to "${newData[field]}"`);
    }
  });
  return changes.length > 0 ? `Changes: ${changes.join(', ')}` : '';
};

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
    sale: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const sale = await Sale.findById(id)
        .populate('customer')
        .populate('business')
        .populate('invoice');
      if (user.role === 'platform' || (user.business && user.business._id.equals(sale.business._id))) {
        return sale;
      }
      throw new Error('Unauthorized');
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
    activityLogs: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role === 'platform') {
        return await ActivityLog.find().populate('user');
      }
      return await ActivityLog.find({ user: user._id }).populate('user');
    },
    me: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      return user;
    }
  },
  Mutation: {
    register: async (_, { username, password, role, businessId }, { user }) => {
      if (user && user.role !== 'platform') throw new Error('Unauthorized');
      const hashedPassword = await bcrypt.hash(password, 10);
      const userData = { username, password: hashedPassword };
      if (role) userData.role = role;
      if (businessId && role !== 'platform') userData.business = businessId;
      const newUser = await User.create(userData);
      const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_LIFETIME
      });
      await createActivityLog(newUser, 'User', 'create', `User "${username}" created`);
      return { token, user: newUser };
    },
    login: async (_, { username, password }) => {
      const user = await User.findOne({ username }).populate('business');
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new Error('Invalid credentials');
      }
      const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_LIFETIME
      });
      await createActivityLog(user, 'User', 'login', `User "${username}" logged in`);
      return { token, user };
    },
    updateUser: async (_, { id, username, password, role, businessId }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      const updateData = {};
      if (username) updateData.username = username;
      if (password) updateData.password = await bcrypt.hash(password, 10);
      if (role) updateData.role = role;
      if (businessId && role !== 'platform') updateData.business = businessId;
      const oldUser = await User.findById(id);
      const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true }).populate('business');
      const description = generateUpdateDescription(
        oldUser,
        updatedUser,
        ['username', 'role', 'business']
      );
      await createActivityLog(user, 'User', 'update', `User "${oldUser.username}" updated. ${description}`);
      return updatedUser;
    },
    deleteUser: async (_, { id }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      const deletedUser = await User.findByIdAndDelete(id);
      if (!deletedUser) throw new Error('User not found');
      await createActivityLog(user, 'User', 'delete', `User "${deletedUser.username}" deleted`);
      return true;
    },
    createBusiness: async (_, { name, address, phone, type }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      const bid = await getNextSequence('businessId');
      const business = await Business.create({ bid, name, address, phone, type });
      await createActivityLog(user, 'Business', 'create', `Business "${name}" (BID: ${bid}) created`);
      return business;
    },
    updateBusiness: async (_, { id, name, address, phone, type }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      const oldBusiness = await Business.findById(id);
      const updateData = { name, address, phone, type };
      const updatedBusiness = await Business.findByIdAndUpdate(id, updateData, { new: true });
      const description = generateUpdateDescription(oldBusiness, updateData, ['name', 'address', 'phone', 'type']);
      await createActivityLog(user, 'Business', 'update', `Business "${oldBusiness.name}" (BID: ${oldBusiness.bid}) updated. ${description}`);
      return updatedBusiness;
    },
    deleteBusiness: async (_, { id }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      const deletedBusiness = await Business.findByIdAndDelete(id);
      if (!deletedBusiness) throw new Error('Business not found');
      await createActivityLog(user, 'Business', 'delete', `Business "${deletedBusiness.name}" (BID: ${deletedBusiness.bid}) deleted`);
      return true;
    },
    createProduct: async (_, { name, sku, quantity, price }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      if (user.role === 'platform') throw new Error('Platform users must specify a business');
      const product = await Product.create({ name, sku, quantity, price, business: user.business._id });
      await createActivityLog(user, 'Product', 'create', `Product "${name}" (SKU: ${sku}) created`);
      return product.populate('business');
    },
    updateProduct: async (_, { id, name, sku, quantity, price }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const oldProduct = await Product.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(oldProduct.business)) {
        throw new Error('Unauthorized');
      }
      const updateData = { name, sku, quantity, price };
      const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true }).populate('business');
      const description = generateUpdateDescription(oldProduct, updateData, ['name', 'sku', 'quantity', 'price']);
      await createActivityLog(user, 'Product', 'update', `Product "${oldProduct.name}" (SKU: ${oldProduct.sku}) updated. ${description}`);
      return updatedProduct;
    },
    deleteProduct: async (_, { id }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const deletedProduct = await Product.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(deletedProduct.business)) {
        throw new Error('Unauthorized');
      }
      await Product.findByIdAndDelete(id);
      await createActivityLog(user, 'Product', 'delete', `Product "${deletedProduct.name}" (SKU: ${deletedProduct.sku}) deleted`);
      return true;
    },
    createCustomer: async (_, { name, email, phone, address }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      if (user.role === 'platform') throw new Error('Platform users must specify a business');
      const customer = await Customer.create({ name, email, phone, address, business: user.business._id });
      await createActivityLog(user, 'Customer', 'create', `Customer "${name}" (Email: ${email}) created`);
      return customer.populate('business');
    },
    updateCustomer: async (_, { id, name, email, phone, address }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const oldCustomer = await Customer.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(oldCustomer.business)) {
        throw new Error('Unauthorized');
      }
      const updateData = { name, email, phone, address };
      const updatedCustomer = await Customer.findByIdAndUpdate(id, updateData, { new: true }).populate('business');
      const description = generateUpdateDescription(oldCustomer, updateData, ['name', 'email', 'phone', 'address']);
      await createActivityLog(user, 'Customer', 'update', `Customer "${oldCustomer.name}" (Email: ${oldCustomer.email}) updated. ${description}`);
      return updatedCustomer;
    },
    deleteCustomer: async (_, { id }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const deletedCustomer = await Customer.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(deletedCustomer.business)) {
        throw new Error('Unauthorized');
      }
      await Customer.findByIdAndDelete(id);
      await createActivityLog(user, 'Customer', 'delete', `Customer "${deletedCustomer.name}" (Email: ${deletedCustomer.email}) deleted`);
      return true;
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
      const sale = await Sale.create({
        invoice: invoice._id,
        customer: customerId,
        business: user.business._id,
        total
      });
      await createActivityLog(user, 'Invoice', 'create', `Invoice created for customer "${customer.name}" (Total: ${total})`);
      await createActivityLog(user, 'Sale', 'create', `Sale created for customer "${customer.name}" (Total: ${total})`);
      return invoice.populate('customer').populate('business').populate('items.product');
    },
    updateInvoice: async (_, { id, customerId, items, status }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const oldInvoice = await Invoice.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(oldInvoice.business)) {
        throw new Error('Unauthorized');
      }
      const updateData = {};
      if (customerId) {
        const customer = await Customer.findById(customerId);
        if (!customer || !user.business._id.equals(customer.business)) {
          throw new Error('Customer does not belong to this business');
        }
        updateData.customer = customerId;
      }
      if (items) {
        for (const item of items) {
          const product = await Product.findById(item.productId);
          if (!product || !user.business._id.equals(product.business)) {
            throw new Error('Product does not belong to this business');
          }
        }
        updateData.items = items;
        updateData.total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      }
      if (status) updateData.status = status;
      const updatedInvoice = await Invoice.findByIdAndUpdate(id, updateData, { new: true })
        .populate('customer')
        .populate('business')
        .populate('items.product');
      const description = generateUpdateDescription(
        oldInvoice,
        { ...updateData, total: updateData.total || oldInvoice.total },
        ['customer', 'total', 'status']
      );
      await createActivityLog(user, 'Invoice', 'update', `Invoice updated. ${description}`);
      if (updateData.total) {
        await Sale.findOneAndUpdate(
          { invoice: id },
          { total: updateData.total },
          { new: true }
        );
        await createActivityLog(user, 'Sale', 'update', `Sale updated for invoice (Total: ${updateData.total})`);
      }
      return updatedInvoice;
    },
    deleteInvoice: async (_, { id }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const deletedInvoice = await Invoice.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(deletedInvoice.business)) {
        throw new Error('Unauthorized');
      }
      await Invoice.findByIdAndDelete(id);
      await Sale.deleteOne({ invoice: id });
      await createActivityLog(user, 'Invoice', 'delete', `Invoice deleted (Total: ${deletedInvoice.total})`);
      await createActivityLog(user, 'Sale', 'delete', `Sale deleted for invoice (Total: ${deletedInvoice.total})`);
      return true;
    },
    deleteSale: async (_, { id }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const deletedSale = await Sale.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(deletedSale.business)) {
        throw new Error('Unauthorized');
      }
      await Sale.findByIdAndDelete(id);
      await createActivityLog(user, 'Sale', 'delete', `Sale deleted (Total: ${deletedSale.total})`);
      return true;
    }
  }
};

module.exports = resolvers;
