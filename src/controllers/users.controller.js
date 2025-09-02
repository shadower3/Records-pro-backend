import User from '../models/User.js';

export async function list(req, res) {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getById(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function update(req, res) {
  try {
    const { name, email, role } = req.body;
    const users = User.getUsers();
    const index = users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    users[index] = {
      ...users[index],
      name,
      email: email?.toLowerCase(),
      role,
      updatedAt: new Date().toISOString()
    };

    User.saveUsers(users);
    res.json(new User(users[index]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteUser(req, res) {
  try {
    const users = User.getUsers();
    const index = users.findIndex(u => u.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedUser = users[index];
    users.splice(index, 1);
    User.saveUsers(users);

    res.json({ message: 'User deleted successfully', user: deletedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateProfile(req, res) {
  try {
    const { name, email, phone, department } = req.body;
    const users = User.getUsers();
    const index = users.findIndex(u => u.id === req.user.sub);

    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    users[index] = {
      ...users[index],
      name,
      email: email?.toLowerCase(),
      phone,
      department,
      updatedAt: new Date().toISOString()
    };

    User.saveUsers(users);
    const updatedUser = new User(users[index]);

    // Return user without password hash
    const { passwordHash, ...userResponse } = updatedUser;
    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateSettings(req, res) {
  try {
    const { settings } = req.body;
    const users = User.getUsers();
    const index = users.findIndex(u => u.id === req.user.sub);

    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    users[index] = {
      ...users[index],
      settings: {
        ...users[index].settings,
        ...settings
      },
      updatedAt: new Date().toISOString()
    };

    User.saveUsers(users);
    res.json({ message: 'Settings updated successfully', settings: users[index].settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCurrentUser(req, res) {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user without password hash
    const { passwordHash, ...userResponse } = user;
    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
