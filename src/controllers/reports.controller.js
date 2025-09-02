import Patient from '../models/Patient.js';
import User from '../models/User.js';

export async function getDashboardStats(req, res) {
  try {
    const totalPatients = await Patient.countDocuments();
    const totalUsers = await User.countDocuments();
    
    // Patients registered in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentPatients = await Patient.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Gender distribution
    const genderStats = await Patient.aggregate([
      {
        $group: {
          _id: '$sex',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Age distribution
    const ageStats = await Patient.aggregate([
      {
        $addFields: {
          age: {
            $floor: {
              $divide: [
                { $subtract: [new Date(), '$dob'] },
                365.25 * 24 * 60 * 60 * 1000
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ['$age', 18] }, then: '0-17' },
                { case: { $lt: ['$age', 30] }, then: '18-29' },
                { case: { $lt: ['$age', 50] }, then: '30-49' },
                { case: { $lt: ['$age', 70] }, then: '50-69' },
              ],
              default: '70+'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Monthly registration trends (last 12 months)
    const monthlyStats = await Patient.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    res.json({
      totalPatients,
      totalUsers,
      recentPatients,
      genderDistribution: genderStats,
      ageDistribution: ageStats,
      monthlyTrends: monthlyStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPatientReport(req, res) {
  try {
    const { startDate, endDate, gender, ageGroup } = req.query;

    // Get all patients first
    let patients = await Patient.find();

    // Apply filters manually
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      patients = patients.filter(p => {
        const createdAt = new Date(p.createdAt);
        return createdAt >= start && createdAt <= end;
      });
    }

    if (gender) {
      patients = patients.filter(p => p.sex === gender);
    }

    // Sort by createdAt (newest first)
    patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate statistics for the filtered data
    const stats = {
      total: patients.length,
      genderBreakdown: {},
      averageAge: 0
    };

    let totalAge = 0;
    patients.forEach(patient => {
      // Gender breakdown
      stats.genderBreakdown[patient.sex] = (stats.genderBreakdown[patient.sex] || 0) + 1;

      // Age calculation
      if (patient.dob) {
        const age = Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000));
        totalAge += age;
      }
    });

    stats.averageAge = patients.length > 0 ? Math.round(totalAge / patients.length) : 0;

    // Return only relevant fields for the report
    const reportPatients = patients.map(p => ({
      firstName: p.firstName,
      lastName: p.lastName,
      dob: p.dob,
      sex: p.sex,
      phone: p.phone,
      address: p.address,
      createdAt: p.createdAt
    }));

    res.json({
      patients: reportPatients,
      statistics: stats,
      filters: { startDate, endDate, gender, ageGroup }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getUserActivityReport(req, res) {
  try {
    // Get all users
    const users = await User.find();

    // Calculate role distribution manually
    const roleDistribution = {};
    users.forEach(user => {
      roleDistribution[user.role] = (roleDistribution[user.role] || 0) + 1;
    });

    // Convert to the expected format
    const userStats = Object.entries(roleDistribution).map(([role, count]) => ({
      _id: role,
      count
    }));

    // Get recent users (last 10, sorted by creation date)
    const sortedUsers = users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentUsers = sortedUsers.slice(0, 10).map(user => ({
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }));

    res.json({
      roleDistribution: userStats,
      recentUsers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function exportPatientData(req, res) {
  try {
    const { format = 'json' } = req.query;

    // Get all patients and sort manually
    let patients = await Patient.find();
    patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'First Name,Last Name,Date of Birth,Gender,Phone,Address,Allergies,Created At\n';
      const csvData = patients.map(p => {
        const dob = p.dob ? new Date(p.dob).toISOString().split('T')[0] : '';
        const allergies = Array.isArray(p.allergies) ? p.allergies.join('; ') : '';
        const createdAt = new Date(p.createdAt).toISOString().split('T')[0];

        return `"${p.firstName || ''}","${p.lastName || ''}","${dob}","${p.sex || ''}","${p.phone || ''}","${p.address || ''}","${allergies}","${createdAt}"`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=patients.csv');
      res.send(csvHeader + csvData);
    } else {
      // For JSON export, only include relevant fields
      const exportData = patients.map(p => ({
        firstName: p.firstName,
        lastName: p.lastName,
        dob: p.dob,
        sex: p.sex,
        phone: p.phone,
        address: p.address,
        allergies: p.allergies,
        createdAt: p.createdAt
      }));
      res.json(exportData);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
