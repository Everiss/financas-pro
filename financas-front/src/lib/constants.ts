import { IconName } from '../components/Icons';
import { BankAccount } from '../types';

export const BANK_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#6366f1'];
export const BANK_ICONS: IconName[] = ['Landmark','Building2','Wallet','CreditCard','PiggyBank','Banknote','TrendingUp','Briefcase'];

export const EMPTY_ACC = {
  name: '', type: 'checking' as BankAccount['type'],
  investmentType: 'cdb' as BankAccount['investmentType'],
  balance: '', creditLimit: '', closingDay: '', dueDay: '',
  color: '#3b82f6', icon: 'CreditCard',
};

export function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}
