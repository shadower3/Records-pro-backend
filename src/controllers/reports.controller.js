import Patient from '../models/Patient.js';
import User from '../models/User.js';

export async function getDashboardStats(req, res) {
  try {
    // Get all patients first for calculations
    const allPatients = await Patient.find();

    const totalPatients = await Patient.countDocuments();
    const totalUsers = await User.countDocuments();

    // Patients registered in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentPatients = allPatients.filter(patient =>
      new Date(patient.createdAt) >= thirtyDaysAgo
    ).length;

    // Gender distribution - using file-based approach
    const genderCount = {};
    allPatients.forEach(patient => {
      // Check both nested and root level sex fields
      let sex = patient.patientDetails?.sex || patient.sex;

      // Normalize the values
      if (sex === 'M' || sex === 'Male') {
        sex = 'M';
      } else if (sex === 'F' || sex === 'Female') {
        sex = 'F';
      } else {
        sex = 'Other';
      }

      genderCount[sex] = (genderCount[sex] || 0) + 1;
    });

    const genderStats = Object.entries(genderCount)
      .filter(([sex, count]) => count > 0)
      .map(([sex, count]) => ({
        _id: sex,
        count
      }));

    console.log('Gender distribution data:', genderStats);

    // Age distribution - using file-based approach
    const ageGroups = { '0-17': 0, '18-29': 0, '30-49': 0, '50-69': 0, '70+': 0 };
    allPatients.forEach(patient => {
      const dob = patient.patientDetails?.dob || patient.dob;
      if (dob) {
        const age = Math.floor((new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) ageGroups['0-17']++;
        else if (age < 30) ageGroups['18-29']++;
        else if (age < 50) ageGroups['30-49']++;
        else if (age < 70) ageGroups['50-69']++;
        else ageGroups['70+']++;
      }
    });
    const ageStats = Object.entries(ageGroups)
      .filter(([group, count]) => count > 0)
      .map(([group, count]) => ({
        _id: group,
        count
      }))
      .sort((a, b) => a._id.localeCompare(b._id));

    // Monthly registration trends - using file-based approach
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyCount = {};
    allPatients
      .filter(patient => new Date(patient.createdAt) >= twelveMonthsAgo)
      .forEach(patient => {
        const date = new Date(patient.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyCount[key] = (monthlyCount[key] || 0) + 1;
      });

    const monthlyStats = Object.entries(monthlyCount)
      .map(([key, count]) => {
        const [year, month] = key.split('-');
        return {
          _id: { year: parseInt(year), month: parseInt(month) },
          count
        };
      })
      .sort((a, b) => {
        if (a._id.year !== b._id.year) return a._id.year - b._id.year;
        return a._id.month - b._id.month;
      });
    
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
      const csvHeader = 'First Name,Last Name,Date of Birth,Gender,Phone,Address,Allergies,Medical History,Created At\n';
      const csvData = patients.map(p => {
        const dob = p.dob ? new Date(p.dob).toISOString().split('T')[0] : '';
        const allergies = Array.isArray(p.allergies) ? p.allergies.join('; ') : '';
        const medicalHistory = Array.isArray(p.medicalHistory) 
          ? p.medicalHistory.map(h => `${h.date}: ${h.description}`).join('; ') 
          : '';
        const createdAt = new Date(p.createdAt).toISOString().split('T')[0];

        return `"${p.firstName || ''}","${p.lastName || ''}","${dob}","${p.sex || ''}","${p.phone || ''}","${p.address || ''}","${allergies}","${medicalHistory}","${createdAt}"`;
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
        medicalHistory: p.medicalHistory,
        createdAt: p.createdAt
      }));
      res.json(exportData);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
