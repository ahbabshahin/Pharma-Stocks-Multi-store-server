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

const createActivityLog = async (user, { name, action, description }) => {
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

const paginate = async (model, query, { first, offset }, populateFields = []) => {
  const limit = first || 10;
  const skip = offset || 0;
  const totalCount = await model.countDocuments(query);
  let queryBuilder = model.find(query).skip(skip).limit(limit);
  populateFields.forEach((field) => {
    queryBuilder = queryBuilder.populate(field);
  });
  const items = await queryBuilder;
  return {
    items,
    totalCount,
    hasMore: skip + items.length < totalCount
  };
};

const checkLowStock = (product) => {
  const lowStockAlert = product.quantity <= product.lowStockAmount;
  return { ...product.toObject(), lowStockAlert };
};

const updateProductStock = async (productId, quantityChange, user, action, descriptionPrefix) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');
  const newQuantity = product.quantity + quantityChange;
  if (newQuantity < 0) throw new Error(`Insufficient stock for product "${product.name}" (SKU: ${product.sku})`);
  const oldLowStockAlert = product.lowStockAlert;
  product.quantity = newQuantity;
  product.lowStockAlert = newQuantity <= product.lowStockAmount;
  await product.save();
  if (quantityChange !== 0 || oldLowStockAlert !== product.lowStockAlert) {
    const description = `${descriptionPrefix} Product "${product.name}" (SKU: ${product.sku}) stock changed by ${quantityChange}. New quantity: ${newQuantity}. Low stock alert: ${product.lowStockAlert}`;
    await createActivityLog(user, { name: 'Product', action, description });
  }
  return product;
};

const resolvers = {
  Query: {
    businesses: async (_, { first, offset }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role !== 'platform') throw new Error('Unauthorized');
      return await paginate(Business, {}, { first, offset });
    },
    business: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role === 'platform' || (user.business && user.business._id.toString() === id)) {
        return await Business.findById(id);
      }
      throw new Error('Unauthorized');
    },
    searchBusinesses: async (_, { searchTerm, first, offset }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role !== 'platform') throw new Error('Unauthorized');
      const query = {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { bid: !isNaN(searchTerm) ? Number(searchTerm) : -1 }
        ]
      };
      const result = await paginate(Business, query, { first, offset });
      await createActivityLog(user, { name: 'Business', action: 'search', description: `Searched businesses with term "${searchTerm}"` });
      return result;
    },
    products: async (_, { first, offset }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const query = user.role === 'platform' ? {} : { business: user.business._id };
      const result = await paginate(Product, query, { first, offset }, ['business']);
      return {
        ...result,
        items: result.items.map(checkLowStock)
      };
    },
    product: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const product = await Product.findById(id).populate('business');
      if (user.role === 'platform' || (user.business && user.business._id.equals(product.business._id))) {
        return checkLowStock(product);
      }
      throw new Error('Unauthorized');
    },
    searchProducts: async (_, { searchTerm, businessId, first, offset }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const query = {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { brand: { $regex: searchTerm, $options: 'i' } }
        ]
      };
      if (user.role !== 'platform') {
        query.business = user.business._id;
      } else if (businessId) {
        query.business = businessId;
      }
      const result = await paginate(Product, query, { first, offset }, ['business']);
      return {
        ...result,
        items: result.items.map(checkLowStock)
      };
    },
    lowStockProducts: async (_, { first, offset }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const query = { lowStockAlert: true };
      if (user.role !== 'platform') {
        query.business = user.business._id;
      }
      const result = await paginate(Product, query, { first, offset }, ['business']);
      return {
        ...result,
        items: result.items.map(checkLowStock)
      };
    },
    customers: async (_, { first, offset }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const query = user.role === 'platform' ? {} : { business: user.business._id };
      return await paginate(Customer, query, { first, offset }, ['business']);
    },
    customer: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const customer = await Customer.findById(id).populate('business');
      if (user.role === 'platform' || (user.business && user.business._id.equals(customer.business._id))) {
        return customer;
      }
      throw new Error('Unauthorized');
    },
    invoices: async (_, { first, offset }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const query = user.role === 'platform' ? {} : { business: user.business._id };
      return await paginate(Invoice, query, { first, offset }, ['customer', 'business', 'items.product']);
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
    sales: async (_, { first, offset }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const query = user.role === 'platform' ? {} : { business: user.business._id };
      return await paginate(Sale, query, { first, offset }, ['customer', 'business', 'invoice']);
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
    activityLogs: async (_, { first, offset }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      const query = user.role === 'platform' ? {} : { user: user._id };
      return await paginate(ActivityLog, query, { first, offset }, ['user']);
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
      await createActivityLog(newUser, { name: 'User', action: 'create', description: `User "${username}" created` });
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
      await createActivityLog(user, { name: 'User', action: 'login', description: `User "${username}" logged in` });
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
      const description = generateUpdateDescription(oldUser, updatedUser, ['username', 'role', 'business']);
      await createActivityLog(user, { name: 'User', action: 'update', description: `User "${oldUser.username}" updated. ${description}` });
      return updatedUser;
    },
    deleteUser: async (_, { id }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      const deletedUser = await User.findByIdAndDelete(id);
      if (!deletedUser) throw new Error('User not found');
      await createActivityLog(user, { name: 'User', action: 'delete', description: `User "${deletedUser.username}" deleted` });
      return true;
    },
    createBusiness: async (_, { name, address, phone, type }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      const bid = await getNextSequence('businessId');
      const business = await Business.create({ bid, name, address, phone, type });
      await createActivityLog(user, { name: 'Business', action: 'create', description: `Business "${name}" (BID: ${bid}) created` });
      return business;
    },
    updateBusiness: async (_, { id, name, address, phone, type }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      const oldBusiness = await Business.findById(id);
      const updateData = { name, address, phone, type };
      const updatedBusiness = await Business.findByIdAndUpdate(id, updateData, { new: true });
      const description = generateUpdateDescription(oldBusiness, updateData, ['name', 'address', 'phone', 'type']);
      await createActivityLog(user, { name: 'Business', action: 'update', description: `Business "${oldBusiness.name}" (BID: ${oldBusiness.bid}) updated. ${description}` });
      return updatedBusiness;
    },
    deleteBusiness: async (_, { id }, { user }) => {
      if (!user || user.role !== 'platform') throw new Error('Unauthorized');
      const deletedBusiness = await Business.findByIdAndDelete(id);
      if (!deletedBusiness) throw new Error('Business not found');
      await createActivityLog(user, { name: 'Business', action: 'delete', description: `Business "${deletedBusiness.name}" (BID: ${deletedBusiness.bid}) deleted` });
      return true;
    },
    createProduct: async (_, { name, brand, sku, quantity, price, lowStockAmount }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      if (user.role === 'platform') throw new Error('Platform users must specify a business');
      const productData = {
        name,
        brand,
        sku,
        quantity,
        price,
        business: user.business._id,
        lowStockAmount: lowStockAmount || 10
      };
      productData.lowStockAlert = productData.quantity <= productData.lowStockAmount;
      const product = await Product.create(productData);
      await createActivityLog(user, { name: 'Product', action: 'create', description: `Product "${name}" (SKU: ${sku}, Brand: ${brand}) created` });
      return product.populate('business');
    },
    updateProduct: async (_, { id, name, brand, sku, quantity, price, lowStockAmount }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const oldProduct = await Product.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(oldProduct.business)) {
        throw new Error('Unauthorized');
      }
      const updateData = { name, brand, sku, price, lowStockAmount };
      if (quantity !== undefined || lowStockAmount !== undefined) {
        const newQuantity = quantity !== undefined ? quantity : oldProduct.quantity;
        const newLowStockAmount = lowStockAmount !== undefined ? lowStockAmount : oldProduct.lowStockAmount;
        updateData.quantity = newQuantity;
        updateData.lowStockAlert = newQuantity <= newLowStockAmount;
      }
      const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true }).populate('business');
      const description = generateUpdateDescription(oldProduct, updateData, ['name', 'brand', 'sku', 'quantity', 'price', 'lowStockAmount', 'lowStockAlert']);
      await createActivityLog(user, { name: 'Product', action: 'update', description: `Product "${oldProduct.name}" (SKU: ${oldProduct.sku}) updated. ${description}` });
      return checkLowStock(updatedProduct);
    },
    deleteProduct: async (_, { id }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const deletedProduct = await Product.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(deletedProduct.business)) {
        throw new Error('Unauthorized');
      }
      await Product.findByIdAndDelete(id);
      await createActivityLog(user, { name: 'Product', action: 'delete', description: `Product "${deletedProduct.name}" (SKU: ${deletedProduct.sku}) deleted` });
      return true;
    },
    createCustomer: async (_, { name, email, phone, address }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      if (user.role === 'platform') throw new Error('Platform users must specify a business');
      const customer = await Customer.create({ name, email, phone, address, business: user.business._id });
      await createActivityLog(user, { name: 'Customer', action: 'create', description: `Customer "${name}" (Email: ${email}) created` });
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
      const description = generateUpdateDescription(oldCustomer, updatedCustomer, ['name', 'email', 'phone', 'address']);
      await createActivityLog(user, { name: 'Customer', action: 'update', description: `Customer "${oldCustomer.name}" (Email: ${oldCustomer.email}) updated. ${description}` });
      return updatedCustomer;
    },
    deleteCustomer: async (_, { id }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const deletedCustomer = await Customer.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(deletedCustomer.business)) {
        throw new Error('Unauthorized');
      }
      await Customer.findByIdAndDelete(id);
      await createActivityLog(user, { name: 'Customer', action: 'delete', description: `Customer "${deletedCustomer.name}" (Email: ${deletedCustomer.email}) deleted` });
      return true;
    },
    createInvoice: async (_, { customerId, items }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      if (user.role === 'platform') throw new Error('Platform users must specify a business');
      const customer = await Customer.findById(customerId);
      if (!customer || !user.business._id.equals(customer.business)) {
        throw new Error('Customer does not belong to this business');
      }
      // Validate stock for all products
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product || !user.business._id.equals(productId.business)) {
          throw new Error('Product does not belong to this business');
        }
        if (product.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product "${product.name}" (SKU: ${product.sku})`);
        }
      }
      // Deduct stock
      for (const item of items) {
        await updateProductStock(item.productId, -item.quantity, user, 'update_stock', 'Invoice creation:');
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
      await createActivityLog(user, { name: 'Invoice', action: 'create', description: `Invoice created for customer "${customer.name}" (Total: ${total})` });
      await createActivityLog(user, { name: 'Sale', action: 'create', description: `Sale created for customer "${customer.name}" (Total: ${total})` });
      return invoice.populate('customer').populate('business').populate('items.product');
    },
    updateInvoice: async (_, { id, customerId, items, status }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const oldInvoice = await Invoice.findById(id).populate('items.product');
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
        // Validate stock for new items
        const productQuantities = new Map();
        for (const item of items) {
          const product = await Product.findById(item.productId);
          if (!product || !user.business._id.equals(product.business)) {
            throw new Error('Product does not belong to this business');
          }
          productQuantities.set(item.productId.toString(), (productQuantities.get(item.productId.toString()) || 0) + item.quantity);
        }
        // Calculate stock adjustments
        const oldQuantities = new Map();
        oldInvoice.items.forEach(item => {
          oldQuantities.set(item.product._id.toString(), (oldQuantities.get(item.product._id.toString()) || 0) + item.quantity);
        });
        for (const [productId, newQuantity] of productQuantities) {
          const oldQuantity = oldQuantities.get(productId) || 0;
          const delta = oldQuantity - newQuantity; // Positive: restock, Negative: deduct
          if (delta < 0) {
            const product = await Product.findById(productId);
            if (product.quantity + delta < 0) {
              throw new Error(`Insufficient stock for product "${product.name}" (SKU: ${product.sku})`);
            }
          }
          await updateProductStock(productId, delta, user, 'update_stock', 'Invoice update:');
          oldQuantities.delete(productId);
        }
        // Restock products removed from invoice
        for (const [productId, oldQuantity] of oldQuantities) {
          await updateProductStock(productId, oldQuantity, user, 'update_stock', 'Invoice update (product removed):');
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
      await createActivityLog(user, { name: 'Invoice', action: 'update', description: `Invoice updated. ${description}` });
      if (updateData.total) {
        await Sale.findOneAndUpdate(
          { invoice: id },
          { total: updateData.total },
          { new: true }
        );
        await createActivityLog(user, { name: 'Sale', action: 'update', description: `Sale updated for invoice (Total: ${updateData.total})` });
      }
      return updatedInvoice;
    },
    deleteInvoice: async (_, { id }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const deletedInvoice = await Invoice.findById(id).populate('items.product');
      if (user.role !== 'platform' && !user.business._id.equals(deletedInvoice.business)) {
        throw new Error('Unauthorized');
      }
      // Restock products
      for (const item of deletedInvoice.items) {
        await updateProductStock(item.product._id, item.quantity, user, 'delete_stock', 'Invoice deletion:');
      }
      await Invoice.findByIdAndDelete(id);
      await Sale.deleteOne({ invoice: id });
      await createActivityLog(user, { name: 'Invoice', action: 'delete', description: `Invoice deleted (Total: ${deletedInvoice.total})` });
      await createActivityLog(user, { name: 'Sale', action: 'delete', description: `Sale deleted for invoice (Total: ${deletedInvoice.total})` });
      return true;
    },
    deleteSale: async (_, { id }, { user }) => {
      if (!user || (!user.business && user.role !== 'platform')) throw new Error('Unauthorized');
      const deletedSale = await Sale.findById(id);
      if (user.role !== 'platform' && !user.business._id.equals(deletedSale.business)) {
        throw new Error('Unauthorized');
      }
      await Sale.findByIdAndDelete(id);
      await createActivityLog(user, { name: 'Sale', action: 'delete', description: `Sale deleted (Total: ${deletedSale.total})` });
      return true;
    }
  }
};

module.exports = resolvers;
