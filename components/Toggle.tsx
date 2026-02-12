import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors cursor-pointer" onClick={() => onChange(!checked)}>
      <div className="flex-1 mr-4">
        {label && <div className="text-sm font-medium text-white">{label}</div>}
        {description && <div className="text-xs text-slate-400 mt-1">{description}</div>}
      </div>
      <div className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          className="sr-only peer" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className={`w-11 h-6 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-800 transition-colors duration-200 ease-in-out ${checked ? 'bg-indigo-600 after:translate-x-full after:border-white' : 'bg-slate-700 after:border-gray-300' } after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
      </div>
    </div>
  );
};