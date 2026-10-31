/**
 * Convert the signed-in user into the `{ id, name }` reference stored on
 * records (createdBy, recordedBy, ...). Names are denormalised on purpose so
 * timelines and printed documents never need a join.
 */
import { Types } from "mongoose";
import type { IActorRef } from "../models/shared";

export type Actor = { id: string; name: string };

export function actorRef(actor: Actor): IActorRef {
  return { id: new Types.ObjectId(actor.id), name: actor.name };
}

export function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

export function isObjectId(id: unknown): id is string {
  return typeof id === "string" && Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id);
}
