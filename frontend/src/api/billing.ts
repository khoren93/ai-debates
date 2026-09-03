import { api } from './client';
import type { BillingConfig, CheckoutResponse, ConfirmResponse, Transaction, Usage } from './types';

export const getBillingConfig = () => api.get<BillingConfig>('/billing/config').then((r) => r.data);

export const createCheckout = (amountUsd: number) =>
  api.post<CheckoutResponse>('/billing/checkout', { amount_usd: amountUsd }).then((r) => r.data);

export const confirmCheckout = (sessionId: string) =>
  api.get<ConfirmResponse>('/billing/confirm', { params: { session_id: sessionId } }).then((r) => r.data);

export const listTransactions = (limit = 50) =>
  api.get<Transaction[]>('/billing/transactions', { params: { limit } }).then((r) => r.data);

export const getUsage = () => api.get<Usage>('/billing/usage').then((r) => r.data);
