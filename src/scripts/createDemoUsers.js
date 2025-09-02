import bcrypt from 'bcryptjs';
import User from '../models/User.js';

async function createDemoUsers() {
  console.log('Creating demo users...');

  const demoUsers = [
    {
      name: 'Admin User',
      email: 'admin@hospital.com',
      password: 'admin123',
      role: 'admin'
    },
    {
      name: 'Dr. Smith',
      email: 'doctor@hospital.com',
      password: 'doctor123',
      role: 'doctor'
    },
    {
      name: 'Nurse Johnson',
      email: 'nurse@hospital.com',
      password: 'nurse123',
      role: 'nurse'
    }
  ];

  for (const userData of demoUsers) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(userData.password, salt);

      // Create user
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        passwordHash,
        role: userData.role
      });

      console.log(`Created user: ${user.email} (${user.role})`);
    } catch (error) {
      console.error(`Error creating user ${userData.email}:`, error.message);
    }
  }

  console.log('Demo users creation completed!');
  console.log('\nDemo Accounts:');
  console.log('Admin: admin@hospital.com / admin123');
  console.log('Doctor: doctor@hospital.com / doctor123');
  console.log('Nurse: nurse@hospital.com / nurse123');
}

createDemoUsers().catch(console.error);
