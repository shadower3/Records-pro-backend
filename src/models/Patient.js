import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const patientsFilePath = path.join(__dirname, '../../data/patients.json');

// Ensure data directory exists
const dataDir = path.dirname(patientsFilePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize patients file if it doesn't exist
if (!fs.existsSync(patientsFilePath)) {
  fs.writeFileSync(patientsFilePath, JSON.stringify([], null, 2));
}

class Patient {
  constructor(data) {
    this._id = data._id || Date.now().toString();
    this.firstName = data.firstName?.trim();
    this.lastName = data.lastName?.trim();
    this.dob = data.dob ? new Date(data.dob) : null;
    this.sex = data.sex;
    this.phone = data.phone?.trim();
    this.email = data.email?.trim()?.toLowerCase();
    this.address = data.address?.trim();
    this.emergencyContact = data.emergencyContact || { name: '', phone: '', relationship: '' };
    this.medicalHistory = data.medicalHistory || [];
    this.allergies = data.allergies || [];
    this.medications = data.medications || [];
    this.vitals = data.vitals || [];
    this.insurance = data.insurance || { provider: '', policyNumber: '', groupNumber: '' };
    this.status = data.status || 'Active';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static getPatients() {
    try {
      const data = fs.readFileSync(patientsFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  static savePatients(patients) {
    fs.writeFileSync(patientsFilePath, JSON.stringify(patients, null, 2));
  }

  static async find(query = {}) {
    const patients = this.getPatients();
    let filtered = patients;

    if (query.$or) {
      // Handle search queries
      const searchTerms = query.$or;
      filtered = patients.filter(patient => {
        return searchTerms.some(term => {
          const field = Object.keys(term)[0];
          const searchValue = term[field].$regex;
          const patientValue = patient[field]?.toLowerCase() || '';
          return patientValue.includes(searchValue.toLowerCase());
        });
      });
    }

    return filtered.map(p => new Patient(p));
  }

  static async findById(id) {
    const patients = this.getPatients();
    const patient = patients.find(p => p._id === id);
    return patient ? new Patient(patient) : null;
  }

  static async countDocuments(query = {}) {
    if (query.createdAt && query.createdAt.$gte) {
      const patients = this.getPatients();
      const filtered = patients.filter(p => new Date(p.createdAt) >= query.createdAt.$gte);
      return filtered.length;
    }
    return this.getPatients().length;
  }

  static async aggregate(pipeline) {
    const patients = this.getPatients();

    // Simple aggregation for gender stats
    if (pipeline.some(stage => stage.$group && stage.$group._id === '$sex')) {
      const genderCounts = {};
      patients.forEach(p => {
        genderCounts[p.sex] = (genderCounts[p.sex] || 0) + 1;
      });
      return Object.entries(genderCounts).map(([sex, count]) => ({ _id: sex, count }));
    }

    // Age distribution aggregation
    if (pipeline.some(stage => stage.$addFields && stage.$addFields.age)) {
      const ageCounts = { '0-17': 0, '18-29': 0, '30-49': 0, '50-69': 0, '70+': 0 };
      patients.forEach(p => {
        if (p.dob) {
          const age = Math.floor((new Date() - new Date(p.dob)) / (365.25 * 24 * 60 * 60 * 1000));
          if (age < 18) ageCounts['0-17']++;
          else if (age < 30) ageCounts['18-29']++;
          else if (age < 50) ageCounts['30-49']++;
          else if (age < 70) ageCounts['50-69']++;
          else ageCounts['70+']++;
        }
      });
      return Object.entries(ageCounts).map(([range, count]) => ({ _id: range, count }));
    }

    // Monthly trends aggregation
    if (pipeline.some(stage => stage.$group && stage.$group._id && stage.$group._id.month)) {
      const monthlyCounts = {};
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      patients.forEach(p => {
        const createdDate = new Date(p.createdAt);
        if (createdDate >= twelveMonthsAgo) {
          const key = `${createdDate.getFullYear()}-${createdDate.getMonth() + 1}`;
          monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
        }
      });

      return Object.entries(monthlyCounts).map(([key, count]) => {
        const [year, month] = key.split('-');
        return { _id: { year: parseInt(year), month: parseInt(month) }, count };
      });
    }

    return [];
  }

  async save() {
    const patients = Patient.getPatients();
    const existingIndex = patients.findIndex(p => p._id === this._id);

    this.updatedAt = new Date().toISOString();

    if (existingIndex >= 0) {
      patients[existingIndex] = this;
    } else {
      patients.push(this);
    }

    Patient.savePatients(patients);
    return this;
  }

  static async create(patientData) {
    const patient = new Patient(patientData);
    return await patient.save();
  }

  static async findByIdAndUpdate(id, updateData) {
    const patients = Patient.getPatients();
    const index = patients.findIndex(p => p._id === id);

    if (index >= 0) {
      const updatedPatient = new Patient({ ...patients[index], ...updateData, _id: id });
      patients[index] = updatedPatient;
      Patient.savePatients(patients);
      return updatedPatient;
    }
    return null;
  }

  static async findByIdAndDelete(id) {
    const patients = Patient.getPatients();
    const index = patients.findIndex(p => p._id === id);

    if (index >= 0) {
      const deletedPatient = patients[index];
      patients.splice(index, 1);
      Patient.savePatients(patients);
      return new Patient(deletedPatient);
    }
    return null;
  }
}

export default Patient;
