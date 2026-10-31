/**
 * Staff accounts. Passwords are bcrypt hashes (never selected by default).
 * `hourlyRatePaise` prices technician time for job costing and payroll.
 */
import { Schema, model, models, type Model, type Types } from "mongoose";
import { ROLES, type Role } from "@/lib/constants";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  role: Role;
  passwordHash: string;
  hourlyRatePaise: number;
  /** e.g. ["survey", "installation", "service"] for technicians */
  skills: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    hourlyRatePaise: { type: Number, default: 0, min: 0 },
    skills: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const User: Model<IUser> = (models.User as Model<IUser>) ?? model<IUser>("User", UserSchema);
