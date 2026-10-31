/**
 * CRM: customers, leads (enquiries) and site surveys.
 *
 * Every enquiry creates/links a Customer (deduplicated by phone) so the whole
 * history — quotes, orders, serials, tickets — hangs off one customer record.
 * The lead carries the pre-sales state machine (LEAD_FLOW in src/lib/workflows).
 */
import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  CUSTOMER_TYPES,
  DISCOMS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  REQUESTED_SYSTEM_TYPES,
  ROOF_DIRECTIONS,
  ROOF_TYPES,
  SURVEY_STATUSES,
  SYSTEM_TYPES,
  type CustomerType,
  type Discom,
  type LeadSource,
  type LeadStatus,
  type RequestedSystemType,
  type RoofDirection,
  type RoofType,
  type SurveyStatus,
  type SystemType,
} from "@/lib/constants";
import { AddressSchema, type IAddress } from "./shared";

/* ------------------------------- Customer ------------------------------- */

export interface ICustomer {
  _id: Types.ObjectId;
  name: string;
  /** 10-digit Indian mobile, unique — the key support searches by. */
  phone: string;
  email?: string;
  type: CustomerType;
  address: IAddress;
  discom?: Discom;
  /** Electricity service connection number (needed for net metering + subsidy). */
  consumerNumber?: string;
  gstin?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, match: /^[6-9]\d{9}$/ },
    email: { type: String, lowercase: true, trim: true },
    type: { type: String, enum: CUSTOMER_TYPES, default: "residential" },
    address: { type: AddressSchema, required: true },
    discom: { type: String, enum: DISCOMS },
    consumerNumber: { type: String, trim: true },
    gstin: { type: String, uppercase: true, trim: true },
    notes: { type: String },
  },
  { timestamps: true },
);
CustomerSchema.index({ name: 1 });

export const Customer: Model<ICustomer> =
  (models.Customer as Model<ICustomer>) ?? model<ICustomer>("Customer", CustomerSchema);

/* --------------------------------- Lead --------------------------------- */

export interface ILeadRequirement {
  capacityKw: number;
  systemType: RequestedSystemType;
  wantsSubsidy: boolean;
  monthlyBillRs?: number;
  message?: string;
}

export interface ILeadQualification {
  roofAreaSqft: number;
  shadowFreeAreaSqft: number;
  monthlyBillRs: number;
  sanctionedLoadKw?: number;
  gridSuitable: boolean;
  roofType: RoofType;
  notes?: string;
  qualifiedAt: Date;
  qualifiedBy: Types.ObjectId;
}

export interface ILead {
  _id: Types.ObjectId;
  /** Human-readable number, e.g. SP-L-0042 */
  number: string;
  customerId: Types.ObjectId;
  // Denormalised for fast list/search rendering:
  name: string;
  phone: string;
  email?: string;
  city: string;
  source: LeadSource;
  requirement: ILeadRequirement;
  qualification?: ILeadQualification;
  status: LeadStatus;
  lostReason?: string;
  assignedTo?: Types.ObjectId;
  /** Set on first status change away from "new" — powers the response-time SLA. */
  firstContactedAt?: Date;
  lastActivityAt: Date;
  surveyId?: Types.ObjectId;
  quoteId?: Types.ObjectId;
  orderId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    number: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    city: { type: String, required: true, trim: true },
    source: { type: String, enum: LEAD_SOURCES, required: true },
    requirement: {
      capacityKw: { type: Number, required: true, min: 1, max: 10 },
      systemType: { type: String, enum: REQUESTED_SYSTEM_TYPES, required: true },
      wantsSubsidy: { type: Boolean, default: true },
      monthlyBillRs: { type: Number, min: 0 },
      message: { type: String },
    },
    qualification: {
      type: new Schema<ILeadQualification>(
        {
          roofAreaSqft: { type: Number, required: true, min: 0 },
          shadowFreeAreaSqft: { type: Number, required: true, min: 0 },
          monthlyBillRs: { type: Number, required: true, min: 0 },
          sanctionedLoadKw: { type: Number, min: 0 },
          gridSuitable: { type: Boolean, required: true },
          roofType: { type: String, enum: ROOF_TYPES, required: true },
          notes: { type: String },
          qualifiedAt: { type: Date, required: true },
          qualifiedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        },
        { _id: false },
      ),
      required: false,
    },
    status: { type: String, enum: LEAD_STATUSES, default: "new", index: true },
    lostReason: { type: String },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    firstContactedAt: { type: Date },
    lastActivityAt: { type: Date, default: () => new Date() },
    surveyId: { type: Schema.Types.ObjectId, ref: "Survey" },
    quoteId: { type: Schema.Types.ObjectId, ref: "Quote" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true },
);
LeadSchema.index({ status: 1, createdAt: -1 });

export const Lead: Model<ILead> = (models.Lead as Model<ILead>) ?? model<ILead>("Lead", LeadSchema);

/* -------------------------------- Survey -------------------------------- */

export interface ISurveyMeasurements {
  roofDirection: RoofDirection;
  tiltDeg: number;
  roofType: RoofType;
  usableAreaSqft: number;
  shadingPct: number;
  cableDistanceM: number;
  floors: number;
  earthingPossible: boolean;
  recommendedKw: number;
  recommendedSystemType: SystemType;
}

export interface ISurvey {
  _id: Types.ObjectId;
  number: string;
  leadId: Types.ObjectId;
  customerId: Types.ObjectId;
  technicianId: Types.ObjectId;
  scheduledFor: Date;
  status: SurveyStatus;
  measurements?: ISurveyMeasurements;
  /** GridFS file ids (photos / short videos of the roof). */
  photos: string[];
  notes?: string;
  completedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SurveySchema = new Schema<ISurvey>(
  {
    number: { type: String, required: true, unique: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    technicianId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    scheduledFor: { type: Date, required: true },
    status: { type: String, enum: SURVEY_STATUSES, default: "scheduled", index: true },
    measurements: {
      type: new Schema<ISurveyMeasurements>(
        {
          roofDirection: { type: String, enum: ROOF_DIRECTIONS, required: true },
          tiltDeg: { type: Number, required: true, min: 0, max: 60 },
          roofType: { type: String, enum: ROOF_TYPES, required: true },
          usableAreaSqft: { type: Number, required: true, min: 0 },
          shadingPct: { type: Number, required: true, min: 0, max: 100 },
          cableDistanceM: { type: Number, required: true, min: 0 },
          floors: { type: Number, required: true, min: 0, max: 50 },
          earthingPossible: { type: Boolean, required: true },
          recommendedKw: { type: Number, required: true, min: 1, max: 10 },
          recommendedSystemType: { type: String, enum: SYSTEM_TYPES, required: true },
        },
        { _id: false },
      ),
      required: false,
    },
    photos: { type: [String], default: [] },
    notes: { type: String },
    completedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String },
  },
  { timestamps: true },
);
SurveySchema.index({ technicianId: 1, scheduledFor: 1 });

export const Survey: Model<ISurvey> = (models.Survey as Model<ISurvey>) ?? model<ISurvey>("Survey", SurveySchema);
