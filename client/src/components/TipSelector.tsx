import React from 'react';

const PRESETS = [0, 200, 500, 1000]; // cents: $0, $2, $5, $10

interface TipSelectorProps {
  value: number; // tip in cents
  onChange: (cents: number) => void;
}

export const TipSelector: React.FC<TipSelectorProps> = ({ value, onChange }) => {
  const [customInput, setCustomInput] = React.useState('');

  const handlePresetClick = (cents: number) => {
    onChange(cents);
    setCustomInput('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    
    const dollars = parseFloat(val);
    if (!isNaN(dollars) && dollars >= 0) {
      onChange(Math.round(dollars * 100));
    } else if (val === '') {
      onChange(0);
    }
  };

  const formatCents = (cents: number) => {
    if (cents === 0) return '$0';
    return `$${(cents / 100).toFixed(0)}`;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">
        💝 Add a tip for your driver (optional)
      </label>
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((cents) => (
          <button
            key={cents}
            type="button"
            onClick={() => handlePresetClick(cents)}
            className={`px-4 py-2 rounded-md border transition ${
              value === cents && !customInput
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
            }`}
          >
            {formatCents(cents)}
          </button>
        ))}
        <input
          type="number"
          min={0}
          step={1}
          placeholder="Custom $"
          value={customInput}
          onChange={handleCustomChange}
          className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      {value > 0 && (
        <p className="text-sm text-green-600">
          ✨ Thank you! Your ${(value / 100).toFixed(2)} tip will go directly to your driver.
        </p>
      )}
    </div>
  );
};

export default TipSelector;

