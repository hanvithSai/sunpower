/**
 * SunPower staff accounts: the Director, sales, warehouse, support and the
 * 15-person technician crew from the brief. Every account shares the demo
 * password so judges can sign in as any role. Hourly rates price technician
 * time for job costing and payroll.
 */
import type { Role } from "@/lib/constants";

export const DEMO_PASSWORD = "SunPower@2026";

export type StaffSeed = {
  name: string;
  email: string;
  phone: string;
  role: Role;
  hourlyRateRs: number;
  skills: string[];
};

export const STAFF: StaffSeed[] = [
  { name: "Rajesh Reddy", email: "director@sunpower.demo", phone: "9848012345", role: "admin", hourlyRateRs: 0, skills: [] },
  { name: "Priya Sharma", email: "sales@sunpower.demo", phone: "9876543210", role: "sales", hourlyRateRs: 0, skills: [] },
  { name: "Karthik Rao", email: "karthik@sunpower.demo", phone: "9908765432", role: "sales", hourlyRateRs: 0, skills: [] },
  { name: "Suresh Yadav", email: "warehouse@sunpower.demo", phone: "9849098490", role: "warehouse", hourlyRateRs: 0, skills: [] },
  { name: "Anjali Rao", email: "support@sunpower.demo", phone: "9704123456", role: "support", hourlyRateRs: 0, skills: [] },

  // Technician crew (15)
  { name: "Ravi Kumar", email: "tech@sunpower.demo", phone: "9885012345", role: "technician", hourlyRateRs: 420, skills: ["survey", "installation", "service"] },
  { name: "Srinivas Goud", email: "srinivas@sunpower.demo", phone: "9866123456", role: "technician", hourlyRateRs: 380, skills: ["installation", "service"] },
  { name: "Mahesh Naik", email: "mahesh@sunpower.demo", phone: "9959234567", role: "technician", hourlyRateRs: 350, skills: ["installation"] },
  { name: "Venkatesh Yadav", email: "venkatesh@sunpower.demo", phone: "9010345678", role: "technician", hourlyRateRs: 360, skills: ["survey", "installation"] },
  { name: "Abdul Rahman", email: "abdul@sunpower.demo", phone: "9177456789", role: "technician", hourlyRateRs: 400, skills: ["service", "installation"] },
  { name: "Praveen Chary", email: "praveen@sunpower.demo", phone: "9640567890", role: "technician", hourlyRateRs: 300, skills: ["installation"] },
  { name: "Naresh Babu", email: "naresh@sunpower.demo", phone: "9391678901", role: "technician", hourlyRateRs: 320, skills: ["survey", "service"] },
  { name: "Sai Teja", email: "saiteja@sunpower.demo", phone: "8790789012", role: "technician", hourlyRateRs: 260, skills: ["installation"] },
  { name: "Ramesh Varma", email: "ramesh@sunpower.demo", phone: "8885890123", role: "technician", hourlyRateRs: 310, skills: ["installation", "service"] },
  { name: "Arjun Reddy", email: "arjun@sunpower.demo", phone: "7799901234", role: "technician", hourlyRateRs: 340, skills: ["survey", "installation"] },
  { name: "Imran Khan", email: "imran@sunpower.demo", phone: "7702012345", role: "technician", hourlyRateRs: 380, skills: ["service"] },
  { name: "Kiran Kumar", email: "kiran@sunpower.demo", phone: "8341123456", role: "technician", hourlyRateRs: 280, skills: ["installation"] },
  { name: "Murali Krishna", email: "murali@sunpower.demo", phone: "9441234567", role: "technician", hourlyRateRs: 450, skills: ["survey", "installation", "service"] },
  { name: "Santosh Patil", email: "santosh@sunpower.demo", phone: "9550345678", role: "technician", hourlyRateRs: 300, skills: ["installation", "service"] },
  { name: "Vijay Bhaskar", email: "vijay@sunpower.demo", phone: "6301456789", role: "technician", hourlyRateRs: 250, skills: ["installation"] },
];
