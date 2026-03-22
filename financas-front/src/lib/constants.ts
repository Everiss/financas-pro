import { IconName } from '../components/Icons';
import { BankAccount } from '../types';

export const BANK_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#6366f1'];
export const BANK_ICONS: IconName[] = ['Landmark','Building2','Wallet','CreditCard','PiggyBank','Banknote','TrendingUp','Briefcase'];

export const EMPTY_ACC = {
  name: '', type: 'checking' as BankAccount['type'],
  investmentType: 'cdb' as BankAccount['investmentType'],
  subtype: '' as string,
  balance: '', creditLimit: '', closingDay: '', dueDay: '',
  color: '#3b82f6', icon: 'CreditCard',
};

/** Types that represent a debt (balance shown as negative / red) */
export const DEBT_TYPES: BankAccount['type'][] = ['loan', 'financing'];

export const SUBTYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  checking: [
    { value: 'digital',     label: 'Conta Digital (Nubank, Inter, C6...)' },
    { value: 'traditional', label: 'Conta Corrente Tradicional' },
    { value: 'salary',      label: 'Conta Salário' },
    { value: 'joint',       label: 'Conta Conjunta' },
  ],
  savings: [
    { value: 'regular',         label: 'Poupança Comum' },
    { value: 'emergency_fund',  label: 'Reserva de Emergência' },
    { value: 'daily_liquidity', label: 'CDB Liquidez Diária' },
  ],
  credit: [
    { value: 'personal',      label: 'Pessoal' },
    { value: 'business',      label: 'Empresarial' },
    { value: 'international', label: 'Internacional' },
  ],
  loan: [
    { value: 'personal_loan',  label: 'Empréstimo Pessoal' },
    { value: 'pre_approved',   label: 'Crédito Pré-Aprovado' },
    { value: 'consignado',     label: 'Crédito Consignado' },
    { value: 'fgts',           label: 'Empréstimo FGTS' },
    { value: 'payroll_advance',label: 'Antecipação de Salário' },
  ],
  financing: [
    { value: 'vehicle',        label: 'Financiamento de Veículo' },
    { value: 'real_estate',    label: 'Financiamento Imobiliário' },
    { value: 'other_financing',label: 'Outro Financiamento' },
  ],
};

export const SUBTYPE_LABELS: Record<string, string> = {
  digital:           'Conta Digital',
  traditional:       'Conta Corrente',
  salary:            'Conta Salário',
  joint:             'Conta Conjunta',
  regular:           'Poupança Comum',
  emergency_fund:    'Reserva de Emergência',
  daily_liquidity:   'CDB Liquidez Diária',
  personal:          'Pessoal',
  business:          'Empresarial',
  international:     'Internacional',
  personal_loan:     'Empréstimo Pessoal',
  pre_approved:      'Crédito Pré-Aprovado',
  consignado:        'Consignado',
  fgts:              'Empréstimo FGTS',
  payroll_advance:   'Antecipação Salário',
  vehicle:           'Veículo',
  real_estate:       'Imóvel',
  other_financing:   'Outro Financiamento',
};

export function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}
