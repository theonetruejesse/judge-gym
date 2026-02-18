import {
    internalAction,
    internalMutation,
    internalQuery,
    mutation,
    query,
    action,
} from "../_generated/server";
import {
    zCustomAction,
    zCustomMutation,
    zCustomQuery,
} from "convex-helpers/server/zod4";
import { NoOp } from "convex-helpers/server/customFunctions";

export const zMutation = zCustomMutation(mutation, NoOp);
export const zQuery = zCustomQuery(query, NoOp);
export const zAction = zCustomAction(action, NoOp);
export const zInternalMutation = zCustomMutation(internalMutation, NoOp);
export const zInternalQuery = zCustomQuery(internalQuery, NoOp);
export const zInternalAction = zCustomAction(internalAction, NoOp);
