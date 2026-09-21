import { api } from "../lib/axios";

export interface Plan {
	id: string;
	plan_name: string;
	description?: string | null;
	category: string;
	price_paise: number;
	calendar_days: number;
	allocated_days: number;
	features: string[];
	is_active: boolean;
	created_at: string;
}

export async function getPlans() {
	const response = await api.get<{ data: Plan[] }>("/plans");
	return response.data.data ?? [];
}

export interface PlanWritePayload {
	plan_name: string;
	description?: string;
	category: string;
	price_paise: number;
	calendar_days: number;
	allocated_days: number;
	features: string[];
}

/** Owner-only: includes inactive/archived plans. */
export async function getAllPlans() {
	const response = await api.get<{ data: Plan[] }>("/plans/all");
	return response.data.data ?? [];
}

export async function createPlan(payload: PlanWritePayload) {
	const response = await api.post<{ data: Plan }>("/plans", payload);
	return response.data.data;
}

export async function updatePlan(planId: string, payload: Partial<PlanWritePayload>) {
	const response = await api.patch<{ data: Plan }>(`/plans/${planId}`, payload);
	return response.data.data;
}

export async function setPlanActive(planId: string, isActive: boolean) {
	const action = isActive ? "activate" : "deactivate";
	const response = await api.patch<{ data: Plan }>(`/plans/${planId}/${action}`);
	return response.data.data;
}
