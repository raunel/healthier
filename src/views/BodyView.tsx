import React, { useState } from 'react';

interface BodyStats {
  weightLbs: string;
  heightFeet: string;
  heightInches: string;
}

export const BodyView: React.FC = () => {
  const [stats, setStats] = useState<BodyStats>({
    weightLbs: '',
    heightFeet: '',
    heightInches: '',
  });

  const [bmiResult, setBmiResult] = useState<number | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStats((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const calculateImperialBMI = (e: React.FormEvent) => {
    e.preventDefault();
    const weight = parseFloat(stats.weightLbs);
    const feet = parseFloat(stats.heightFeet) || 0;
    const inches = parseFloat(stats.heightInches) || 0;

    const totalInches = feet * 12 + inches;

    if (weight > 0 && totalInches > 0) {
      // Imperial BMI formula: (weight (lbs) / height (inches)^2) * 703
      const bmi = (weight / (totalInches * totalInches)) * 703;
      setBmiResult(parseFloat(bmi.toFixed(1)));
      
      // OPTIONAL: If your database backend requires metric (kg/cm) submission:
      // const weightKg = weight * 0.45359237;
      // const heightCm = totalInches * 2.54;
      // sendToBackend({ weightKg, heightCm });
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Body Composition Insights</h2>
      
      <form onSubmit={calculateImperialBMI} className="space-y-4">
        {/* Weight Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Weight (lbs)
          </label>
          <input
            type="number"
            name="weightLbs"
            value={stats.weightLbs}
            onChange={handleInputChange}
            placeholder="e.g., 175"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Height Input (Split into Feet & Inches for optimal US user experience) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Height
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input
                type="number"
                name="heightFeet"
                value={stats.heightFeet}
                onChange={handleInputChange}
                placeholder="Ft"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="absolute right-3 top-2 text-gray-400 text-sm">ft</span>
            </div>
            <div className="relative">
              <input
                type="number"
                name="heightInches"
                value={stats.heightInches}
                onChange={handleInputChange}
                placeholder="In"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                max="11"
              />
              <span className="absolute right-3 top-2 text-gray-400 text-sm">in</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 font-medium"
        >
          Update Metrics
        </button>
      </form>

      {bmiResult !== null && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-600">Calculated Body Mass Index (BMI)</p>
          <p className="text-3xl font-extrabold text-blue-600 mt-1">{bmiResult}</p>
          <p className="text-xs text-gray-400 mt-2">
            Formula optimized for lbs and inches parameters.
          </p>
        </div>
      )}
    </div>
  );
};

export default BodyView;
