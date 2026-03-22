import {
  TransactionResponse,
  CategoryResponse,
  AccountResponse,
  BankResponse,
  GoalResponse,
  ReminderResponse,
} from '../services/api';
import { Transaction, Category, BankAccount, Bank, Goal, Reminder } from '../types';

export function fakeTimestamp(dateStr: string | null | undefined) {
  return {
    toDate: () => (dateStr ? new Date(dateStr) : new Date()),
    seconds: dateStr ? Math.floor(new Date(dateStr).getTime() / 1000) : 0,
  };
}

export function toTransaction(r: TransactionResponse): Transaction {
  return {
    id: r.id,
    amount: Number(r.amount),
    type: r.type,
    category: r.categoryId || (r.category as any)?.id || '',
    date: fakeTimestamp(r.date) as any,
    description: r.description,
    accountId: r.accountId,
    paymentMethod: r.paymentMethod,
    isTransfer: r.isTransfer ?? false,
    userId: r.userId,
  };
}

export function toCategory(r: CategoryResponse): Category {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    budget: r.budget != null ? Number(r.budget) : undefined,
    userId: r.userId || '',
  };
}

export function toBank(r: BankResponse): Bank {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    userId: r.userId,
  };
}

export function toAccount(r: AccountResponse): BankAccount {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    investmentType: r.investmentType,
    balance: Number(r.balance),
    creditLimit: r.creditLimit != null ? Number(r.creditLimit) : undefined,
    closingDay: r.closingDay,
    dueDay: r.dueDay,
    color: r.color,
    icon: r.icon,
    userId: r.userId,
    bankId: r.bankId,
  };
}

export function toGoal(r: GoalResponse): Goal {
  return {
    id: r.id,
    name: r.name,
    targetAmount: Number(r.targetAmount),
    currentAmount: Number(r.currentAmount),
    deadline: r.deadline ? (fakeTimestamp(r.deadline) as any) : null,
    category: r.category as Goal['category'],
    color: r.color,
    icon: r.icon,
    userId: r.userId,
  };
}

export function toReminder(r: ReminderResponse): Reminder {
  return {
    id: r.id,
    title: r.title,
    amount: Number(r.amount),
    type: r.type,
    category: r.categoryId || (r.category as any)?.id || '',
    accountId: r.accountId,
    dueDate: fakeTimestamp(r.dueDate) as any,
    frequency: r.frequency,
    notes: r.notes,
    userId: r.userId,
  };
}
