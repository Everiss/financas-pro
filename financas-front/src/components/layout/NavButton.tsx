import React from 'react';
import { cn } from '../../lib/utils';
import { Icons, IconName } from '../Icons';

export function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: IconName; label: string }) {
  const Icon = Icons[icon];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col md:flex-row items-center gap-1 md:gap-3 px-4 py-2 md:py-3.5 rounded-2xl transition-all duration-300',
        active ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-blue-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-slate-200'
      )}
    >
      <Icon className={cn("w-5 h-5 transition-transform duration-300", active ? "text-white scale-110" : "text-blue-300")} />
      <span className="text-[10px] md:text-sm font-semibold">{label}</span>
    </button>
  );
}
