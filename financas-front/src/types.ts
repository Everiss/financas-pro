import { Timestamp } from 'firebase/firestore';

export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: Timestamp;
  description?: string;
  accountId?: string;
  paymentMethod?: 'debit' | 'credit';
  isTransfer?: boolean;
  isPending?: boolean;
  installmentRef?: string;
  userId: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  userId: string;
  budget?: number;
}

export interface Reminder {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  accountId?: string;
  dueDate: Timestamp;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  notes?: string;
  userId: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  currency: string;
}

export interface Bank {
  id: string;
  name: string;
  color: string;
  icon: string;
  userId: string;
  accounts?: BankAccount[];
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'credit' | 'loan' | 'financing';
  investmentType?: 'cdb' | 'stock' | 'fund' | 'fii' | 'other' | 'tesouro' | 'previdencia' | 'crypto';
  subtype?: string;
  balance: number;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  color: string;
  icon: string;
  userId: string;
  bankId?: string;
  bank?: Bank;
  currency?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Timestamp | null;
  category: 'Viagem' | 'Casa' | 'Carro' | 'Educação' | 'Reserva de Emergência' | 'Aposentadoria' | 'Outros';
  color?: string;
  icon?: string;
  userId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'userId'>[] = [
  { name: 'Alimentação', icon: 'Utensils', color: '#ef4444' },
  { name: 'Transporte', icon: 'Car', color: '#3b82f6' },
  { name: 'Lazer', icon: 'Gamepad2', color: '#f59e0b' },
  { name: 'Saúde', icon: 'HeartPulse', color: '#10b981' },
  { name: 'Educação', icon: 'GraduationCap', color: '#8b5cf6' },
  { name: 'Moradia', icon: 'Home', color: '#6366f1' },
  { name: 'Serviços', icon: 'Zap', color: '#facc15' },
  { name: 'Salário', icon: 'Wallet', color: '#22c55e' },
  { name: 'Investimentos', icon: 'TrendingUp', color: '#06b6d4' },
  { name: 'Outros', icon: 'MoreHorizontal', color: '#71717a' },
];
