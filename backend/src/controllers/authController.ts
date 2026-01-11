import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

export const authController = {
  // Register new user
  register: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('📝 Registration attempt received');
      const { email, password, name } = request.body as {
        email: string;
        password: string;
        name?: string;
      };

      console.log('📧 Registration email:', email);

      // Validate input
      if (!email || !password) {
        console.log('❌ Registration failed: Missing email or password');
        return reply.status(400).send({ error: 'Email and password are required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.log('❌ Registration failed: Invalid email format');
        return reply.status(400).send({ error: 'Invalid email format' });
      }

      // Validate password strength
      if (password.length < 6) {
        console.log('❌ Registration failed: Password too short');
        return reply.status(400).send({ error: 'Password must be at least 6 characters' });
      }

      // Check if user already exists IN MONGODB ONLY (normalize email)
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        console.log('❌ Registration failed: User already exists in MongoDB');
        return reply.status(409).send({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user IN MONGODB ONLY
      const user = await User.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || email.split('@')[0],
      });

      console.log('✅ User created in MongoDB:', user._id);

      // Generate JWT token
      const token = request.server.jwt.sign({
        userId: user._id.toString(),
        email: user.email,
      });

      console.log('✅ Registration successful for:', email);

      reply.send({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error('❌ Registration error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Login user
  login: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('🔐 Login attempt received');
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      console.log('📧 Login email:', email);

      // Validate input
      if (!email || !password) {
        console.log('❌ Login failed: Missing email or password');
        return reply.status(400).send({ error: 'Email and password are required' });
      }

      // Find user IN MONGODB ONLY (normalize email to lowercase)
      console.log('🔍 Searching for user in MongoDB (NOT ChromaDB)...');
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        console.log('❌ Login failed: User not found in MongoDB');
        const userCount = await User.countDocuments();
        console.log(`💡 Total users in MongoDB: ${userCount}`);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      console.log('✅ User found in MongoDB:', user.email, 'ID:', user._id);

      // Verify password (bcrypt compare)
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        console.log('❌ Login failed: Invalid password');
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      console.log('✅ Password verified');

      // Generate JWT token with userId as string
      const token = request.server.jwt.sign({
        userId: user._id.toString(),
        email: user.email,
      });

      console.log('✅ Login successful for:', email);

      reply.send({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error('❌ Login error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Get current user
  me: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('👤 Get current user request');
      const decoded = await request.jwtVerify() as { userId: string };
      console.log('🔑 JWT decoded, userId:', decoded.userId);
      
      // Find user IN MONGODB ONLY
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        console.log('❌ User not found in MongoDB for ID:', decoded.userId);
        return reply.status(404).send({ error: 'User not found' });
      }

      console.log('✅ User found in MongoDB:', user.email);

      reply.send({
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error('❌ Get user error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },
};
